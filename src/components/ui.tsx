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
const TONES: Record<Tone, string> = {
  gray: "bg-slate-800 text-slate-300 border-slate-800",
  green: "bg-green-950/40 text-green-300 border-green-900",
  yellow: "bg-amber-950/40 text-amber-300 border-amber-900",
  red: "bg-red-950/40 text-red-300 border-red-900",
  blue: "bg-blue-950/40 text-blue-300 border-blue-900",
  purple: "bg-purple-950/40 text-purple-300 border-purple-900",
};

export function Badge({ tone = "gray", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={clsx("inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium", TONES[tone])}>
      {children}
    </span>
  );
}

export function Banner({ tone = "yellow", title, children }: { tone?: Tone; title: ReactNode; children?: ReactNode }) {
  return (
    <div className={clsx("rounded-lg border p-3", TONES[tone])}>
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
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function Stat({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-50">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
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
