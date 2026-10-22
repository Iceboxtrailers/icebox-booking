"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

type Employee = { id: string; username: string; createdAt: string; mfaEnabled: boolean };

export function EmployeesManager({ employees }: { employees: Employee[] }) {
  const router = useRouter();
  const { confirm, dialog } = useConfirm();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  async function handleResetPassword(e: React.FormEvent, employee: Employee) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/admin/users/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Impossible de changer le mot de passe");
      return;
    }
    setResettingId(null);
    setNewPassword("");
    setNotice(`Mot de passe de « ${employee.username} » mis à jour.`);
  }

  const [confirmMfaResetId, setConfirmMfaResetId] = useState<string | null>(null);

  async function handleResetMfa(employee: Employee) {
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/admin/users/${employee.id}/mfa`, { method: "DELETE" });
    setConfirmMfaResetId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Impossible de réinitialiser la double authentification");
      return;
    }
    setNotice(`Double authentification de « ${employee.username} » réinitialisée.`);
    router.refresh();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Impossible de créer le compte");
        return;
      }
      setUsername("");
      setPassword("");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(employee: Employee) {
    if (!(await confirm(`Supprimer le compte « ${employee.username} » ?`, { confirmLabel: "Supprimer", danger: true }))) return;
    const res = await fetch(`/api/admin/users/${employee.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Impossible de supprimer");
      return;
    }
    router.refresh();
  }

  return (
    <div className="max-w-md">
      <p className="mb-4 text-[13px] text-muted">
        Un compte employé peut placer la retenue du dépôt, marquer la remise, prendre les photos et accepter le
        retour. Il ne voit ni les revenus, ni les clients, ni les rapports, et ne peut pas prélever un dépôt.
      </p>

      <div className="mb-6 rounded-lg border border-border-light">
        {employees.length === 0 ? (
          <div className="p-3 text-[13px] text-muted">Aucun compte employé.</div>
        ) : (
          employees.map((employee) => (
            <div key={employee.id} className="border-b border-border-light p-3 text-[13px] last:border-b-0">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium">{employee.username}</div>
                  <div className="text-[11px] text-muted">
                    Créé le {new Date(employee.createdAt).toLocaleDateString("fr-CA")} · 2FA{" "}
                    {employee.mfaEnabled ? "activée" : "non activée"}
                  </div>
                  {employee.mfaEnabled &&
                    (confirmMfaResetId === employee.id ? (
                      <div className="mt-1 flex gap-3 text-[11px]">
                        <button type="button" onClick={() => handleResetMfa(employee)} className="font-medium text-red-600 hover:underline">
                          Confirmer la réinitialisation
                        </button>
                        <button type="button" onClick={() => setConfirmMfaResetId(null)} className="text-muted hover:underline">
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmMfaResetId(employee.id)} className="mt-1 text-[11px] text-navy hover:underline">
                        Réinitialiser la 2FA (téléphone perdu)
                      </button>
                    ))}
                </div>
                <div className="flex shrink-0 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setResettingId(resettingId === employee.id ? null : employee.id);
                      setNewPassword("");
                      setError(null);
                      setNotice(null);
                    }}
                    className="text-[12px] text-navy underline"
                  >
                    Nouveau mot de passe
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(employee)}
                    className="text-[12px] text-red-600 hover:underline"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
              {resettingId === employee.id && (
                <form onSubmit={(e) => handleResetPassword(e, employee)} className="mt-2.5 flex items-start gap-2">
                  <div className="flex-1">
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Nouveau mot de passe (10 caractères min.)"
                      minLength={10}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <Button type="submit" variant="cta">
                    Enregistrer
                  </Button>
                </form>
              )}
            </div>
          ))
        )}
      </div>

      {notice && <div className="mb-4 text-[13px] text-green-700">{notice}</div>}
      {error && <div role="alert" className="mb-4 text-[13px] text-red-600">{error}</div>}

      <form onSubmit={handleCreate}>
        <div className="mb-2 text-[13px] font-medium">Nouveau compte employé</div>
        <Field label="Nom d'utilisateur">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} required autoComplete="off" />
        </Field>
        <Field label="Mot de passe (10 caractères minimum)">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={10}
            autoComplete="new-password"
          />
        </Field>
        <Button type="submit" variant="cta" disabled={submitting}>
          {submitting ? "..." : "Créer le compte"}
        </Button>
      </form>
      {dialog}
    </div>
  );
}
