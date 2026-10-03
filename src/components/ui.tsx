import clsx from "clsx";
import Link from "next/link";
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
  gray: "border-fg/15 text-muted",
  green: "border-fg/20 text-muted",
  yellow: "border-fg text-fg",
  red: "border-fg bg-fg text-canvas",
  blue: "border-fg/30 text-fg",
  purple: "border-fg/30 text-fg",
};

export function Badge({ tone = "gray", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span title={title} className={clsx("caps inline-flex shrink-0 items-center whitespace-nowrap border px-1.5 py-1 text-[10px]", TONES[tone])}>
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
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Stat({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="panel p-3">
      <div className="caps">{label}</div>
      <div className="mt-1 text-lg font-semibold text-fg">{value}</div>
      {sub && <div className="text-xs text-muted">{sub}</div>}
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

/** Underlined tab strip; scrolls sideways on narrow screens. */
export function TabBar({ tabs, active, href }: { tabs: { key: string; label: string }[]; active: string; href: (key: string) => string }) {
  return (
    <nav className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto border-b border-fg/15 px-4 sm:mx-0 sm:px-0" aria-label="Sections">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={href(t.key)}
          aria-current={t.key === active ? "page" : undefined}
          className={clsx("-mb-px shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium no-underline hover:no-underline", t.key === active ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg")}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** A section that starts folded: title row is the toggle; detail on demand. */
export function Collapsible({ title, hint, children, defaultOpen = false }: { title: ReactNode; hint?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="card group" open={defaultOpen}>
      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <h2>{title}</h2>
          {hint && <span className="mt-0.5 block text-sm text-muted">{hint}</span>}
        </span>
        <span aria-hidden className="shrink-0 text-xl leading-none text-muted transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
