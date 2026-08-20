"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { ClientModal } from "@/components/admin/ClientModal";
import type { ClientListItem } from "@/lib/admin/clients";

const STATUS_LABEL_FR: Record<string, string> = {
  active: "Actif",
  suspended: "Suspendu",
  blacklisted: "Liste noire",
};

const STATUS_TONE: Record<string, string> = {
  active: "bg-[#E4EEF4] text-navy",
  suspended: "bg-amber-100 text-amber-800",
  blacklisted: "bg-red-100 text-red-700",
};

const BLANK_NEW_CLIENT = {
  firstName: "",
  lastName: "",
  company: "",
  email: "",
  phone: "",
  billingAddress: "",
  billingCity: "",
  billingProvince: "Québec",
  billingPostalCode: "",
};

export function ClientsTable({ clients }: { clients: ClientListItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newClient, setNewClient] = useState(BLANK_NEW_CLIENT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      `${c.firstName} ${c.lastName} ${c.company ?? ""} ${c.email} ${c.phone}`.toLowerCase().includes(q)
    );
  }, [clients, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClient),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Impossible de créer le client");
        return;
      }
      setNewClient(BLANK_NEW_CLIENT);
      setCreating(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client..."
            className="w-64 pl-8"
          />
        </div>
        <Button type="button" variant="cta" onClick={() => setCreating((v) => !v)}>
          <Plus size={14} /> Nouveau client
        </Button>
      </div>

      {creating && (
        <Card className="mb-4 p-4">
          <div className="mb-2 font-heading text-[13px]">Nouveau client</div>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-2">
            <Input
              placeholder="Prénom"
              value={newClient.firstName}
              onChange={(e) => setNewClient((c) => ({ ...c, firstName: e.target.value }))}
              required
            />
            <Input
              placeholder="Nom"
              value={newClient.lastName}
              onChange={(e) => setNewClient((c) => ({ ...c, lastName: e.target.value }))}
              required
            />
            <Input
              placeholder="Entreprise (optionnel)"
              className="col-span-2"
              value={newClient.company}
              onChange={(e) => setNewClient((c) => ({ ...c, company: e.target.value }))}
            />
            <Input
              placeholder="Courriel"
              type="email"
              value={newClient.email}
              onChange={(e) => setNewClient((c) => ({ ...c, email: e.target.value }))}
              required
            />
            <Input
              placeholder="Téléphone"
              value={newClient.phone}
              onChange={(e) => setNewClient((c) => ({ ...c, phone: e.target.value }))}
              required
            />
            <Input
              placeholder="Adresse (facturation)"
              className="col-span-2"
              value={newClient.billingAddress}
              onChange={(e) => setNewClient((c) => ({ ...c, billingAddress: e.target.value }))}
            />
            <Input
              placeholder="Ville"
              value={newClient.billingCity}
              onChange={(e) => setNewClient((c) => ({ ...c, billingCity: e.target.value }))}
            />
            <Input
              placeholder="Province"
              value={newClient.billingProvince}
              onChange={(e) => setNewClient((c) => ({ ...c, billingProvince: e.target.value }))}
            />
            <Input
              placeholder="Code postal"
              className="col-span-2"
              value={newClient.billingPostalCode}
              onChange={(e) => setNewClient((c) => ({ ...c, billingPostalCode: e.target.value }))}
            />
            {error && <div className="col-span-2 text-[13px] text-red-600">{error}</div>}
            <div className="col-span-2 flex justify-end gap-2">
              <Button type="button" onClick={() => setCreating(false)}>
                Annuler
              </Button>
              <Button type="submit" variant="cta" disabled={saving}>
                {saving ? "..." : "Créer"}
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card className="p-4">
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="rounded-lg border border-border-light bg-[#FAFBFB] p-4 text-center text-[13px] text-muted">
              Aucun client trouvé.
            </div>
          )}
          {filtered.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setEditingClientId(c.id)}
              className="flex w-full flex-wrap items-center gap-3 rounded-lg border border-border-light p-3 text-left text-[13px] hover:bg-[#F4F6F7]"
            >
              <div className="min-w-[160px]">
                <div className="font-medium">
                  {c.firstName} {c.lastName}
                </div>
                {c.company && <div className="text-muted">{c.company}</div>}
              </div>
              <div className="min-w-[200px] text-muted">
                {c.email} · {c.phone}
              </div>
              <div className="min-w-[120px] text-muted">
                {[c.billingCity, c.billingProvince].filter(Boolean).join(", ") || "—"}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-muted">{c._count.reservations} réservation(s)</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_TONE[c.status] ?? ""}`}>
                  {STATUS_LABEL_FR[c.status] ?? c.status}
                </span>
              </div>
            </button>
          ))}
        </div>
      </Card>

      {editingClientId && (
        <ClientModal
          clientId={editingClientId}
          onClose={() => setEditingClientId(null)}
          onSaved={() => router.refresh()}
        />
      )}
    </div>
  );
}
