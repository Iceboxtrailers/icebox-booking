"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";

function UploadBox({ label, file, onSet }: { label: string; file: File | null; onSet: (f: File | null) => void }) {
  return (
    <label className="mb-2.5 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border p-3.5">
      <Upload size={18} color="#5F6B75" />
      <div className="flex-1">
        <div className="text-[13px] font-medium">{label}</div>
        <div className="text-xs text-muted">{file ? file.name : "Cliquez pour choisir un fichier"}</div>
      </div>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => onSet(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

export function DocumentUpload({ reservationId }: { reservationId: string }) {
  const router = useRouter();
  const [license, setLicense] = useState<File | null>(null);
  const [insurance, setInsurance] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = Boolean(license && insurance && consent);

  async function uploadOne(type: "license" | "insurance", file: File) {
    const body = new FormData();
    body.set("type", type);
    body.set("consent", "true");
    body.set("file", file);
    const res = await fetch("/api/documents/upload", { method: "POST", body });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Échec du téléversement");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!license || !insurance) return;
    setError(null);
    setSubmitting(true);
    try {
      await uploadOne("license", license);
      await uploadOne("insurance", insurance);
      router.push(`/reservation/${reservationId}/contrat`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du téléversement");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4 text-[13px] text-muted">Requis avant la génération du contrat.</div>
      <UploadBox label="Permis de conduire" file={license} onSet={setLicense} />
      <UploadBox label="Preuve d'assurance" file={insurance} onSet={setInsurance} />

      <label className="mt-3 flex items-start gap-2 text-[12px] text-muted">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5"
        />
        Je consens à la collecte de mon permis de conduire et de ma preuve d&apos;assurance aux fins de cette
        location, conformément à la Loi 25. Ces documents sont chiffrés et accessibles uniquement au personnel
        autorisé.
      </label>

      {error && <div className="mt-3 text-[13px] text-red-600">{error}</div>}

      <div className="mt-4 flex justify-between">
        <Button type="button" onClick={() => router.back()}>
          Précédent
        </Button>
        <Button type="submit" variant="cta" disabled={!canSubmit || submitting}>
          {submitting ? "Envoi..." : "Suivant"}
        </Button>
      </div>
    </form>
  );
}
