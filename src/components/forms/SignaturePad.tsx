"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { FormError } from "@/components/forms/FormError";
import { signatureFont } from "@/components/forms/signature-font";
import { apiErrorMessage } from "@/lib/api-client";
import { isTypedSignatureValid, typedSignatureText } from "@/lib/signature";
import type { SignatureMethod } from "@/lib/signature";
import type { ContractLine } from "@/lib/providers/signature/contract-text";

// A real signature is at least this long, in canvas pixels (the canvas is 520 wide).
const MIN_SIGNATURE_LENGTH = 40;

const INK = "#1B2733";

// Sets the typed name in handwriting on the canvas (transparent background, like a drawn signature). The font
// is fetched the first time, and the name is shrunk until it fits the width. `isStale` lets a newer call win
// when the name changes while the font is still loading.
async function renderTypedSignature(canvas: HTMLCanvasElement, name: string, isStale: () => boolean) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const text = typedSignatureText(name);
  const family = signatureFont.style.fontFamily;
  if (text) {
    try {
      await document.fonts.load(`600 48px ${family}`, text);
    } catch {
      // The fallback font in the family draws it.
    }
  }
  if (isStale()) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!text) return;
  let size = 64;
  ctx.font = `600 ${size}px ${family}`;
  while (ctx.measureText(text).width > canvas.width - 40 && size > 18) {
    size -= 2;
    ctx.font = `600 ${size}px ${family}`;
  }
  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
}

