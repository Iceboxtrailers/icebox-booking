import { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "default" | "cta" | "danger";
export type ButtonSize = "md" | "sm";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const base =
  "inline-flex items-center gap-1.5 rounded-md border text-[13px] font-medium transition-colors disabled:opacity-45 disabled:cursor-not-allowed";

const sizes: Record<ButtonSize, string> = {
  md: "px-4 py-2.5",
  sm: "px-3.5 py-2",
};

const variants: Record<ButtonVariant, string> = {
  default: "border-border bg-white text-foreground hover:bg-hover",
  cta: "border-cta bg-cta text-white hover:border-cta-hover hover:bg-cta-hover",
  danger: "border-red-600 bg-red-600 text-white hover:bg-red-700",
};

// The one place that defines how buttons look. Use it for real buttons (<Button>)
// and for links or spans that must look like a button (<a className={buttonClassName("cta")}>).
export function buttonClassName(variant: ButtonVariant = "default", size: ButtonSize = "md", className = "") {
  return `${base} ${sizes[size]} ${variants[variant]} ${className}`.trim();
}

export function Button({ variant = "default", size = "md", className = "", ...props }: ButtonProps) {
  return <button className={buttonClassName(variant, size, className)} {...props} />;
}
