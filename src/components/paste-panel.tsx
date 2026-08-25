import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type PastePanelProps = {
  onSubmit: (text: string) => void;
};

export function PastePanel({ onSubmit }: PastePanelProps) {
  const [text, setText] = useState("");

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const v = text.trim();
        if (!v) return;
        onSubmit(v);
        setText("");
      }}
    >
      <label className="text-xs font-medium tracking-wide text-subtle uppercase">
        Или вставьте текст куков
      </label>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="sessionid=…; sid_tt=…  или  строки Netscape"
        spellCheck={false}
      />
      <Button type="submit" variant="secondary" disabled={!text.trim()}>
        Добавить сессию
      </Button>
    </form>
  );
}
