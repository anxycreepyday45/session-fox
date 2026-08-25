import {
  DEFAULT_DOMAIN,
  YEAR_SECONDS,
  type CookieFormat,
  type ParsedCookie,
  type ParseResult,
  type SameSite,
} from "./types";

const SESSION_FALLBACK = () => Math.floor(Date.now() / 1000) + YEAR_SECONDS;

function stripBom(text: string): string {
  return text.replace(/^\uFEFF/, "").replace(/\0/g, "");
}

function decodeSameSite(raw: string | undefined): SameSite {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "lax") return "lax";
  if (v === "strict") return "strict";
  if (v === "none") return "none";
  return "unset";
}

function parseExpiry(raw: string | number | undefined): number {
  if (raw === undefined || raw === null || raw === "") return SESSION_FALLBACK();
  const n = typeof raw === "number" ? raw : Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) return SESSION_FALLBACK();
  if (n > 1e12) return Math.floor(n / 1000);
  if (n > 1e10) return Math.floor(n / 1000);
  return Math.floor(n);
}

function normalizeDomain(raw: string | undefined, hostOnly: boolean): string {
  let d = (raw ?? "").trim();
  if (!d) return DEFAULT_DOMAIN;
  d = d.replace(/^https?:\/\//i, "");
  d = d.split("/")[0] ?? d;
  d = d.split(":")[0] ?? d;
  d = d.replace(/^\./, "").toLowerCase();
  if (!d) return DEFAULT_DOMAIN;
  return hostOnly ? d : `.${d}`;
}

function cookieKey(c: ParsedCookie): string {
  return `${c.name}\0${c.domain}\0${c.path}`;
}

function mergeCookies(list: ParsedCookie[]): ParsedCookie[] {
  const map = new Map<string, ParsedCookie>();
  for (const c of list) {
    if (!c.name) continue;
    map.set(cookieKey(c), c);
  }
  return [...map.values()];
}

function looksLikeCookieName(name: string): boolean {
  if (!name || name.length > 128) return false;
  if (/\s/.test(name)) return false;
  return /^[\w.~+-]+$/.test(name);
}

function parseNetscape(text: string): ParsedCookie[] {
  const out: ParsedCookie[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    let httpOnly = false;
    let body = line;
    if (body.startsWith("#HttpOnly_")) {
      httpOnly = true;
      body = body.slice("#HttpOnly_".length);
    } else if (body.startsWith("#")) {
      continue;
    }
    const tab = body.split("\t");
    const parts = tab.length >= 7 ? tab : body.split(/\s+/);
    if (parts.length < 7) continue;
    const domainRaw = parts[0] ?? "";
    const flag = (parts[1] ?? "").toUpperCase();
    const path = parts[2] || "/";
    const secure = (parts[3] ?? "").toUpperCase() === "TRUE";
    const expires = parseExpiry(parts[4]);
    const name = parts[5] ?? "";
    const value = parts.slice(6).join("\t");
    if (!looksLikeCookieName(name)) continue;
    const hostOnly = flag === "FALSE";
    out.push({
      name,
      value,
      domain: normalizeDomain(domainRaw, hostOnly),
      path: path.startsWith("/") ? path : `/${path}`,
      expires,
      secure,
      httpOnly,
      sameSite: "unset",
      hostOnly,
    });
  }
  return out;
}

function parseNameValuePair(
  pair: string,
  extras?: Partial<ParsedCookie>,
): ParsedCookie | null {
  const trimmed = pair.trim();
  if (!trimmed) return null;
  const eq = trimmed.indexOf("=");
  if (eq <= 0) return null;
  const name = trimmed.slice(0, eq).trim();
  let value = trimmed.slice(eq + 1).trim();
  if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
    value = value.slice(1, -1);
  }
  if (!looksLikeCookieName(name)) return null;
  if (/^(domain|path|expires|max-age|samesite|secure|httponly)$/i.test(name)) {
    return null;
  }
  return {
    name,
    value,
    domain: extras?.domain ?? DEFAULT_DOMAIN,
    path: extras?.path ?? "/",
    expires: extras?.expires ?? SESSION_FALLBACK(),
    secure: extras?.secure ?? true,
    httpOnly: extras?.httpOnly ?? false,
    sameSite: extras?.sameSite ?? "unset",
    hostOnly: extras?.hostOnly ?? false,
  };
}

function parseHeader(text: string): ParsedCookie[] {
  const out: ParsedCookie[] = [];
  const cleaned = text.replace(/^\s*cookie\s*:\s*/im, "");
  for (const chunk of cleaned.split(";")) {
    const c = parseNameValuePair(chunk);
    if (c) out.push(c);
  }
  return out;
}

