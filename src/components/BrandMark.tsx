import Image from "next/image";

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/brand/icon-square.png"
      alt="IceBox"
      width={size}
      height={size}
      className="rounded-lg"
      priority
    />
  );
}
