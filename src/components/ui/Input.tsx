"use client";

import { InputHTMLAttributes, useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

const BASE = "w-full rounded-md border border-border px-3 py-2.5 text-[13px] font-sans outline-none focus:border-navy";

export function Input({ className = "", type, ...props }: InputProps) {
  const [visible, setVisible] = useState(false);

  if (type !== "password") {
    return <input type={type} className={`${BASE} ${className}`} {...props} />;
  }

  return (
    <div className="relative">
      <input type={visible ? "text" : "password"} className={`${BASE} pr-10 ${className}`} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted hover:text-foreground"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
