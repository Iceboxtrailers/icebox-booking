"use client";

import { useState } from "react";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function AccountProfileForm({
  initialFirstName,
  initialLastName,
  initialCompany,
  initialEmail,
  initialPhone,
  initialBillingAddress,
  initialBillingCity,
  initialBillingProvince,
  initialBillingPostalCode,
}: {
  initialFirstName: string;
  initialLastName: string;
  initialCompany: string | null;
  initialEmail: string;
  initialPhone: string;
  initialBillingAddress: string | null;
  initialBillingCity: string | null;
  initialBillingProvince: string | null;
  initialBillingPostalCode: string | null;
}) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [company, setCompany] = useState(initialCompany ?? "");
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [billingAddress, setBillingAddress] = useState(initialBillingAddress ?? "");
  const [billingCity, setBillingCity] = useState(initialBillingCity ?? "");
  const [billingProvince, setBillingProvince] = useState(initialBillingProvince ?? "Québec");
  const [billingPostalCode, setBillingPostalCode] = useState(initialBillingPostalCode ?? "");
  const [status, setStatus] = useState<"idle" | "submitting" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          company,
          email,
          phone,
          billingAddress,
          billingCity,
          billingProvince,
          billingPostalCode,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Impossible d'enregistrer");
        setStatus("idle");
        return;
      }
      setStatus("saved");
    } catch {
      setError("Impossible d'enregistrer");
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border-light bg-white p-4">
      <div className="mb-3 text-[13px] font-medium">Informations personnelles</div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Prénom">
          <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </Field>
        <Field label="Nom">
          <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </Field>
      </div>
      <Field label="Entreprise (si applicable)">
        <Input value={company} onChange={(e) => setCompany(e.target.value)} />
      </Field>
      <Field label="Courriel">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Téléphone">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
      </Field>

      <div className="mt-5 mb-3 text-[13px] font-medium">Adresse de facturation</div>
      <Field label="Adresse">
        <Input value={billingAddress} onChange={(e) => setBillingAddress(e.target.value)} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ville">
          <Input value={billingCity} onChange={(e) => setBillingCity(e.target.value)} />
        </Field>
        <Field label="Province">
          <Input value={billingProvince} onChange={(e) => setBillingProvince(e.target.value)} />
        </Field>
      </div>
      <Field label="Code postal">
        <Input value={billingPostalCode} onChange={(e) => setBillingPostalCode(e.target.value)} />
      </Field>

      {error && <div className="mb-3 text-[13px] text-red-600">{error}</div>}
      {status === "saved" && <div className="mb-3 text-[13px] text-success">Informations enregistrées.</div>}
      <Button type="submit" variant="cta" disabled={status === "submitting"}>
        {status === "submitting" ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
