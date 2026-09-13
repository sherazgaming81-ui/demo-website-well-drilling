"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { Icon } from "@/components/icons";

export function Modal({ children, onClose, labelledBy, className = "" }: { children: ReactNode; onClose: () => void; labelledBy: string; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, []);
  return <dialog ref={ref} className={`modal ${className}`} aria-labelledby={labelledBy} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <button type="button" className="modal-close icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close" size={19} /></button>
    {children}
  </dialog>;
}
