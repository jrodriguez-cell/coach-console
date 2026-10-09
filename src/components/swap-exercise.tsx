"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { swapExerciseAction } from "@/app/actions/plans";
import { toast } from "./toaster";

/** One-tap exercise swap for a plan slot (approved plans included). */
export function SwapExercise({ planId, slotId, current, options }: { planId: string; slotId: string; current: string; options: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  const list = options.filter((o) => o.name !== current && o.name.toLowerCase().includes(q.toLowerCase()));
  if (!options.length) return null;
  return (
    <div className="mt-1">
      <button type="button" className="text-xs text-fg underline decoration-fg/40 underline-offset-4" onClick={() => setOpen((o) => !o)} aria-expanded={open}>⇄ Swap</button>
      {open && (
        <div className="mt-1 border border-fg/20 p-2">
          <input className="input mb-1 text-sm" placeholder="Search alternatives" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search alternatives" />
          <ul className="max-h-56 divide-y divide-fg/10 overflow-y-auto">
            {list.map((o) => (
              <li key={o.id}>
                <button type="button" disabled={pending} className="min-h-[40px] w-full text-left text-sm hover:bg-fg/[0.04] disabled:opacity-50" onClick={() => start(async () => {
                  const r = await swapExerciseAction(planId, slotId, o.id);
                  if (r.error) return toast(r.error, "info");
                  toast(`Swapped to ${r.name}`);
                  setOpen(false);
                  router.refresh();
                })}>{o.name}</button>
              </li>
            ))}
            {list.length === 0 && <li className="py-2 text-sm text-muted">No matches.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