export function SignaturePad({
  reservationId,
  contractLines,
  defaultSignerName,
  initialPdfUrl,
}: {
  reservationId: string;
  contractLines: ContractLine[];
  defaultSignerName: string;
  initialPdfUrl: string | null;
}) {
  const router = useRouter();
  const methodLabelId = useId();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const typedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);
  // Length of what has been drawn, in canvas pixels: a tap or a stray dot is not a signature.
  const drawnLength = useRef(0);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);

  const [pdfUrl, setPdfUrl] = useState(initialPdfUrl);
  const [signerName, setSignerName] = useState(defaultSignerName);
  const [method, setMethod] = useState<SignatureMethod>("drawn");
  const [signed, setSigned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
  }, []);

  useEffect(() => {
    if (pdfUrl) return;
    (async () => {
      const res = await fetch(`/api/contracts/${reservationId}/generate`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setPdfUrl(data.pdfUrl);
      } else {
        setError(await apiErrorMessage(res, "Impossible de préparer le contrat"));
      }
    })();
  }, [pdfUrl, reservationId]);

  // The preview follows the name as it is typed.
  useEffect(() => {
    if (method !== "typed") return;
    const canvas = typedCanvasRef.current;
    if (!canvas) return;
    let stale = false;
    void renderTypedSignature(canvas, signerName, () => stale);
    return () => {
      stale = true;
    };
  }, [method, signerName]);

  // The canvas is drawn at a fixed 520 x 120 but shown at the width of its container (about 300 px on a
  // phone), so the pointer position is converted to canvas pixels or the line lands off the finger.
  function pos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const point = "touches" in e ? e.touches[0] : e;
    return {
      x: (point.clientX - rect.left) * (canvas.width / rect.width),
      y: (point.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function start(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const { x, y } = pos(e, canvas);
    lastPoint.current = { x, y };
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
    if (lastPoint.current) drawnLength.current += Math.hypot(x - lastPoint.current.x, y - lastPoint.current.y);
    lastPoint.current = { x, y };
    if (!hasDrawn.current && drawnLength.current >= MIN_SIGNATURE_LENGTH) {
      hasDrawn.current = true;
      setSigned(true);
    }
  }

  function end() {
    drawing.current = false;
    lastPoint.current = null;
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawn.current = false;
    drawnLength.current = 0;
    lastPoint.current = null;
    setSigned(false);
  }

  const ready = method === "typed" ? isTypedSignatureValid(signerName) : signed;

  async function handleNext() {
    if (!ready || !signerName.trim()) return;
    const canvas = method === "typed" ? typedCanvasRef.current : canvasRef.current;
    if (!canvas) return;
    setError(null);
    setSubmitting(true);
    try {
      // The typed name is set in handwriting asynchronously: make sure the image is the final name.
      if (method === "typed") await renderTypedSignature(canvas, signerName, () => false);
      const signatureImageBase64 = canvas.toDataURL("image/png");
      const res = await fetch(`/api/contracts/${reservationId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signerName, signatureImageBase64, signatureMethod: method }),
      });
      if (!res.ok) {
        setError(await apiErrorMessage(res, "Impossible d'enregistrer la signature"));
        return;
      }
      router.push(`/reservation/${reservationId}/depot`);
    } finally {
      setSubmitting(false);
    }
  }

  const choice = (value: SignatureMethod) =>
    `rounded-md border px-3 py-1.5 text-[12px] ${method === value ? "border-navy bg-tint" : "border-border bg-white"}`;

  return (
    <div>
      <div className="mb-4 max-h-96 overflow-y-auto rounded-lg border border-border-light bg-subtle p-4">
        <div className="mb-2 text-[11px] font-medium text-warn-text">
          PROTOTYPE — non légalement contraignant
        </div>
        <div className="space-y-1 text-[12px] leading-relaxed text-body">
          {contractLines.map((line, i) => {
            if (line.type === "spacer") return <div key={i} className="h-2" />;
            if (line.type === "title") {
              return (
                <div key={i} className="mb-1 text-[14px] font-semibold text-foreground">
                  {line.text}
                </div>
              );
            }
            if (line.type === "heading") {
              return (
                <div key={i} className="mt-2 text-[12.5px] font-semibold text-foreground">
                  {line.text}
                </div>
              );
            }
            if (line.type === "subheading") {
              return (
                <div key={i} className="font-medium text-foreground">
                  {line.text}
                </div>
              );
            }
            if (line.type === "rule") {
              return <hr key={i} className="my-2 border-border-light" />;
            }
            if (line.type === "bullet") {
              return (
                <div key={i} className="pl-3">
                  • {line.text}
                </div>
              );
            }
            return <div key={i}>{line.text}</div>;
          })}
        </div>
        {pdfUrl && (
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block py-2 text-[12px] text-navy underline">
            Voir le contrat en PDF
          </a>
        )}
      </div>

      <Field label="Nom du signataire">
        <Input value={signerName} onChange={(e) => setSignerName(e.target.value)} required />
      </Field>

      <div role="group" aria-labelledby={methodLabelId}>
        <span id={methodLabelId} className="mb-1 block text-[11px] uppercase tracking-wide text-muted">
          Signature électronique
        </span>
        <div className="mb-2 flex flex-wrap gap-2">
          <button type="button" onClick={() => setMethod("drawn")} aria-pressed={method === "drawn"} className={choice("drawn")}>
            Dessiner ma signature
          </button>
          <button type="button" onClick={() => setMethod("typed")} aria-pressed={method === "typed"} className={choice("typed")}>
            Taper mon nom
          </button>
        </div>

        <div className={method === "drawn" ? "" : "hidden"}>
          <div className="rounded-lg border border-border bg-white">
            <canvas
              ref={canvasRef}
              width={520}
              height={120}
              style={{ width: "100%", height: 120, touchAction: "none", cursor: "crosshair" }}
              onMouseDown={start}
              onMouseMove={move}
              onMouseUp={end}
              onMouseLeave={end}
              onTouchStart={start}
              onTouchMove={move}
              onTouchEnd={end}
              onTouchCancel={end}
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[11px] text-muted">
              Signez avec la souris ou le doigt, ou choisissez « Taper mon nom ».
            </span>
            <Button type="button" onClick={clear}>
              <RotateCcw size={12} /> Effacer
            </Button>
          </div>
        </div>

        <div className={method === "typed" ? "" : "hidden"}>
          <div className="rounded-lg border border-border bg-white">
            <canvas
              ref={typedCanvasRef}
              width={520}
              height={120}
              role="img"
              aria-label={`Aperçu de la signature : ${typedSignatureText(signerName)}`}
              style={{ width: "100%", height: 120 }}
            />
          </div>
          <p className="mt-2 text-[11px] text-muted">
            {isTypedSignatureValid(signerName)
              ? "Votre nom, tel qu'écrit dans « Nom du signataire », sera apposé en écriture manuscrite. Il vaut signature, comme un dessin à la main."
              : "Entrez votre nom complet dans « Nom du signataire » : c'est lui qui sera apposé comme signature."}
          </p>
        </div>
      </div>

      <FormError message={error} className="mt-3" />

      <div className="mt-4 flex justify-between">
        <Button type="button" onClick={() => router.back()}>
          Précédent
        </Button>
        <Button type="button" variant="cta" disabled={!ready || submitting} onClick={handleNext}>
          {submitting ? "..." : "Suivant"}
        </Button>
      </div>
    </div>
  );
}
