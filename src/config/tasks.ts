/** Task-rule thresholds (defaults; editable in Settings → "task_thresholds"). */
export const TASK_THRESHOLDS = {
  outreachDays: 7,
  weighInMissingDays: 8,
  adherenceWindowDays: 14,
  adherenceLowPct: 70,
  energyLow: 5,
  strengthRetentionPct: 95,
  trainingGapDays: 7,
  clearanceFollowUpDays: 7,
  prospectFollowUpDays: 5,
  recheckWeeksAfterEnd: 5,
  /** hour (trainer local time) on Monday after which a missing Sunday weigh-in is overdue */
  weighInOverdueHour: 12,
  dailyDigest: false,
};
export type TaskThresholds = typeof TASK_THRESHOLDS;

export const DEFAULT_DISCLAIMER =
  "The nutrition targets and examples in this plan are estimates provided for educational purposes only. They are not medical advice and do not replace individualized guidance from a registered dietitian or physician. If you have a medical condition, are pregnant or breastfeeding, take medication, or have a history of disordered eating, consult a registered dietitian or physician before changing your diet.";
