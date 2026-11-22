"use client";

import { Check, Loader2, Plus, Save, Send } from "lucide-react";

type SaveButtonVariant = "primary" | "secondary" | "dark";
type SaveButtonIcon = "save" | "send" | "plus" | "none";

interface SaveButtonProps {
  busy?: boolean;
  saved?: boolean;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
  label: string;
  busyLabel?: string;
  savedLabel?: string;
  variant?: SaveButtonVariant;
  icon?: SaveButtonIcon;
  fullWidth?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<SaveButtonVariant, string> = {
  primary:
    "bg-[var(--brand-primary)] hover:bg-[var(--brand-accent)] text-white border border-[#881337]/30 shadow-[0_3px_0_0_#881337,0_6px_14px_-4px_rgba(200,30,106,0.38)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_0_#881337]",
  secondary:
    "bg-[#fff6fa] hover:bg-[#fdeaf3] text-[var(--brand-accent)] border border-[var(--brand-primary)]/45 shadow-[0_3px_0_0_rgba(200,30,106,0.22),0_4px_10px_-4px_rgba(200,30,106,0.16)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_0_rgba(200,30,106,0.22)]",
  dark:
    "bg-[#1f141b] hover:bg-[#35222e] text-white border border-black/30 shadow-[0_3px_0_0_#0f090d,0_6px_14px_-4px_rgba(31,20,27,0.3)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_1px_0_0_#0f090d]",
};

const SAVED_CLASSES =
  "bg-emerald-600 text-white border border-emerald-700/40 shadow-[0_3px_0_0_#047857,0_6px_14px_-4px_rgba(5,150,105,0.35)]";

export function SaveButton({
  busy = false,
  saved = false,
  disabled = false,
  type = "submit",
  onClick,
  label,
  busyLabel = "Guardando...",
  savedLabel = "¡Guardado!",
  variant = "primary",
  icon = "save",
  fullWidth = false,
  className = "",
}: SaveButtonProps) {
  const isDisabled = busy || disabled;

  function renderIcon() {
    if (busy) {
      return <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />;
    }
    if (saved) {
      return <Check className="h-4 w-4 shrink-0" aria-hidden="true" />;
    }
    if (icon === "save") {
      return <Save className="h-4 w-4 shrink-0" aria-hidden="true" />;
    }
    if (icon === "send") {
      return <Send className="h-4 w-4 shrink-0" aria-hidden="true" />;
    }
    if (icon === "plus") {
      return <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />;
    }
    return null;
  }

  const stateClasses = saved && !busy ? SAVED_CLASSES : VARIANT_CLASSES[variant];

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-busy={busy || undefined}
      onClick={onClick}
      className={`inline-flex min-h-11 select-none items-center justify-center gap-2 rounded-full px-6 text-xs font-semibold transition-all duration-150 ${
        fullWidth ? "w-full text-sm min-h-12" : ""
      } ${stateClasses} ${
        busy
          ? "translate-y-0.5 cursor-wait opacity-90 shadow-none"
          : isDisabled
          ? "cursor-not-allowed opacity-50 shadow-none hover:translate-y-0"
          : "cursor-pointer"
      } ${className}`}
    >
      {renderIcon()}
      <span>{busy ? busyLabel : saved ? savedLabel : label}</span>
    </button>
  );
}
