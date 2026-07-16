"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";

export function SignaturePad({
  reservationId,
  contractText,
  defaultSignerName,
  initialPdfUrl,
}: {
  reservationId: string;
  contractText: string;
  defaultSignerName: string;
  initialPdfUrl: string | null;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);

  const [pdfUrl, setPdfUrl] = useState(initialPdfUrl);
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1B2733";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, []);

  useEffect(() => {
    if (pdfUrl) return;
    (async () => {
      const res = await fetch(`/api/contracts/${reservationId}/generate`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setPdfUrl(data.pdfUrl);
      }
    })();
  }, [pdfUrl, reservationId]);

  function pos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const point = "touches" in e ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const { x, y } = pos(e, canvas);
    const ctx = canvas.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = pos(e, canvas);
    const ctx = canvas.getContext("2d")!;
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end() {
    drawing.current = false;
    hasDrawn.current = true;
    setSigned(true);
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
    setSigned(false);
  }

  async function handleNext() {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn.current || !signerName.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const signatureImageBase64 = canvas.toDataURL("image/png");
      const res = await fetch(`/api/contracts/${reservationId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerName, signatureImageBase64 }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Impossible d'enregistrer la signature");
        return;
      }
      router.push(`/reservation/${reservationId}/depot`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-4 rounded-lg border border-border-light bg-[#FAFBFB] p-4">
        <div className="mb-2 text-[13px] font-semibold uppercase">
          Contrat de location — aperçu généré
        </div>
        <div className="mb-2 text-[11px] font-medium text-warn-text">
          PROTOTYPE — non légalement contraignant
        </div>
        <div className="text-[12px] leading-relaxed text-[#3A454E]">{contractText}</div>
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[12px] text-navy underline">
            Voir le contrat en PDF
          </a>
        )}
      </div>

      <Field label="Nom du signataire">
        <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} required />
      </Field>

      <span className="mb-1 block text-[11px] uppercase tracking-wide text-muted">Signature électronique</span>
      <div className="rounded-lg border border-border bg-white">
        <canvas
          ref={canvasRef}
          width={520}
          height={120}
          style={{ width: "100%", height: 120, touchAction: "none", cursor: "crosshair" }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={() => (drawing.current = false)}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-muted">Signez avec la souris ou le doigt.</span>
        <Button type="button" onClick={clear}>
          <RotateCcw size={12} /> Effacer
        </Button>
      </div>

      {error && <div className="mt-3 text-[13px] text-red-600">{error}</div>}

      <div className="mt-4 flex justify-between">
        <Button type="button" onClick={() => router.back()}>
          Précédent
        </Button>
        <Button type="button" variant="cta" disabled={!signed || submitting} onClick={handleNext}>
          {submitting ? "..." : "Suivant"}
        </Button>
      </div>
    </div>
  );
}
