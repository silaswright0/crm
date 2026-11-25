export const QUIET_DAYS = 7;

export function latestStamp(...values: Array<Date | string | null | undefined>) {
  let latest: Date | null = null;
  for (const value of values) {
    const date = asDate(value);
    if (!date || Number.isNaN(date.getTime())) continue;
    if (!latest || date.getTime() > latest.getTime()) latest = date;
  }
  return latest;
}

export function isQuietAfter(values: Array<Date | string | null | undefined>, now = new Date()) {
  const stamp = latestStamp(...values);
  if (!stamp) return true;
  return now.getTime() - stamp.getTime() > QUIET_DAYS * 24 * 60 * 60 * 1000;
}

export function emailAddress(value: string | null | undefined) {
  if (!value) return null;
  const wrapped = value.match(/<([^>]+)>/);
  const raw = (wrapped?.[1] ?? value).trim().toLowerCase();
  return isEmail(raw) ? raw : null;
}

export function asDate(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

export function todayISO(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function isoDaysFromNow(days: number, now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  return todayISO(date);
}

export function daysAgo(days: number, now = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return date;
}

export function money(cents: number | null | undefined) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatWhen(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function parseDollars(raw: string) {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function text(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(value: string) {
  return EMAIL.test(value);
}
