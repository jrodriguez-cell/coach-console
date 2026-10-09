"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSkillGoalAction } from "@/app/actions/plans";
import { SKILL_KEYS, SKILLS, type SkillKey } from "@/config/skills";
import { toast } from "./toaster";

const PHRASE: Record<SkillKey, string> = { l_sit: "an L-sit", pull_up: "a pull-up", push_up: "a push-up", handstand: "a handstand", pistol_squat: "a pistol squat", toe_touch: "touching their toes" };

/**
 * Add (or change, or remove) the client's skill-goal work in this program
 * without regenerating: the skill step opens every session and its prep
 * work is shared across the week.
 */
export function SkillGoalControl({ planId, current, detected, clientName }: { planId: string; current: SkillKey | null; detected: SkillKey | null; clientName: string }) {
  const [value, setValue] = useState<string>(current ?? detected ?? "none");
  const [pending, start] = useTransition();
  const router = useRouter();
  const apply = (v: string) =>
    start(async () => {
      const r = await setSkillGoalAction(planId, v);
      if (r.error) return toast(r.error, "info");
      toast(r.message ?? "Updated");
      router.refresh();
    });
  const missing = detected && current !== detected;
  return (
    <div className={missing ? "note-warn p-3" : "panel"}>
      {missing ? (
        <p className="mb-2 text-sm"><b>{clientName}&apos;s goals mention {PHRASE[detected]}, but this program {current ? `is built around the ${SKILLS[current].label}` : "has no work for it"}.</b> Add it to every session: the {SKILLS[detected].label} step first while fresh, plus prep work that builds it.</p>
      ) : (
        <p className="mb-2 text-sm text-muted">Skill goal: build a specific movement into every session (step-by-step progression plus prep work). No regeneration needed.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto min-w-[12rem]" value={value} onChange={(e) => setValue(e.target.value)} aria-label="Skill goal">
          <option value="none">No skill goal</option>
          {SKILL_KEYS.map((k) => <option key={k} value={k}>{SKILLS[k].label}{k === detected ? " (from their goals)" : ""}</option>)}
        </select>
        <button type="button" className={missing ? "btn btn-primary" : "btn"} disabled={pending || value === (current ?? "none")} onClick={() => apply(value)}>
          {pending ? "Updating…" : value === "none" ? "Remove skill work" : current ? `Switch to ${SKILLS[value as SkillKey].label}` : `Add ${SKILLS[value as SkillKey].label} work`}
        </button>
      </div>
    </div>
  );
}
