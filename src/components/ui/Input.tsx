import { InputHTMLAttributes } from "react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className = "", ...props }: InputProps) {
  return (
    <input
      className={`w-full rounded-md border border-border px-3 py-2.5 text-[13px] font-sans outline-none focus:border-navy ${className}`}
      {...props}
    />
  );
}
