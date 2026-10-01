/**
 * Metric-entry validation. Never silently overwrites: an existing entry for
 * the same (client, metric, date) must be shown and confirmed.
 */
import { CORE_METRICS } from "@/config/metrics";
import { daysBetween } from "./dates";

export interface MetricDef {
  key: string;
  label: string;
  type: "number" | "scale_1_10" | "boolean" | "time" | "text";
  unit: string | null;
}

export interface EntryValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  needsConfirmation: boolean;
  existing: { value_num: number | null; value_text: string | null } | null;
  value_num: number | null;
  value_text: string | null;
}

/** Parse "mm:ss", "h:mm:ss" or plain minutes into minutes. */
export function parseTime(s: string): number | null {
  const t = s.trim();
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const parts = t.split(":").map(Number);
  if (parts.some((p) => Number.isNaN(p))) return null;
  if (parts.length === 2) return parts[0] + parts[1] / 60;
  if (parts.length === 3) return parts[0] * 60 + parts[1] + parts[2] / 60;
  return null;
}

export function validateEntry(p: {
  metric: MetricDef;
  raw: string;
  date: string;
  previous?: { date: string; value_num: number | null } | null;
  existing?: { value_num: number | null; value_text: string | null } | null;
  confirmed?: boolean;
}): EntryValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  let value_num: number | null = null;
  let value_text: string | null = null;
  const raw = p.raw.trim();
  const seed = CORE_METRICS.find((m) => m.key === p.metric.key);

  switch (p.metric.type) {
    case "text":
      value_text = raw;
      if (!raw) errors.push("Enter a value.");
      break;
    case "boolean": {
      const v = raw.toLowerCase();
      if (["y", "yes", "true", "1"].includes(v)) value_num = 1;
      else if (["n", "no", "false", "0"].includes(v)) value_num = 0;
      else errors.push("Enter yes or no.");
      break;
    }
    case "time": {
      const m = parseTime(raw);
      if (m == null) errors.push("Enter minutes or mm:ss.");
      else {
        value_num = m;
        value_text = raw;
      }
      break;
    }
    case "scale_1_10": {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 1 || n > 10) errors.push("Enter a number from 1 to 10.");
      else value_num = n;
      break;
    }
    default: {
      const n = Number(raw);
      if (raw === "" || !Number.isFinite(n)) errors.push("Enter a number.");
      else {
        value_num = n;
        if (seed?.min != null && n < seed.min) errors.push(`${p.metric.label} below plausible minimum (${seed.min}).`);
        if (seed?.max != null && n > seed.max) errors.push(`${p.metric.label} above plausible maximum (${seed.max}).`);
      }
    }
  }

  if (!errors.length && value_num != null && seed?.maxDailyChange && p.previous?.value_num != null) {
    const days = Math.max(1, Math.abs(daysBetween(p.previous.date, p.date)));
    const change = Math.abs(value_num - p.previous.value_num);
    if (change / days > seed.maxDailyChange) {
      warnings.push(`${p.metric.label} changed ${change.toFixed(1)} ${p.metric.unit ?? ""} in ${days} day${days > 1 ? "s" : ""} (previous ${p.previous.value_num} on ${p.previous.date}). Is that right?`);
    }
  }
  const existing = p.existing ?? null;
  const differs = existing && (existing.value_num !== value_num || (existing.value_text ?? null) !== (value_text ?? null));
  if (existing && differs) {
    warnings.push(`An entry already exists for ${p.date}: ${existing.value_text ?? existing.value_num}. Saving will replace it.`);
  }
  const needsConfirmation = warnings.length > 0 && !p.confirmed;
  return { ok: errors.length === 0 && !needsConfirmation, errors, warnings, needsConfirmation, existing, value_num, value_text };
}
