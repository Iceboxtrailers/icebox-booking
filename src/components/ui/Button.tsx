import { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "default" | "cta";
};

const base =
  "inline-flex items-center gap-1.5 rounded-md border px-4 py-2.5 text-[13px] font-medium transition-colors disabled:opacity-45 disabled:cursor-not-allowed";

const variants = {
  default: "border-border bg-white text-foreground hover:bg-[#EDF2F4]",
  cta: "border-cta bg-cta text-white hover:bg-cta-hover",
};

export function Button({ variant = "default", className = "", ...props }: ButtonProps) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
