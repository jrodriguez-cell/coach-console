import "server-only";
/**
 * Claude-backed exercise selector. Server-only. Sends no names, contact
 * details, PAR-Q answers or injury/medical text — only the training context
 * needed to choose among pre-filtered candidates.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z as z4 } from "zod/v4";
import { buildRequest, SelectionError, validateSelection, type Selector } from "./selection";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";

// Shape-only schema for structured output; the refined checks live in validateSelection.
const OutputShape = z4.object({
  choices: z4.array(z4.object({ slot_id: z4.string(), exercise_code: z4.string(), note: z4.string() })),
  coaching_notes: z4.array(z4.string()),
  program_summary: z4.string(),
});

const SYSTEM = `You help an ISSA-certified personal trainer draft client programs. A deterministic calculator has already set every number (sets, reps, rest, RPE, cardio minutes, calories). Your only jobs:
1. For each slot, choose exactly one exercise from that slot's candidate list (use its code). Do not repeat an exercise within a session. Prefer variety across sessions, the client's likes, and exercises that fit their goal and experience.
2. Write a short coaching note for each slot: a technique cue or focus. Plain words only.
3. Write three to six short coaching notes for the program and a brief program summary (two to four sentences).

Hard rules:
- Never write numerals (no digits at all). Do not state sets, reps, weights, durations, heart rates, calories or percentages; the calculator provides them.
- Do not give medical, injury, rehabilitation, mental-health or nutrition advice. Do not diagnose.
- These are drafts for the trainer to review; write to the trainer, concisely.
Return only JSON matching the schema.`;

export const claudeSelector: Selector = async (sk, client) => {
  if (!process.env.ANTHROPIC_API_KEY) throw new SelectionError("ANTHROPIC_API_KEY is not set; cannot draft exercise selection.");
  const anthropic = new Anthropic();
  const { request, codeToId } = buildRequest(sk, client);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `Draft the exercise selection for this program.\n\n${JSON.stringify(request, null, 2)}` },
  ];
  let lastErrors: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    let text = "";
    try {
      const res = await anthropic.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        system: SYSTEM,
        messages,
        output_config: { effort: "medium", format: betaZodOutputFormat(OutputShape) },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
      if (res.stop_reason === "refusal") throw new SelectionError("The model declined to draft this selection.");
      if (res.stop_reason === "max_tokens") throw new SelectionError("The model's response was cut off.");
      for (const b of res.content) if (b.type === "text") text += b.text;
      messages.push({ role: "assistant", content: res.content.filter((b) => b.type === "text") });
    } catch (e) {
      if (e instanceof SelectionError) throw e;
      if (e instanceof Anthropic.APIError) throw new SelectionError(`Anthropic API error (${e.status ?? "network"}). Try again.`);
      throw e;
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      lastErrors = ["Response was not valid JSON."];
      messages.push({ role: "user", content: `Your response was not valid JSON. Return only the JSON object.` });
      continue;
    }
    const v = validateSelection(json, request, codeToId);
    if (v.ok) return { ...v.value, source: "llm" };
    lastErrors = v.errors;
    messages.push({ role: "user", content: `The JSON failed validation:\n- ${v.errors.slice(0, 20).join("\n- ")}\nFix these problems and return the full JSON again.` });
  }
  throw new SelectionError("The drafted exercise selection failed validation twice, so it was not used.", lastErrors);
};
