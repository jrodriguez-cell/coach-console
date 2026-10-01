/**
 * Energy-model configuration. Seed values; the trainer should verify MET values
 * against the Compendium of Physical Activities before relying on them.
 */

export const KCAL_PER_LB = 3500; // planning approximation only — shown as such in the UI
export const LB_PER_KG = 2.20462;
export const CM_PER_IN = 2.54;

/** Thermic effect of food, as a fraction of intake. */
export const TEF_FRACTION = 0.1;

/**
 * Non-exercise activity factors (occupation + daily living only).
 * These deliberately EXCLUDE exercise — do not substitute the classic
 * 1.2–1.9 "activity multipliers", which already include training.
 */
export const NEAT_FACTORS = {
  sedentary: { factor: 1.2, label: "Sedentary (desk job, little walking)" },
  on_feet_part: { factor: 1.3, label: "On feet part of the day" },
  on_feet_most: { factor: 1.4, label: "On feet most of the day" },
  physical_job: { factor: 1.55, label: "Physical job" },
} as const;
export type NeatLevel = keyof typeof NEAT_FACTORS;

/** MET seed table (Compendium of Physical Activities; trainer to verify). */
export const METS = {
  resistance_moderate: { met: 3.5, label: "Resistance training, light/moderate" },
  resistance_vigorous: { met: 6.0, label: "Resistance training, vigorous" },
  walking: { met: 3.5, label: "Walking, moderate pace" },
  walking_brisk: { met: 4.3, label: "Walking, brisk" },
  jogging: { met: 7.0, label: "Jogging" },
  running: { met: 9.8, label: "Running" },
  cycling_moderate: { met: 6.8, label: "Cycling, moderate" },
  mobility: { met: 2.3, label: "Stretching / mobility" },
  yoga: { met: 2.5, label: "Yoga" },
} as const;
export type Activity = keyof typeof METS;

/**
 * Uncertainty on TDEE, used as the half-width of the ~80% band on the
 * predicted weekly change. Editable in Settings.
 */
export const UNCERTAINTY = {
  formula: 0.1,
  measured: 0.12,
  calibrated: 0.05,
} as const;

/** Minimum wearable averaging window for measured mode. */
export const MEASURED_MIN_DAYS = 14;

/** Default daily balance by goal (kcal; positive = deficit, negative = surplus). */
export const DEFAULT_DEFICIT = {
  weight_loss: 400,
  muscle_gain: -300,
  general_health: 0,
  performance: 0,
} as const;

/** Adherence tolerance on calories (fraction of target). */
export const CALORIE_TOLERANCE_FRACTION = 0.05;
export const PROTEIN_TOLERANCE_G = 10;
export const CARB_TOLERANCE_G = 15;
export const FAT_TOLERANCE_G = 5;

/** Calibration settings. */
export const CALIBRATION = {
  minPoints: 3,
  minSpanDays: 14,
  excludeFirstDays: 14, // weeks 1–2: water/glycogen shifts
  adherenceThresholdPct: 85,
  maxAdjustmentKcal: 150,
  defaultCheckpointWeeks: { weight_loss: [3, 8, 11], muscle_gain: [4, 8, 12], general_health: [4, 8, 12], performance: [4, 8, 12] },
} as const;
