"use client";
import { useEffect, useRef, useState } from "react";

const EVENT = "coach-toast";

/** Show a short confirmation ("Saved") from any client component; `info` drops the tick (for problems). */
export function toast(message: string, kind: "ok" | "info" = "ok") {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT, { detail: { message, kind } }));
}

/** Fire a toast once each time `when` becomes true for a new `key`. */
export function useToastOn(when: boolean, message: string, key?: unknown) {
  const last = useRef<unknown>(undefined);
  useEffect(() => {
    if (when && last.current !== key) {
      last.current = key;
      toast(message);
    }
    if (!when) last.current = undefined;
  }, [when, message, key]);
}

export function Toaster() {
  const [msg, setMsg] = useState<{ message: string; kind: "ok" | "info" } | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      setMsg((e as CustomEvent<{ message: string; kind: "ok" | "info" }>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMsg(null), 2600);
    };
    window.addEventListener(EVENT, on);
    return () => {
      window.removeEventListener(EVENT, on);
      clearTimeout(timer);
    };
  }, []);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex justify-center px-4 lg:bottom-8">
      {msg && <div role={msg.kind === "info" ? "alert" : undefined} className="flex items-center gap-2 bg-fg px-4 py-3 text-sm font-semibold text-canvas shadow-none">{msg.kind === "ok" ? "✓ " : ""}{msg.message}</div>}
    </div>
  );
}
