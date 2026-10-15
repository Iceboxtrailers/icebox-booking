import Image from "next/image";

// The official IceBox logo (charte graphique) — always the real file, never text set in Bungee.
// public/brand/logo-lockup.png is public/brand/logo-horizontal.png with its transparent
// margins trimmed (same pixels, same colors). It is designed for light backgrounds.
const RATIO = 744 / 753;

export function BrandLogo({ height = 52, className = "", priority = false }: { height?: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/logo-lockup.png"
      alt="IceBox — Remorque réfrigérée"
      width={Math.round(height * RATIO)}
      height={height}
      className={className}
      priority={priority}
    />
  );
}
