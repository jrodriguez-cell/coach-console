/** Date helpers operating on ISO calendar dates (YYYY-MM-DD), timezone-free. */

export type ISODate = string;

function toUTC(d: ISODate): number {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
}

export function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromUTC(toUTC(d) + n * 86400000);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(d: ISODate): number {
  return new Date(toUTC(d)).getUTCDay();
}

/** The Sunday on or before d. */
export function sundayOnOrBefore(d: ISODate): ISODate {
  return addDays(d, -dayOfWeek(d));
}

/** The Monday on or before d. */
export function mondayOnOrBefore(d: ISODate): ISODate {
  return addDays(d, -((dayOfWeek(d) + 6) % 7));
}

/** Plan week (1-based) that date d falls in; <1 before start. */
export function planWeek(startDate: ISODate, d: ISODate): number {
  return Math.floor(daysBetween(startDate, d) / 7) + 1;
}

export function weekStart(startDate: ISODate, week: number): ISODate {
  return addDays(startDate, (week - 1) * 7);
}

export function maxDate(a: ISODate | null | undefined, b: ISODate | null | undefined): ISODate | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a > b ? a : b;
}

/** Today's date in the given IANA time zone. */
export function todayIn(tz: string = process.env.TRAINER_TIMEZONE || "America/New_York", now: Date = new Date()): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Hour of day (0–23) in the given time zone. */
export function hourIn(tz: string = process.env.TRAINER_TIMEZONE || "America/New_York", now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hourCycle: "h23" }).format(now));
}

export function formatDate(d: ISODate | null | undefined): string {
  if (!d) return "—";
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
