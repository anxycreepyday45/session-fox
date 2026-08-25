import { useState } from "react";
import { Copy, Download, Pencil, Play } from "lucide-react";
import { toast } from "sonner";
import { assessSession, formatExpiry, formatLabel, maskValue } from "@/lib/cookies/health";
import { toCookieHeader, toNetscape } from "@/lib/cookies/parse";
import { buildFirefoxPack, downloadBlob } from "@/lib/cookies/firefox-pack";
import type { SavedSession } from "@/lib/cookies/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type SessionPanelProps = {
  session: SavedSession;
  onRename: (name: string) => void;
};

const KEYS = [
  "sessionid",
  "sid_tt",
  "sid_guard",
  "uid_tt",
  "ttwid",
  "msToken",
  "odin_tt",
  "sessionid_ss",
];

export function SessionPanel({ session, onRename }: SessionPanelProps) {
  const health = assessSession(session.cookies);
  const [busy, setBusy] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);

  async function launch() {
    if (!session.cookies.length) {
      toast.error("В файле нет куков — проверьте формат .txt");
      return;
    }
    setBusy(true);
    try {
      const blob = await buildFirefoxPack(session.name, session.cookies);
      downloadBlob(blob, `${session.name}-firefox.zip`);
      setDoneOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Не удалось собрать профиль";
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  function copyHeader() {
    void navigator.clipboard.writeText(toCookieHeader(session.cookies));
    toast.success("Строка Cookie скопирована");
  }

  function downloadTxt() {
    const blob = new Blob([toNetscape(session.cookies)], {
      type: "text/plain;charset=utf-8",
    });
    downloadBlob(blob, `${session.name}.txt`);
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {editing ? (
            <form
              className="flex max-w-sm gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                onRename(draft);
                setEditing(false);
              }}
            >
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
                aria-label="Имя сессии"
              />
              <Button type="submit" size="sm" variant="secondary">
                Ок
              </Button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-balance">
                {session.name}
              </h2>
              <button
                type="button"
                className="flex size-11 items-center justify-center rounded-md text-muted hover:text-fg"
                aria-label="Переименовать"
                onClick={() => {
                  setDraft(session.name);
                  setEditing(true);
                }}
              >
                <Pencil className="size-4" />
              </button>
            </div>
          )}
          <p className="mt-1 text-sm text-muted">
            {session.fileName} · {formatLabel(session.format)} ·{" "}
            <span className="tabular-nums">{session.cookies.length}</span> куки
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={health.ready ? "ready" : "warn"}>
            {health.ready ? "готова к запуску" : "нет sessionid"}
          </Badge>
          {health.uid ? (
            <Badge>
              uid <span className="ml-1 font-mono tabular-nums">{health.uid}</span>
            </Badge>
          ) : null}
          <Badge>до {formatExpiry(health.expiresAt)}</Badge>
        </div>
      </header>

      {session.warnings.map((w) => (
        <p key={w} className="rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn">
          {w}
        </p>
      ))}

      <Button
        size="lg"
        onClick={() => void launch()}
        disabled={busy || !session.cookies.length}
        className="h-14 w-full max-w-md justify-center text-base"
      >
        <Play className="size-4" strokeWidth={2} />
        {busy ? "Собираю Firefox…" : "Открыть Firefox → tiktok.com"}
      </Button>
      <p className="max-w-md text-sm text-subtle text-pretty">
        Скачается архив с готовым профилем. Распакуйте и нажмите Open-TikTok.bat —
        Firefox откроется уже на tiktok.com с этой сессией.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={copyHeader}>
          <Copy className="size-3.5" />
          Копировать Cookie
        </Button>
        <Button variant="ghost" size="sm" onClick={downloadTxt}>
          <Download className="size-3.5" />
          Скачать cookies.txt
        </Button>
      </div>

      <section>
        <h3 className="mb-3 text-xs font-medium tracking-wide text-subtle uppercase">
          Ключевые куки
        </h3>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {KEYS.map((name) => {
            const on = health.present.includes(name);
            return (
              <li
                key={name}
                className="rounded-md bg-surface px-3 py-2 shadow-[var(--shadow-border)]"
              >
                <span className="block font-mono text-xs text-subtle">{name}</span>
                <span className={on ? "text-sm text-ready" : "text-sm text-muted"}>
                  {on ? "есть" : "нет"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-medium tracking-wide text-subtle uppercase">
          Все куки
        </h3>
        <div className="overflow-x-auto rounded-lg bg-surface shadow-[var(--shadow-border)]">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-subtle">
              <tr className="border-b border-border">
                <th className="px-4 py-3 font-medium">Имя</th>
                <th className="px-4 py-3 font-medium">Значение</th>
                <th className="px-4 py-3 font-medium">Домен</th>
              </tr>
            </thead>
            <tbody>
              {session.cookies.map((c) => (
                <tr
                  key={`${c.domain}|${c.name}|${c.path}`}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-4 py-2.5 font-mono text-xs text-fg">{c.name}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted">
                    {maskValue(c.value)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-xs text-subtle">{c.domain}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Dialog open={doneOpen} onOpenChange={setDoneOpen}>
        <DialogContent>
          <DialogTitle>Пакет Firefox готов</DialogTitle>
          <DialogDescription>
            Архив скачан. На виртуальной машине распакуйте его и дважды нажмите
            Open-TikTok.bat — откроется отдельный Firefox сразу на tiktok.com.
          </DialogDescription>
          <ol className="mt-5 list-decimal space-y-2 pl-5 text-sm text-fg">
            <li>Распакуйте zip рядом с рабочим столом</li>
            <li>Windows: Open-TikTok.bat · Linux: open-tiktok.sh</li>
            <li>Дождитесь окна Firefox на tiktok.com</li>
          </ol>
          <p className="mt-4 text-xs text-subtle">
            Нужен установленный Mozilla Firefox. Основной профиль не меняется.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
