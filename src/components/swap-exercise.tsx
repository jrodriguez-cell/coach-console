"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { addExerciseAction, removeExerciseAction, swapExerciseAction } from "@/app/actions/plans";
import { toast } from "./toaster";

type Opt = { id: string; name: string; group?: string };

function Scope({ value, onChange, blocks }: { value: "block" | "plan"; onChange: (v: "block" | "plan") => void; blocks: boolean }) {
  if (!blocks) return null;
  return (
    <div className="mb-2 flex gap-1 text-xs" role="radiogroup" aria-label="Apply to">
      {(["block", "plan"] as const).map((v) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)} className={clsx("border px-2.5 py-1.5 font-semibold", value === v ? "border-fg bg-fg text-canvas" : "border-fg/30")}>
          {v === "block" ? "This 4-week block" : "Whole plan"}
        </button>
      ))}
    </div>
  );
}

function Picker({ options, onPick, pending, placeholder }: { options: Opt[]; onPick: (o: Opt) => void; pending: boolean; placeholder: string }) {
  const [q, setQ] = useState("");
  const list = options.filter((o) => o.name.toLowerCase().includes(q.toLowerCase()) || (o.group ?? "").toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <input className="input mb-1 text-sm" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} aria-label={placeholder} />
      <ul className="max-h-60 divide-y divide-fg/10 overflow-y-auto">
        {list.map((o) => (
          <li key={o.id}>
            <button type="button" disabled={pending} onClick={() => onPick(o)} className="flex min-h-[40px] w-full items-center justify-between gap-2 text-left text-sm hover:bg-fg/[0.04] disabled:opacity-50">
              <span>{o.name}</span>{o.group && <span className="shrink-0 text-xs text-muted">{o.group}</span>}
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="py-2 text-sm text-muted">No matches.</li>}
      </ul>
    </>
  );
}

/** Swap or remove one exercise in the program (drafts and approved plans). */
export function ExerciseActions({ planId, slotId, current, options, blocks, removable = true }: { planId: string; slotId: string; current: string; options: Opt[]; blocks: boolean; removable?: boolean }) {
  const [open, setOpen] = useState<"swap" | "remove" | null>(null);
  const [scope, setScope] = useState<"block" | "plan">("block");
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<{ error: string | null }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (r.error) return toast(r.error, "info");
      toast(ok);
      setOpen(null);
      router.refresh();
    });
  return (
    <div className="mt-1">
      <div className="flex gap-3 text-xs">
        {options.length > 0 && <button type="button" className="underline decoration-fg/40 underline-offset-4" aria-expanded={open === "swap"} onClick={() => setOpen(open === "swap" ? null : "swap")}>⇄ Swap</button>}
        {removable && <button type="button" className="text-muted underline decoration-fg/30 underline-offset-4" aria-expanded={open === "remove"} onClick={() => setOpen(open === "remove" ? null : "remove")}>Remove</button>}
      </div>
      {open === "swap" && (
        <div className="mt-1 border border-fg/20 p-2">
          <Scope value={scope} onChange={setScope} blocks={blocks} />
          <Picker options={options.filter((o) => o.name !== current)} pending={pending} placeholder={`Swap ${current} for…`} onPick={(o) => run(() => swapExerciseAction(planId, slotId, o.id, scope), `Swapped to ${o.name}`)} />
        </div>
      )}
      {open === "remove" && (
        <div className="mt-1 border border-fg/20 p-2 text-sm">
          <Scope value={scope} onChange={setScope} blocks={blocks} />
          <p className="mb-2">Remove {current} from this session{blocks ? (scope === "plan" ? " for this and later blocks" : " for this 4-week block") : ""}?</p>
          <button type="button" disabled={pending} className="btn btn-sm" onClick={() => run(() => removeExerciseAction(planId, slotId, scope), `Removed ${current}`)}>Remove</button>
        </div>
      )}
    </div>
  );
}

/** Add an exercise to a session (searchable library that fits the client). */
export function AddExercise({ planId, sessionKey, sessionName, options, blocks }: { planId: string; sessionKey: string; sessionName: string; options: Opt[]; blocks: boolean }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"block" | "plan">("plan");
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div className="mt-2">
      <button type="button" className="btn btn-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Close" : "+ Add exercise"}</button>
      {open && (
        <div className="mt-2 border border-fg/20 p-2">
          <Scope value={scope} onChange={setScope} blocks={blocks} />
          <Picker options={options} pending={pending} placeholder={`Add to ${sessionName}… (search name or type, e.g. core)`} onPick={(o) => start(async () => {
            const r = await addExerciseAction(planId, sessionKey, o.id, scope);
            if (r.error) return toast(r.error, "info");
            toast(`Added ${o.name}`);
            setOpen(false);
            router.refresh();
          })} />
        </div>
      )}
    </div>
  );
}
