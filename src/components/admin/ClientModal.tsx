"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { CLIENT_STATUS } from "@/lib/constants";

const STATUS_LABEL_FR: Record<string, string> = {
  active: "Actif",
  suspended: "Suspendu",
  blacklisted: "Liste noire",
};

type ClientForm = {
  firstName: string;
  lastName: string;
  company: string;
  email: string;
  phone: string;
  billingAddress: string;
  billingCity: string;
  billingProvince: string;
  billingPostalCode: string;
  status: string;
  internalNote: string;
};

const BLANK: ClientForm = {
  firstName: "",
  lastName: "",
  company: "",
  email: "",
  phone: "",
  billingAddress: "",
  billingCity: "",
  billingProvince: "Québec",
  billingPostalCode: "",
  status: "active",
  internalNote: "",
};

export function ClientModal({
  clientId,
  onClose,
  onSaved,
}: {
  clientId: string;
  onClose: () => void;
  onSaved?: (client: { id: string; firstName: string; lastName: string; email: string; phone: string }) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<ClientForm>(BLANK);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/admin/clients/${clientId}`);
      if (!res.ok) {
        if (!cancelled) setError("Impossible de charger le client");
        return;
      }
      const data = await res.json();
      if (cancelled) return;
      setForm({
        firstName: data.firstName ?? "",
        lastName: data.lastName ?? "",
        company: data.company ?? "",
        email: data.email ?? "",
        phone: data.phone ?? "",
        billingAddress: data.billingAddress ?? "",
        billingCity: data.billingCity ?? "",
        billingProvince: data.billingProvince ?? "",
        billingPostalCode: data.billingPostalCode ?? "",
        status: data.status ?? "active",
        internalNote: data.internalNote ?? "",
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  function set<K extends keyof ClientForm>(key: K, value: ClientForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Impossible d'enregistrer");
        return;
      }
      onSaved?.(data);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="font-heading text-lg">Fiche client</div>
          <button onClick={onClose} className="text-muted hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="text-[13px] text-muted">Chargement...</div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prénom">
                <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
              </Field>
              <Field label="Nom">
                <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
              </Field>
            </div>

            <Field label="Entreprise (optionnel)">
              <Input value={form.company} onChange={(e) => set("company", e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Courriel">
                <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
              </Field>
              <Field label="Téléphone">
                <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} required />
              </Field>
            </div>

            <Field label="Adresse (facturation)">
              <Input value={form.billingAddress} onChange={(e) => set("billingAddress", e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Ville">
                <Input value={form.billingCity} onChange={(e) => set("billingCity", e.target.value)} />
              </Field>
              <Field label="Province">
                <Input value={form.billingProvince} onChange={(e) => set("billingProvince", e.target.value)} />
              </Field>
            </div>

            <Field label="Code postal">
              <Input value={form.billingPostalCode} onChange={(e) => set("billingPostalCode", e.target.value)} />
            </Field>

            <Field label="Statut">
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className="w-full rounded-md border border-border px-3 py-2.5 text-[13px]"
              >
                {CLIENT_STATUS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL_FR[s]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Note interne">
              <textarea
                value={form.internalNote}
                onChange={(e) => set("internalNote", e.target.value)}
                rows={2}
                className="w-full rounded-md border border-border px-3 py-2.5 text-[13px] outline-none focus:border-navy"
              />
            </Field>

            {error && <div className="mb-3 text-[13px] text-red-600">{error}</div>}

            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" onClick={onClose}>
                Annuler
              </Button>
              <Button type="submit" variant="cta" disabled={submitting}>
                {submitting ? "..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
