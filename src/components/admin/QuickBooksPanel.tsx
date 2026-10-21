"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Option = { id: string; name: string };

const FLASH_MESSAGES: Record<string, string> = {
  connected: "QuickBooks est connecté.",
  refuse: "L'autorisation a été refusée dans QuickBooks.",
  etat: "La connexion a expiré ou été interrompue — recommencez.",
  echec: "Impossible de finaliser la connexion à QuickBooks.",
};

export function QuickBooksPanel({
  appConfigured,
  environment,
  connection,
  syncedCount,
  failed,
  flash,
}: {
  appConfigured: boolean;
  environment: "sandbox" | "production";
  connection: { realmId: string; syncFromDate: string; ready: boolean } | null;
  syncedCount: number;
  failed: { id: string; client: string; error: string }[];
  flash: string | null;
}) {
  const router = useRouter();
  const [options, setOptions] = useState<{ accounts: Option[]; taxCodes: Option[] } | null>(null);
  const [incomeAccountId, setIncomeAccountId] = useState("");
  const [taxCodeId, setTaxCodeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needsSetup = Boolean(connection && !connection.ready);

  useEffect(() => {
    if (!needsSetup) return;
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/admin/quickbooks/options");
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (!res.ok) {
        setError(data.error ?? "Impossible de lire QuickBooks");
        return;
      }
      setOptions(data);
    })();
    return () => {
      cancelled = true;
    };
  }, [needsSetup]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/quickbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incomeAccountId, taxCodeId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Impossible d'enregistrer");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  // The connect route answers with a redirect to Intuit, so it takes a full page navigation, not a router push.
  function connect() {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/api/admin/quickbooks/connect";
  }

  // In-page confirmation: window.confirm() is silently blocked in some embedded browsers.
  const [confirmingDisconnect, setConfirmingDisconnect] = useState(false);

  async function disconnect() {
    setError(null);
    const res = await fetch("/api/admin/quickbooks", { method: "DELETE" });
    if (!res.ok) setError("Impossible de déconnecter QuickBooks");
    setConfirmingDisconnect(false);
    router.refresh();
  }

  async function retry(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/reservations/${id}/quickbooks`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Nouvelle tentative échouée");
    router.refresh();
  }

  const select = "w-full rounded-md border border-border px-3 py-2.5 text-[13px] outline-none focus:border-navy";

  return (
    <div className="max-w-xl space-y-4">
      {flash && (
        <div className={`text-[13px] ${flash === "connected" ? "text-green-700" : "text-red-600"}`}>
          {FLASH_MESSAGES[flash] ?? flash}
        </div>
      )}
      {error && <div role="alert" className="text-[13px] text-red-600">{error}</div>}

      {!appConfigured && (
        <Card className="p-4 text-[13px] text-muted">
          L&apos;application Intuit n&apos;est pas encore configurée : ajoutez <code>QUICKBOOKS_CLIENT_ID</code> et{" "}
          <code>QUICKBOOKS_CLIENT_SECRET</code> dans Vercel, puis redéployez.
        </Card>
      )}

      {appConfigured && !connection && (
        <Card className="p-4 text-[13px]">
          <div className="mb-1 font-medium">QuickBooks n&apos;est pas connecté</div>
          <p className="mb-3 text-muted">
            Mode : <strong>{environment === "production" ? "production" : "essai (sandbox)"}</strong>. Vous serez
            redirigé vers Intuit pour autoriser l&apos;accès à votre compte.
          </p>
          <Button type="button" variant="cta" onClick={connect}>
            Connecter QuickBooks
          </Button>
        </Card>
      )}

      {connection && (
        <Card className="p-4 text-[13px]">
          <div className="mb-1 font-medium">Connecté à QuickBooks Online</div>
          <div className="text-muted">
            Entreprise n° {connection.realmId} · mode {environment === "production" ? "production" : "essai"}
          </div>
          <div className="text-muted">
            Les réservations créées à partir du {new Date(connection.syncFromDate).toLocaleDateString("fr-CA")} sont
            envoyées automatiquement à leur confirmation. {syncedCount} facture{syncedCount > 1 ? "s" : ""} créée
            {syncedCount > 1 ? "s" : ""}.
          </div>
          {confirmingDisconnect ? (
            <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px]">
              <span className="text-muted">Les factures déjà créées restent dans QuickBooks.</span>
              <button type="button" onClick={disconnect} className="font-medium text-red-600 hover:underline">
                Confirmer la déconnexion
              </button>
              <button type="button" onClick={() => setConfirmingDisconnect(false)} className="text-muted hover:underline">
                Annuler
              </button>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap gap-4 text-[12px]">
              <button
                type="button"
                onClick={connect}
                className="text-navy hover:underline"
              >
                Connecter une autre entreprise
              </button>
              <button type="button" onClick={() => setConfirmingDisconnect(true)} className="text-red-600 hover:underline">
                Déconnecter
              </button>
            </div>
          )}
        </Card>
      )}

      {needsSetup && (
        <Card className="p-4 text-[13px]">
          <div className="mb-2 font-medium">Dernière étape : comptes et taxes</div>
          {!options ? (
            <div className="text-muted">Chargement depuis QuickBooks...</div>
          ) : (
            <form onSubmit={saveSettings} className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted">
                  Compte de revenus (location)
                </span>
                <select value={incomeAccountId} onChange={(e) => setIncomeAccountId(e.target.value)} className={select} required>
                  <option value="">Choisir...</option>
                  {options.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted">
                  Code de taxe (TPS + TVQ)
                </span>
                <select value={taxCodeId} onChange={(e) => setTaxCodeId(e.target.value)} className={select} required>
                  <option value="">Choisir...</option>
                  {options.taxCodes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[12px] text-muted">
                Deux articles de service seront créés dans QuickBooks s&apos;ils n&apos;existent pas : « Location de
                remorque réfrigérée » et « Transport (livraison et récupération) ». Validez ces choix avec votre
                comptable.
              </p>
              <Button type="submit" variant="cta" disabled={busy}>
                {busy ? "..." : "Enregistrer"}
              </Button>
            </form>
          )}
        </Card>
      )}

      {failed.length > 0 && (
        <Card className="p-4 text-[13px]">
          <div className="mb-2 font-medium">Factures non envoyées</div>
          {failed.map((f) => (
            <div key={f.id} className="flex items-start justify-between gap-3 border-t border-border-light py-2">
              <div>
                <div>{f.client}</div>
                <div className="text-[12px] text-red-600">{f.error}</div>
              </div>
              <button type="button" onClick={() => retry(f.id)} className="shrink-0 text-[12px] text-navy hover:underline">
                Réessayer
              </button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
