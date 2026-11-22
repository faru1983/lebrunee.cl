"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidthClass?: string;
}

export function ModalDialog({
  open,
  onClose,
  title,
  children,
  maxWidthClass = "max-w-lg",
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const pressedOutsideRef = useRef(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  const isOutside = (e: React.PointerEvent<HTMLDialogElement>, dialog: HTMLDialogElement) => {
    const r = dialog.getBoundingClientRect();
    return (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    );
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onPointerDown={(e) => {
        if (dialogRef.current) {
          pressedOutsideRef.current = isOutside(e, dialogRef.current);
        }
      }}
      onPointerUp={(e) => {
        if (
          dialogRef.current &&
          pressedOutsideRef.current &&
          isOutside(e, dialogRef.current)
        ) {
          onClose();
        }
        pressedOutsideRef.current = false;
      }}
      className={`m-auto w-[calc(100%-1.5rem)] ${maxWidthClass} rounded-3xl border border-[#f1dfe8] bg-white p-0 text-[#1f141b] shadow-2xl`}
    >
      <div className="flex items-center justify-between border-b border-[#f5e7ee] px-5 py-4">
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar ventana"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="max-h-[80dvh] overflow-y-auto p-5">{children}</div>
    </dialog>
  );
}
