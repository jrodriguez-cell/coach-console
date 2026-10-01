"use client";
import { useFormStatus } from "react-dom";
import clsx from "clsx";

export function SubmitButton({ children, className, pendingText, name, value, confirm }: { children: React.ReactNode; className?: string; pendingText?: string; name?: string; value?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={clsx("btn", className)}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {pending ? pendingText ?? "Working…" : children}
    </button>
  );
}
