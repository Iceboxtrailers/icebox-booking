"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormError } from "@/components/forms/FormError";
import { apiErrorMessage } from "@/lib/api-client";

// The file field is visually hidden but still focusable (display:none would make it unreachable by keyboard
// and screen reader): the box shows the focus ring and Enter/Space opens the file picker.
function UploadBox({ label, file, onSet }: { label: string; file: File | null; onSet: (f: File | null) => void }) {
  return (
    <label className="mb-2.5 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border p-3.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-navy">
      <Upload size={18} className="text-muted" />
      <span className="flex-1">
        <span className="block text-[13px] font-medium">{label}</span>
        <span className="block text-xs text-muted">{file ? file.name : "Cliquez pour choisir un fichier"}</span>
      </span>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,application/pdf"
        className="sr-only"
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
    if (!res.ok) throw new Error(await apiErrorMessage(res, "Échec du téléversement"));
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

      <FormError message={error} className="mt-3" />

      <div className="mt-2 text-[12px] text-muted">
        Vous préférez le faire en succursale ?{" "}
        <button
          type="button"
          onClick={() => router.push(`/reservation/${reservationId}/contrat`)}
          className="py-1.5 text-navy underline"
        >
          Passer cette étape
        </button>
      </div>

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
