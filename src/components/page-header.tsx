import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Page header: MTTM Lettering for short static labels, Manrope for anything
 * dynamic (names, dates) so long values never wrap into a wide-letter stack.
 */
export function PageHeader({ back, eyebrow, title, display, badge, meta, actions }: { back?: { href: string; label: string }; eyebrow?: string; title: ReactNode; display?: boolean; badge?: ReactNode; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="space-y-3">
      {back && (
        <Link href={back.href} className="inline-flex min-h-[32px] items-center text-sm text-stone no-underline hover:text-bone">
          ← {back.label}
        </Link>
      )}
      <div className="space-y-2">
        {eyebrow && <p className="label mb-0">{eyebrow}</p>}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className={display ? undefined : "title"}>{title}</h1>
          {badge}
        </div>
        {meta && <div className="muted">{meta}</div>}
      </div>
      {actions && <div className="actions">{actions}</div>}
    </header>
  );
}