function parseSetCookie(text: string): ParsedCookie[] {
  const out: ParsedCookie[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) continue;
    line = line.replace(/^set-cookie\s*:\s*/i, "");
    const pieces = line.split(";");
    const first = parseNameValuePair(pieces[0] ?? "");
    if (!first) continue;
    let domain = DEFAULT_DOMAIN;
    let path = "/";
    let expires = SESSION_FALLBACK();
    let secure = false;
    let httpOnly = false;
    let sameSite: SameSite = "unset";
    let hostOnly = false;
    for (const piece of pieces.slice(1)) {
      const p = piece.trim();
      const low = p.toLowerCase();
      if (low === "secure") secure = true;
      else if (low === "httponly") httpOnly = true;
      else if (low.startsWith("domain=")) {
        domain = normalizeDomain(p.slice(7), false);
        hostOnly = false;
      } else if (low.startsWith("path=")) {
        path = p.slice(5).trim() || "/";
      } else if (low.startsWith("expires=")) {
        const t = Date.parse(p.slice(8));
        if (Number.isFinite(t)) expires = Math.floor(t / 1000);
      } else if (low.startsWith("max-age=")) {
        const n = Number(p.slice(8));
        if (Number.isFinite(n) && n > 0) {
          expires = Math.floor(Date.now() / 1000) + n;
        }
      } else if (low.startsWith("samesite=")) {
        sameSite = decodeSameSite(p.slice(9));
      }
    }
    out.push({
      ...first,
      domain,
      path,
      expires,
      secure: secure || first.secure,
      httpOnly,
      sameSite,
      hostOnly,
    });
  }
  return out;
}

function parseNameValueLines(text: string): ParsedCookie[] {
  const out: ParsedCookie[] = [];
  let currentDomain = DEFAULT_DOMAIN;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const domainMatch = line.match(/^(?:domain|host)\s*[:=]\s*(.+)$/i);
    if (domainMatch) {
      currentDomain = normalizeDomain(domainMatch[1], false);
      continue;
    }
    if (line.includes("=")) {
      const c = parseNameValuePair(line, { domain: currentDomain });
      if (c) out.push(c);
      continue;
    }
    const tab = line.split(/\t+/);
    if (tab.length >= 2 && looksLikeCookieName(tab[0] ?? "")) {
      out.push({
        name: tab[0] ?? "",
        value: tab.slice(1).join("\t"),
        domain: currentDomain,
        path: "/",
        expires: SESSION_FALLBACK(),
        secure: true,
        httpOnly: false,
        sameSite: "unset",
        hostOnly: false,
      });
    }
  }
  return out;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function fromJsonCookie(entry: unknown): ParsedCookie | null {
  const rec = asRecord(entry);
  if (!rec) return null;
  const name = String(rec.name ?? rec.Name ?? rec.key ?? "");
  if (!looksLikeCookieName(name)) return null;
  const value = String(rec.value ?? rec.Value ?? rec.val ?? "");
  const domainRaw = String(rec.domain ?? rec.host ?? rec.Domain ?? rec.Host ?? "");
  const hostOnly = Boolean(rec.hostOnly ?? rec.host_only ?? false);
  const expiresRaw =
    rec.expirationDate ??
    rec.expires ??
    rec.expiry ??
    rec.ExpirationDate ??
    rec.expiresUtc;
  return {
    name,
    value,
    domain: normalizeDomain(domainRaw, hostOnly),
    path: String(rec.path ?? rec.Path ?? "/") || "/",
    expires: parseExpiry(
      typeof expiresRaw === "number" || typeof expiresRaw === "string"
        ? expiresRaw
        : undefined,
    ),
    secure: Boolean(rec.secure ?? rec.Secure ?? true),
    httpOnly: Boolean(rec.httpOnly ?? rec.httponly ?? rec.HttpOnly ?? false),
    sameSite: decodeSameSite(String(rec.sameSite ?? rec.samesite ?? "")),
    hostOnly,
  };
}

function parseJson(text: string): ParsedCookie[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const out: ParsedCookie[] = [];
  if (Array.isArray(data)) {
    for (const item of data) {
      const c = fromJsonCookie(item);
      if (c) out.push(c);
    }
    return out;
  }
  const rec = asRecord(data);
  if (!rec) return [];
  const nested = rec.cookies ?? rec.Cookies ?? rec.cookie ?? rec.data;
  if (Array.isArray(nested)) {
    for (const item of nested) {
      const c = fromJsonCookie(item);
      if (c) out.push(c);
    }
    return out;
  }
  for (const [name, value] of Object.entries(rec)) {
    if (typeof value === "string" && looksLikeCookieName(name)) {
      const c = parseNameValuePair(`${name}=${value}`);
      if (c) out.push(c);
    }
  }
  return out;
}

