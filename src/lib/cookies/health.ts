import { KEY_COOKIE_NAMES, type ParsedCookie, type SessionHealth } from "./types";

function findCookie(cookies: ParsedCookie[], name: string): ParsedCookie | undefined {
  return cookies.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

export function extractUid(cookies: ParsedCookie[]): string | null {
  const multi = findCookie(cookies, "multi_sids");
  if (multi) {
    const m = multi.value.match(/^(\d+):/);
    if (m?.[1]) return m[1];
  }
  const uidTt = findCookie(cookies, "uid_tt");
  if (uidTt?.value) {
    const hex = uidTt.value.trim();
    if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0 && hex.length <= 32) {
      try {
        const bytes = hex.match(/.{2}/g)?.map((b) => parseInt(b, 16)) ?? [];
        const s = String.fromCharCode(...bytes);
        if (/^\d{5,}$/.test(s)) return s;
      } catch {
        /* ignore */
      }
    }
    if (/^\d{5,}$/.test(hex)) return hex;
  }
  return null;
}

export function assessSession(cookies: ParsedCookie[]): SessionHealth {
  const names = new Set(cookies.map((c) => c.name));
  const present = KEY_COOKIE_NAMES.filter((n) => names.has(n));
  const missing = KEY_COOKIE_NAMES.filter((n) => !names.has(n));
  const hasSession =
    names.has("sessionid") || names.has("sid_tt") || names.has("sid_guard");
  const sessionCookies = cookies.filter((c) =>
    ["sessionid", "sessionid_ss", "sid_tt", "sid_guard"].includes(c.name),
  );
  let expiresAt: number | null = null;
  const guard = findCookie(cookies, "sid_guard");
  if (guard) {
    const parts = guard.value.split("|");
    const ts = Number(parts[2]);
    if (Number.isFinite(ts) && ts > 1_000_000_000) expiresAt = ts;
  }
  if (expiresAt === null && sessionCookies.length) {
    const min = Math.min(...sessionCookies.map((c) => c.expires || Infinity));
    expiresAt = Number.isFinite(min) ? min : null;
  }
  return {
    ready: hasSession,
    hasSession,
    uid: extractUid(cookies),
    expiresAt,
    present: [...present],
    missing: [...missing],
  };
}

export function formatExpiry(ts: number | null): string {
  if (!ts) return "срок не указан";
  const d = new Date(ts * 1000);
  if (Number.isNaN(d.getTime())) return "срок не указан";
  if (d.getTime() < Date.now()) return "истекла";
  return d.toLocaleDateString("ru-RU");
}

export function formatLabel(format: string): string {
  switch (format) {
    case "netscape":
      return "Netscape cookies.txt";
    case "header":
      return "Cookie-заголовок";
    case "set-cookie":
      return "Set-Cookie";
    case "name-value":
      return "name=value";
    case "json":
      return "JSON";
    default:
      return "не распознан";
  }
}

export function maskValue(value: string): string {
  if (value.length <= 6) return "••••";
  return `${value.slice(0, 4)}…${value.slice(-3)}`;
}

export function slugName(name: string): string {
  const base = name
    .replace(/\.(txt|cookies?|dump|log)$/i, "")
    .replace(/[^\wа-яА-ЯёЁ-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "session";
}
