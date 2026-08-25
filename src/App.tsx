import { useEffect } from "react";
import { toast, Toaster } from "sonner";
import { DropZone } from "@/components/drop-zone";
import { PastePanel } from "@/components/paste-panel";
import { SessionList } from "@/components/session-list";
import { SessionPanel } from "@/components/session-panel";
import { Button } from "@/components/ui/button";
import { SAMPLE_COOKIE_TEXT, readCookieFile } from "@/lib/cookies/parse";
import { useSessionStore } from "@/lib/cookies/store";

export default function App() {
  const hydrated = useSessionStore((s) => s.hydrated);
  const sessions = useSessionStore((s) => s.sessions);
  const selectedId = useSessionStore((s) => s.selectedId);
  const select = useSessionStore((s) => s.select);
  const addFromText = useSessionStore((s) => s.addFromText);
  const rename = useSessionStore((s) => s.rename);
  const remove = useSessionStore((s) => s.remove);
  const clearAll = useSessionStore((s) => s.clearAll);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve(useSessionStore.persist.rehydrate()).finally(() => {
      if (!cancelled) useSessionStore.getState().setHydrated();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = sessions.find((s) => s.id === selectedId) ?? sessions[0];

  async function ingestFiles(files: File[]) {
    for (const file of files) {
      try {
        const text = await readCookieFile(file);
        const session = addFromText(text, file.name);
        if (!session.cookies.length) {
          toast.error(`${file.name}: куки не распознаны`);
        } else {
          toast.success(`${file.name}: ${session.cookies.length} куки`);
        }
      } catch {
        toast.error(`Не удалось прочитать ${file.name}`);
      }
    }
  }

  function ingestText(text: string, name = "paste.txt") {
    const session = addFromText(text, name);
    if (!session.cookies.length) toast.error("Куки не распознаны");
    else toast.success(`${session.cookies.length} куки добавлены`);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col px-4 py-6 sm:px-6 sm:py-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-subtle uppercase">
            Свои сессии · только это устройство
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">
            Session Fox
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted">
            Перенесите .txt с куками — одной кнопкой получите Firefox, уже открытый
            на tiktok.com.
          </p>
        </div>
        {hydrated && sessions.length > 0 ? (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            Очистить все
          </Button>
        ) : null}
      </header>

      {!hydrated ? (
        <div className="h-64 rounded-xl bg-surface shadow-[var(--shadow-border)]" />
      ) : sessions.length === 0 ? (
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <DropZone onFiles={(files) => void ingestFiles(files)} />
          </div>
          <div className="flex flex-col gap-6 lg:col-span-2">
            <PastePanel onSubmit={(text) => ingestText(text)} />
            <Button
              variant="ghost"
              onClick={() => ingestText(SAMPLE_COOKIE_TEXT, "example.txt")}
            >
              Подставить пример .txt
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-5">
          <aside className="flex flex-col gap-4 lg:col-span-2">
            <DropZone compact onFiles={(files) => void ingestFiles(files)} />
            <SessionList
              sessions={sessions}
              selectedId={selected?.id ?? null}
              onSelect={select}
              onRemove={remove}
            />
            <PastePanel onSubmit={(text) => ingestText(text)} />
          </aside>
          <main className="lg:col-span-3">
            {selected ? (
              <SessionPanel
                session={selected}
                onRename={(name) => rename(selected.id, name)}
              />
            ) : null}
          </main>
        </div>
      )}
      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          classNames: {
            toast: "bg-elevated text-fg shadow-[var(--shadow-border)] border-0 font-sans",
            title: "text-fg",
            description: "text-muted",
          },
        }}
      />
    </div>
  );
}
