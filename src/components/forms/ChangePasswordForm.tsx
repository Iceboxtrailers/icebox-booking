"use client";

import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Impossible de changer le mot de passe");
        setStatus("idle");
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setStatus("saved");
    } catch {
      setError("Impossible de changer le mot de passe");
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 rounded-lg border border-border-light bg-white p-4">
      <div className="mb-3 text-[13px] font-medium">Changer le mot de passe</div>
      <Field label="Mot de passe actuel">
        <Input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
        />
      </Field>
      <Field label="Nouveau mot de passe">
        <Input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          minLength={8}
          required
        />
      </Field>
      {error && <div className="mb-3 text-[13px] text-red-600">{error}</div>}
      {status === "saved" && <div className="mb-3 text-[13px] text-success">Mot de passe modifié.</div>}
      <Button type="submit" variant="cta" disabled={status === "submitting"}>
        {status === "submitting" ? "..." : "Changer le mot de passe"}
      </Button>
    </form>
  );
}
