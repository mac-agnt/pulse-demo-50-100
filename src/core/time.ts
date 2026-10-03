/* Dates against the configured reference date and timezone, so "overdue",
   "today" and relative labels all agree with each other. */

export const HOUR = 3600_000;
export const DAY = 24 * HOUR;

export const ms = (iso?: string | null) => (iso ? new Date(iso).getTime() : NaN);
export const iso = (t: number) => new Date(t).toISOString();
export const addHours = (at: string, h: number) => iso(ms(at) + h * HOUR);
export const addDays = (at: string, d: number) => iso(ms(at) + d * DAY);

/** Calendar date in the configured timezone, as YYYY-MM-DD. */
export function localDay(at: string, tz: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
  return p;
}

export function fmtDate(at: string | undefined, tz: string, withTime = false): string {
  if (!at) return "None";
  const o: Intl.DateTimeFormatOptions = { timeZone: tz, day: "numeric", month: "short" };
  if (withTime) Object.assign(o, { hour: "2-digit", minute: "2-digit", hour12: false });
  return new Intl.DateTimeFormat("en-GB", o).format(new Date(at));
}

export function fmtDateTime(at: string | undefined, tz: string): string {
  return fmtDate(at, tz, true);
}

/** "in 3 h", "2 d ago", "today 14:00" relative to now. */
export function relative(at: string | undefined, now: string, tz: string): string {
  if (!at) return "No date";
  const d = ms(at) - ms(now);
  const abs = Math.abs(d);
  const sameDay = localDay(at, tz) === localDay(now, tz);
  if (abs < HOUR) {
    const m = Math.max(1, Math.round(abs / 60000));
    return d >= 0 ? "in " + m + " min" : m + " min ago";
  }
  if (sameDay) {
    const t = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(at));
    return "today " + t;
  }
  if (abs < 2 * DAY) return d >= 0 ? "tomorrow" : "yesterday";
  const days = Math.round(abs / DAY);
  if (days < 14) return d >= 0 ? "in " + days + " d" : days + " d ago";
  return fmtDate(at, tz);
}

export function hoursBetween(a: string, b: string) {
  return (ms(b) - ms(a)) / HOUR;
}

export function fmtHours(h: number): string {
  if (!isFinite(h)) return "None";
  if (h < 1) return Math.round(h * 60) + " min";
  if (h < 48) return (Math.round(h * 10) / 10) + " h";
  return (Math.round(h / 24 * 10) / 10) + " d";
}

/** Next occurrence of a cadence after `after`, computed in the schedule's timezone. */
export function nextOccurrence(
  cadence: { every: "day" | "week" | "month"; weekday?: number; monthday?: number; hour: number; minute: number },
  after: string,
  tz: string
): string {
  // Walk forward hour by hour is wasteful; walk day by day and test the local wall clock.
  const start = ms(after);
  for (let i = 0; i < 400; i++) {
    const dayStart = start + i * DAY;
    const parts = wallParts(iso(dayStart), tz);
    const matches =
      cadence.every === "day" ||
      (cadence.every === "week" && parts.weekday === (cadence.weekday ?? 1)) ||
      (cadence.every === "month" && parts.day === (cadence.monthday ?? 1));
    if (!matches) continue;
    const candidate = zonedTime(parts.y, parts.m, parts.day, cadence.hour, cadence.minute, tz);
    if (ms(candidate) > start) return candidate;
  }
  return after;
}

function wallParts(at: string, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric", weekday: "short" });
  const parts = Object.fromEntries(f.formatToParts(new Date(at)).map((p) => [p.type, p.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday as string);
  return { y: Number(parts.year), m: Number(parts.month), day: Number(parts.day), weekday: wd };
}

/** The UTC instant for a wall-clock time in a timezone. */
export function zonedTime(y: number, m: number, d: number, h: number, min: number, tz: string): string {
  const guess = Date.UTC(y, m - 1, d, h, min);
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric" });
  const p = Object.fromEntries(f.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
  return iso(guess - (asUtc - guess));
}

export function cadenceLabel(c: { every: "day" | "week" | "month"; weekday?: number; monthday?: number; hour: number; minute: number }, tz: string) {
  const t = String(c.hour).padStart(2, "0") + ":" + String(c.minute).padStart(2, "0");
  const wd = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][c.weekday ?? 1];
  const base = c.every === "day" ? "Every day at " + t
    : c.every === "week" ? "Every " + wd + " at " + t
    : "Monthly on day " + (c.monthday ?? 1) + " at " + t;
  return base + " (" + tz + ")";
}

const clockFmt = new Map<string, Intl.DateTimeFormat>();
function clock(at: string, tz: string) {
  let f = clockFmt.get(tz);
  if (!f) { f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, weekday: "short", hour: "numeric", minute: "numeric" }); clockFmt.set(tz, f); }
  const p = f.formatToParts(new Date(at)).reduce<Record<string, string>>((o, x) => { o[x.type] = x.value; return o; }, {});
  return { wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday), minutes: (Number(p.hour) % 24) * 60 + Number(p.minute) };
}

/** Add working hours on a business calendar (09:00-17:00, Monday to Friday, in tz). */
export function addBusinessHours(start: string, hours: number, tz: string): string {
  let t = ms(start);
  let left = hours * HOUR;
  for (let guard = 0; guard < 2000 && left > 0; guard++) {
    const at = iso(t);
    const { wd, minutes } = clock(at, tz);
    const open = wd >= 1 && wd <= 5 && minutes >= 9 * 60 && minutes < 17 * 60;
    if (!open) { t += 15 * 60000; continue; }
    const untilClose = (17 * 60 - minutes) * 60000;
    const step = Math.min(left, untilClose);
    t += step;
    left -= step;
  }
  return iso(t);
}

/** Working hours elapsed between two instants on the same calendar. */
export function businessHoursBetween(a: string, b: string, tz: string): number {
  if (ms(b) <= ms(a)) return 0;
  let t = ms(a), total = 0;
  const end = ms(b);
  for (let guard = 0; guard < 20000 && t < end; guard++) {
    const { wd, minutes } = clock(iso(t), tz);
    const open = wd >= 1 && wd <= 5 && minutes >= 9 * 60 && minutes < 17 * 60;
    const step = Math.min(15 * 60000, end - t);
    if (open) total += step;
    t += step;
  }
  return total / HOUR;
}
