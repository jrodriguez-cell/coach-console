"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const NAV = [
  { href: "/today", label: "Today", short: "Today", icon: "M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/clients", label: "Clients", short: "Clients", icon: "M16 19v-1a4 4 0 00-4-4H6a4 4 0 00-4 4v1M9 10a3 3 0 100-6 3 3 0 000 6zM22 19v-1a4 4 0 00-3-3.87M16 4.13a3 3 0 010 5.74" },
  { href: "/progress", label: "Progress", short: "Progress", icon: "M3 17l6-6 4 4 8-8M15 7h6v6" },
  { href: "/entry", label: "Weekly round", short: "Round", icon: "M9 11l3 3 8-8M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9" },
  { href: "/settings", label: "Settings", short: "Settings", icon: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" },
];

const isActive = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** Desktop: inline links in the top bar. */
export function TopNavLinks() {
  const path = usePathname();
  return (
    <div className="hidden items-center gap-1 lg:flex">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={clsx(
            "border-b-2 px-3 py-2 text-sm font-medium no-underline hover:no-underline",
            isActive(path, n.href) ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg",
          )}
        >
          {n.label}
        </Link>
      ))}
    </div>
  );
}

const SETTINGS_ICON = NAV.find((n) => n.href === "/settings")!.icon;
const LOG = { href: "/log", label: "Log", short: "Log", icon: "M12 5v14M5 12h14" };
// Phones: Settings moves to the header so the centre slot can hold Log.
const BOTTOM = [NAV[0], NAV[1], LOG, NAV[2], NAV[3]];

/** Settings gear for the phone header (desktop has it in the top nav). */
export function SettingsIconLink() {
  const path = usePathname();
  return (
    <Link href="/settings" aria-label="Settings" className={clsx("ml-auto flex h-10 w-10 items-center justify-center no-underline lg:hidden", isActive(path, "/settings") ? "text-fg" : "text-muted")}>
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={SETTINGS_ICON} />
      </svg>
    </Link>
  );
}

/** Phones: fixed bottom tab bar within thumb reach; Log is the centre action. */
export function BottomTabBar() {
  const path = usePathname();
  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-fg/15 bg-canvas lg:hidden">
      <div className="grid grid-cols-5">
        {BOTTOM.map((n) => {
          const on = isActive(path, n.href);
          if (n.href === "/log")
            return (
              <Link key={n.href} href={n.href} aria-label="Log data" className="flex items-center justify-center py-1.5 no-underline hover:no-underline">
                <span className={clsx("flex h-11 w-11 items-center justify-center", on ? "bg-fg/80 text-canvas" : "bg-fg text-canvas")}>
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden><path d={n.icon} /></svg>
                </span>
              </Link>
            );
          return (
            <Link
              key={n.href}
              href={n.href}
              className={clsx("-mt-px flex flex-col items-center gap-1 border-t py-2 text-[11px] no-underline hover:no-underline", on ? "border-fg text-fg" : "border-transparent text-muted")}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={n.icon} />
              </svg>
              {n.short}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
