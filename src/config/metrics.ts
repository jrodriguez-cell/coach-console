/**
 * Core metric definitions (seeded into metric_definitions). Core metrics feed
 * calculations: they can be made optional or hidden but never deleted.
 */
export type MetricType = "number" | "scale_1_10" | "boolean" | "time" | "text";
export type MetricFrequency = "daily" | "weekly" | "checkpoint" | "ad_hoc";

export interface MetricSeed {
  key: string;
  label: string;
  type: MetricType;
  unit: string | null;
  frequency: MetricFrequency;
  is_core: boolean;
  required: boolean;
  active: boolean;
  show_in_charts: boolean;
  display_order: number;
  /** plausible bounds for validation */
  min?: number;
  max?: number;
  /** max plausible change from the previous entry per day */
  maxDailyChange?: number;
}

export const CORE_METRICS: MetricSeed[] = [
  { key: "weight_lb", label: "Weight", type: "number", unit: "lb", frequency: "weekly", is_core: true, required: true, active: true, show_in_charts: true, display_order: 10, min: 60, max: 700, maxDailyChange: 5 },
  { key: "adherence_pct", label: "Adherence (weekly)", type: "number", unit: "%", frequency: "weekly", is_core: true, required: true, active: true, show_in_charts: true, display_order: 20, min: 0, max: 100 },
  { key: "energy_1_10", label: "Energy (avg)", type: "scale_1_10", unit: null, frequency: "weekly", is_core: true, required: true, active: true, show_in_charts: true, display_order: 30, min: 1, max: 10 },
  { key: "sleep_hrs", label: "Sleep (avg hrs)", type: "number", unit: "hrs", frequency: "weekly", is_core: true, required: true, active: true, show_in_charts: true, display_order: 40, min: 0, max: 16 },
  { key: "calories", label: "Calories", type: "number", unit: "kcal", frequency: "daily", is_core: true, required: false, active: true, show_in_charts: true, display_order: 50, min: 0, max: 10000 },
  { key: "protein_g", label: "Protein", type: "number", unit: "g", frequency: "daily", is_core: true, required: false, active: true, show_in_charts: true, display_order: 60, min: 0, max: 600 },
  { key: "carbs_g", label: "Carbs", type: "number", unit: "g", frequency: "daily", is_core: true, required: false, active: true, show_in_charts: false, display_order: 70, min: 0, max: 1500 },
  { key: "fat_g", label: "Fat", type: "number", unit: "g", frequency: "daily", is_core: true, required: false, active: true, show_in_charts: false, display_order: 80, min: 0, max: 500 },
  { key: "cardio_min", label: "Cardio minutes", type: "number", unit: "min", frequency: "weekly", is_core: true, required: false, active: true, show_in_charts: true, display_order: 90, min: 0, max: 2000 },
  { key: "steps", label: "Steps (avg/day)", type: "number", unit: "steps", frequency: "weekly", is_core: true, required: false, active: true, show_in_charts: true, display_order: 100, min: 0, max: 80000 },
  { key: "stress_1_10", label: "Stress (avg)", type: "scale_1_10", unit: null, frequency: "weekly", is_core: true, required: false, active: true, show_in_charts: true, display_order: 110, min: 1, max: 10 },
  { key: "soreness_1_10", label: "Soreness", type: "scale_1_10", unit: null, frequency: "weekly", is_core: false, required: false, active: true, show_in_charts: true, display_order: 120, min: 1, max: 10 },
  { key: "notes", label: "Notes", type: "text", unit: null, frequency: "ad_hoc", is_core: false, required: false, active: true, show_in_charts: false, display_order: 130 },
];

export const CORE_METRIC_KEYS = new Set(CORE_METRICS.filter((m) => m.is_core).map((m) => m.key));

export const MEASUREMENT_SITES = ["waist", "chest", "hips", "arm", "thigh", "calf", "neck"] as const;
export type MeasurementSite = (typeof MEASUREMENT_SITES)[number];
