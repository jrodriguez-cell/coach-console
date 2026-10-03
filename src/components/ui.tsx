import clsx from "clsx";
import type { ReactNode } from "react";

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("card", className)}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title ? <h2>{title}</h2> : <span />}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export type Tone = "gray" | "green" | "yellow" | "red" | "blue" | "purple";
// Brand allows Ink, Bone and Stone only: tone is carried by fill and weight.
const TONES: Record<Tone, string> = {
  gray: "border-bone/15 text-stone",
  green: "border-bone/15 text-stone",
  yellow: "border-bone text-bone",
  red: "border-bone bg-bone text-ink",
  blue: "border-bone/30 text-bone",
  purple: "border-bone/30 text-bone",
};

export function Badge({ tone = "gray", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={clsx("inline-flex shrink-0 items-center whitespace-nowrap border px-1.5 py-1 font-display text-[9px] font-extrabold uppercase leading-none", TONES[tone])}>
      {children}
    </span>
  );
}

export function Banner({ tone = "yellow", title, children }: { tone?: Tone; title: ReactNode; children?: ReactNode }) {
  return (
    <div className={clsx("border p-3 sm:p-4", TONES[tone])}>
      <div className="font-semibold">{title}</div>
      {children && <div className="mt-1 text-sm">{children}</div>}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone">{hint}</span>}
    </label>
  );
}

export function Stat({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="border border-bone/15 p-3">
      <div className="label mb-0">{label}</div>
      <div className="mt-1 text-lg font-semibold text-bone">{value}</div>
      {sub && <div className="text-xs text-stone">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="muted py-2">{children}</p>;
}

export function statusTone(s: "ok" | "warn" | "blocked"): Tone {
  return s === "ok" ? "green" : s === "warn" ? "yellow" : "red";
}

export const fmt = {
  n: (v: number | null | undefined, d = 0) => (v == null || Number.isNaN(v) ? "—" : v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })),
  signed: (v: number | null | undefined, d = 1) => (v == null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}`),
  pct: (v: number | null | undefined, d = 0) => (v == null ? "—" : `${v.toFixed(d)}%`),
};
