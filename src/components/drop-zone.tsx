import { useCallback, useRef, useState, type DragEvent } from "react";
import { FileUp } from "lucide-react";
import { cn } from "@/lib/utils";

type DropZoneProps = {
  compact?: boolean;
  onFiles: (files: File[]) => void;
};

function isTxt(file: File): boolean {
  const n = file.name.toLowerCase();
  return (
    n.endsWith(".txt") ||
    n.endsWith(".cookies") ||
    file.type.startsWith("text/") ||
    file.type === ""
  );
}

export function DropZone({ compact = false, onFiles }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const take = useCallback(
    (list: FileList | File[]) => {
      const files = [...list].filter(isTxt);
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  function onDrag(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setOver(true);
    if (e.type === "dragleave") setOver(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOver(false);
    if (e.dataTransfer.files?.length) take(e.dataTransfer.files);
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragEnter={onDrag}
      onDragOver={onDrag}
      onDragLeave={onDrag}
      onDrop={onDrop}
      className={cn(
        "group flex w-full flex-col items-center justify-center text-center",
        "rounded-xl bg-surface shadow-[var(--shadow-border)]",
        "transition-[box-shadow,background-color] duration-[var(--motion-fast)] ease-[var(--ease-smooth-out)]",
        over && "bg-elevated shadow-[var(--shadow-border-hover)]",
        compact ? "min-h-28 gap-2 px-4 py-5" : "min-h-64 gap-4 px-6 py-12",
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-lg bg-elevated text-fg shadow-[var(--shadow-border)]",
          compact ? "size-10" : "size-14",
        )}
      >
        <FileUp className={compact ? "size-4" : "size-6"} strokeWidth={1.75} />
      </span>
      <span className="flex flex-col gap-1">
        <span className="font-display text-base font-semibold tracking-tight text-fg text-balance">
          {over ? "Отпустите файл" : "Перетащите .txt с куками"}
        </span>
        <span className="text-sm text-muted text-pretty">
          Netscape, Cookie-заголовок или name=value — не JSON
        </span>
      </span>
      <input
        ref={inputRef}
        type="file"
        accept=".txt,text/plain,.cookies"
        multiple
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) take(e.target.files);
          e.target.value = "";
        }}
      />
    </button>
  );
}
