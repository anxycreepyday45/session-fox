import JSZip from "jszip";
import { toNetscape } from "./parse";
import type { ParsedCookie } from "./types";

const USER_JS = `user_pref("browser.shell.checkDefaultBrowser", false);
user_pref("browser.startup.homepage_override.mstone", "ignore");
user_pref("startup.homepage_welcome_url", "");
user_pref("startup.homepage_welcome_url.additional", "");
user_pref("startup.homepage_override_url", "");
user_pref("browser.aboutwelcome.enabled", false);
user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
user_pref("browser.startup.homepage", "https://www.tiktok.com");
user_pref("browser.startup.page", 1);
user_pref("network.cookie.cookieBehavior", 0);
user_pref("network.cookie.lifetimePolicy", 0);
user_pref("privacy.sanitize.sanitizeOnShutdown", false);
user_pref("privacy.firstparty.isolate", false);
user_pref("dom.security.https_only_mode", false);
`;

function sameSiteInt(v: ParsedCookie["sameSite"]): number {
  if (v === "lax") return 1;
  if (v === "strict") return 2;
  if (v === "none") return 3;
  return 0;
}

function firefoxHost(c: ParsedCookie): string {
  const d = c.domain.replace(/^\./, "");
  if (c.hostOnly) return d;
  return `.${d}`;
}

type SqlInit = (opts: { locateFile: (f: string) => string }) => Promise<{
  Database: new () => {
    run: (sql: string) => void;
    prepare: (sql: string) => {
      run: (params: (string | number)[]) => void;
      free: () => void;
    };
    export: () => Uint8Array;
    close: () => void;
  };
}>;

async function buildCookiesSqlite(cookies: ParsedCookie[]): Promise<Uint8Array> {
  const mod = (await import("sql.js")) as { default?: SqlInit } & SqlInit;
  const initSqlJs = (mod.default ?? mod) as SqlInit;
  const SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
  const db = new SQL.Database();
  db.run("PRAGMA user_version = 11");
  db.run(`
    CREATE TABLE moz_cookies (
      id INTEGER PRIMARY KEY,
      originAttributes TEXT NOT NULL DEFAULT '',
      name TEXT,
      value TEXT,
      host TEXT,
      path TEXT,
      expiry INTEGER,
      lastAccessed INTEGER,
      creationTime INTEGER,
      isSecure INTEGER,
      isHttpOnly INTEGER,
      inBrowserElement INTEGER DEFAULT 0,
      sameSite INTEGER DEFAULT 0,
      rawSameSite INTEGER DEFAULT 0,
      schemeMap INTEGER DEFAULT 0
    )
  `);
  db.run(
    "CREATE UNIQUE INDEX moz_uniqueid ON moz_cookies (name, host, path, originAttributes)",
  );

  const nowMs = Date.now();
  const nowUs = nowMs * 1000;
  const insert = db.prepare(`
    INSERT OR REPLACE INTO moz_cookies (
      originAttributes, name, value, host, path, expiry,
      lastAccessed, creationTime, isSecure, isHttpOnly,
      inBrowserElement, sameSite, rawSameSite, schemeMap
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const c of cookies) {
    const ss = sameSiteInt(c.sameSite);
    const expiry =
      c.expires > 0 ? c.expires : Math.floor(nowMs / 1000) + 400 * 24 * 60 * 60;
    insert.run([
      "",
      c.name,
      c.value,
      firefoxHost(c),
      c.path || "/",
      expiry,
      nowUs,
      nowUs,
      c.secure ? 1 : 0,
      c.httpOnly ? 1 : 0,
      0,
      ss,
      ss,
      2,
    ]);
  }
  insert.free();
  const bytes = db.export();
  db.close();
  return bytes;
}

function batScript(): string {
  return `@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"
set "PROFILE=%~dp0profile"

set "FF="
if exist "%ProgramFiles%\\Mozilla Firefox\\firefox.exe" set "FF=%ProgramFiles%\\Mozilla Firefox\\firefox.exe"
if not defined FF if exist "%ProgramFiles(x86)%\\Mozilla Firefox\\firefox.exe" set "FF=%ProgramFiles(x86)%\\Mozilla Firefox\\firefox.exe"
if not defined FF if exist "%LOCALAPPDATA%\\Mozilla Firefox\\firefox.exe" set "FF=%LOCALAPPDATA%\\Mozilla Firefox\\firefox.exe"
if not defined FF (
  for /f "delims=" %%I in ('where firefox 2^>nul') do (
    set "FF=%%I"
    goto :launch
  )
)

:launch
if not defined FF (
  echo Firefox не найден. Установите Mozilla Firefox и нажмите ещё раз.
  pause
  exit /b 1
)

start "" "!FF!" -no-remote -profile "%PROFILE%" "https://www.tiktok.com"
`;
}

function shScript(): string {
  return `#!/bin/sh
set -eu
DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
SRC="$DIR/profile"
DEST="$HOME/.sessionfox/$(basename "$DIR" | tr -c 'A-Za-z0-9._-' '_')"
mkdir -p "$DEST"
cp -a "$SRC/." "$DEST/"

FF=""
for c in firefox firefox-esr /usr/bin/firefox /usr/bin/firefox-esr /snap/bin/firefox \\
  /Applications/Firefox.app/Contents/MacOS/firefox; do
  if command -v "$c" >/dev/null 2>&1; then FF=$(command -v "$c"); break; fi
  if [ -x "$c" ]; then FF="$c"; break; fi
done

if [ -z "$FF" ]; then
  echo "Firefox не найден. Установите Mozilla Firefox."
  exit 1
fi

exec "$FF" --no-remote --profile "$DEST" "https://www.tiktok.com"
`;
}

function readme(name: string, count: number): string {
  return `Session Fox — ${name}
Куки: ${count}

Windows
1. Дважды щёлкните Open-TikTok.bat
2. Откроется отдельный Firefox сразу на tiktok.com с этой сессией

Linux / macOS
1. chmod +x open-tiktok.sh
2. ./open-tiktok.sh

Firefox должен быть установлен. Профиль временный, основной браузер не трогается.
Если Firefox уже запущен — откроется второе окно с этой сессией (-no-remote).
`;
}

export async function buildFirefoxPack(
  name: string,
  cookies: ParsedCookie[],
): Promise<Blob> {
  const sqlite = await buildCookiesSqlite(cookies);
  const zip = new JSZip();
  const safe = name.replace(/[^\wа-яА-ЯёЁ.-]+/g, "-") || "session";
  const root = zip.folder(safe) ?? zip;
  const profile = root.folder("profile");
  if (!profile) throw new Error("Не удалось собрать профиль Firefox");
  profile.file("cookies.sqlite", sqlite);
  profile.file("user.js", USER_JS);
  root.file("Open-TikTok.bat", batScript());
  root.file("open-tiktok.sh", shScript());
  root.file("cookies.txt", toNetscape(cookies));
  root.file("README.txt", "\uFEFF" + readme(safe, cookies.length));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}
