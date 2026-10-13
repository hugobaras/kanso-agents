"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

/** Native <dialog> (focus trap, Esc, inert background handled by the browser). */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-xl border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/30 backdrop:backdrop-blur-[2px] open:animate-slide-up",
        size === "sm" ? "max-w-md" : size === "lg" ? "max-w-2xl" : "max-w-lg",
      )}
    >
      {open && (
        <div>
          <div className="flex items-start justify-between gap-4 px-6 pt-5">
            <div>
              <h2 className="font-display text-xl">{title}</h2>
              {description && <div className="mt-1 text-sm text-muted">{description}</div>}
            </div>
            <button onClick={onClose} className="rounded p-1 text-subtle hover:bg-sunken hover:text-ink" aria-label="Fermer">
              <X className="size-4.5" />
            </button>
          </div>
          {children && <div className="px-6 py-4">{children}</div>}
          {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmer",
  danger,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