function scoreNetscape(text: string): number {
  let n = 0;
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || (t.startsWith("#") && !t.startsWith("#HttpOnly_"))) continue;
    const body = t.startsWith("#HttpOnly_") ? t.slice("#HttpOnly_".length) : t;
    if (body.split("\t").length >= 7) n += 1;
  }
  return n;
}

function detectAndParse(text: string): { cookies: ParsedCookie[]; format: CookieFormat } {
  const trimmed = text.trim();
  if (!trimmed) return { cookies: [], format: "unknown" };

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const cookies = parseJson(trimmed);
    if (cookies.length) return { cookies, format: "json" };
  }

  if (scoreNetscape(trimmed) >= 1) {
    return { cookies: parseNetscape(trimmed), format: "netscape" };
  }

  if (/^\s*set-cookie\s*:/im.test(trimmed) || /;\s*domain=/i.test(trimmed)) {
    const cookies = parseSetCookie(trimmed);
    if (cookies.length) return { cookies, format: "set-cookie" };
  }

  if (
    /^\s*cookie\s*:/im.test(trimmed) ||
    (trimmed.includes(";") && trimmed.includes("=") && !trimmed.includes("\n"))
  ) {
    const cookies = parseHeader(trimmed);
    if (cookies.length) return { cookies, format: "header" };
  }

  const lineCookies = parseNameValueLines(trimmed);
  if (lineCookies.length) return { cookies: lineCookies, format: "name-value" };

  const headerFallback = parseHeader(trimmed);
  if (headerFallback.length) return { cookies: headerFallback, format: "header" };

  return { cookies: [], format: "unknown" };
}

export function parseCookieText(input: string): ParseResult {
  const text = stripBom(input);
  const warnings: string[] = [];
  if (!text.trim()) {
    return { cookies: [], format: "unknown", warnings: ["Файл пустой"] };
  }
  const { cookies: raw, format } = detectAndParse(text);
  const cookies = mergeCookies(raw);
  if (!cookies.length) {
    warnings.push(
      "Не удалось разобрать куки. Нужен Netscape cookies.txt, строка Cookie: или пары name=value.",
    );
  }
  const tiktokish = cookies.filter((c) =>
    c.domain.replace(/^\./, "").includes("tiktok"),
  );
  if (cookies.length && tiktokish.length === 0) {
    warnings.push("Домен TikTok не найден — куки без домена привязаны к .tiktok.com.");
  }
  return { cookies, format, warnings };
}

export async function readCookieFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const u8 = new Uint8Array(buf);
  if (u8.length >= 2 && u8[0] === 0xff && u8[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(u8);
  }
  if (u8.length >= 2 && u8[0] === 0xfe && u8[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(u8);
  }
  if (u8.length >= 3 && u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(u8.subarray(3));
  }
  return new TextDecoder("utf-8").decode(u8);
}

export function toNetscape(cookies: ParsedCookie[]): string {
  const lines = [
    "# Netscape HTTP Cookie File",
    "# Generated by Session Fox",
    "",
  ];
  for (const c of cookies) {
    const domain = c.hostOnly
      ? c.domain.replace(/^\./, "")
      : c.domain.startsWith(".")
        ? c.domain
        : `.${c.domain}`;
    const prefix = c.httpOnly ? "#HttpOnly_" : "";
    lines.push(
      [
        `${prefix}${domain}`,
        c.hostOnly ? "FALSE" : "TRUE",
        c.path || "/",
        c.secure ? "TRUE" : "FALSE",
        String(c.expires || 0),
        c.name,
        c.value,
      ].join("\t"),
    );
  }
  return lines.join("\n") + "\n";
}

export function toCookieHeader(cookies: ParsedCookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

export const SAMPLE_COOKIE_TEXT = `# Netscape HTTP Cookie File
# Пример — не настоящая сессия
.tiktok.com	TRUE	/	TRUE	1893456000	sessionid	demo_sessionid_not_real
.tiktok.com	TRUE	/	TRUE	1893456000	sessionid_ss	demo_sessionid_ss
.tiktok.com	TRUE	/	TRUE	1893456000	sid_tt	demo_sid_tt
.tiktok.com	TRUE	/	TRUE	1893456000	sid_guard	demo_sessionid_not_real|1700000000|1893456000|deadbeef
.tiktok.com	TRUE	/	TRUE	1893456000	uid_tt	64656d6f
.tiktok.com	TRUE	/	TRUE	1893456000	ttwid	1%7Cdemo_ttwid
.tiktok.com	TRUE	/	TRUE	1893456000	msToken	demo_ms_token_value
.tiktok.com	TRUE	/	TRUE	1893456000	odin_tt	demo_odin
`;
