"use client";
import { useEffect, useState } from "react";

/** Type-to-filter for any list: hides rows (data-filter="…text…") inside #target. */
export function ListFilter({ target, placeholder = "Search", noun = "results" }: { target: string; placeholder?: string; noun?: string }) {
  const [q, setQ] = useState("");
  const [shown, setShown] = useState<number | null>(null);
  useEffect(() => {
    const rows = Array.from(document.querySelectorAll<HTMLElement>(`#${target} [data-filter]`));
    const needle = q.trim().toLowerCase();
    let n = 0;
    for (const r of rows) {
      const hit = !needle || (r.dataset.filter ?? "").includes(needle);
      r.hidden = !hit;
      if (hit) n++;
    }
    setShown(needle ? n : null);
  }, [q, target]);
  return (
    <div className="space-y-1.5">
      <input className="input" type="search" inputMode="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
      {shown != null && <p className="text-xs text-muted">{shown === 0 ? `No ${noun} match “${q.trim()}”.` : `${shown} ${noun}`}</p>}
    </div>
  );
}
