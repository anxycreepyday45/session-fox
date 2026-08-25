export type CookieFormat =
  | "netscape"
  | "header"
  | "set-cookie"
  | "name-value"
  | "json"
  | "unknown";

export type SameSite = "unset" | "lax" | "strict" | "none";

export type ParsedCookie = {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  secure: boolean;
  httpOnly: boolean;
  sameSite: SameSite;
  hostOnly: boolean;
};

export type ParseResult = {
  cookies: ParsedCookie[];
  format: CookieFormat;
  warnings: string[];
};

export type SessionHealth = {
  ready: boolean;
  hasSession: boolean;
  uid: string | null;
  expiresAt: number | null;
  present: string[];
  missing: string[];
};

export type SavedSession = {
  id: string;
  name: string;
  fileName: string;
  rawText: string;
  cookies: ParsedCookie[];
  format: CookieFormat;
  warnings: string[];
  addedAt: number;
};

export const KEY_COOKIE_NAMES = [
  "sessionid",
  "sessionid_ss",
  "sid_tt",
  "sid_guard",
  "uid_tt",
  "ttwid",
  "msToken",
  "odin_tt",
] as const;

export const DEFAULT_DOMAIN = ".tiktok.com";
export const YEAR_SECONDS = 400 * 24 * 60 * 60;
