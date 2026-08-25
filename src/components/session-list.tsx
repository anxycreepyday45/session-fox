import { Trash2 } from "lucide-react";
import { assessSession } from "@/lib/cookies/health";
import type { SavedSession } from "@/lib/cookies/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type SessionListProps = {
  sessions: SavedSession[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
};

export function SessionList({
  sessions,
  selectedId,
  onSelect,
  onRemove,
}: SessionListProps) {
  if (!sessions.length) return null;

  return (
    <ul className="flex flex-col gap-1">
      {sessions.map((s) => {
        const health = assessSession(s.cookies);
        const active = s.id === selectedId;
        return (
          <li key={s.id}>
            <div
              className={cn(
                "flex items-center gap-1 rounded-lg p-1 transition-colors duration-[var(--motion-quick)]",
                active ? "bg-elevated" : "hover:bg-surface",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 text-left"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">
                    {s.name}
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-xs text-subtle tabular-nums">
                    {s.cookies.length} куки
                    {health.uid ? ` · ${health.uid}` : ""}
                  </span>
                </span>
                <Badge tone={health.ready ? "ready" : s.cookies.length ? "warn" : "danger"}>
                  {health.ready ? "сессия" : s.cookies.length ? "частично" : "пусто"}
                </Badge>
              </button>
              <button
                type="button"
                aria-label={`Удалить ${s.name}`}
                onClick={() => onRemove(s.id)}
                className="flex size-11 shrink-0 items-center justify-center rounded-md text-subtle hover:text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
