"use client";

import { useEffect, useRef, useState } from "react";

export type ChatMessage = { role: "user" | "assistant"; content: string };

type Props = {
  messages: ChatMessage[];
  onSend: (message: string) => void | Promise<void>;
  sending?: boolean;
  placeholder?: string;
  className?: string;
};

export function ChatPanel({ messages, onSend, sending, placeholder, className }: Props) {
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    await onSend(text);
  }

  return (
    <div className={`flex min-h-0 flex-col ${className ?? ""}`}>
      <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {messages.length === 0 && (
          <p className="p-2 text-sm text-neutral-500">{placeholder ?? "说点什么开始对话…"}</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${
              m.role === "user"
                ? "ml-auto bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                : "bg-neutral-100 dark:bg-neutral-800"
            }`}
          >
            {m.content}
          </div>
        ))}
        {sending && <div className="px-2 text-xs text-neutral-500">思考中…</div>}
      </div>
      <div className="flex gap-2 border-t border-neutral-200 p-2 dark:border-neutral-800">
        <textarea
          className="textarea flex-1"
          rows={2}
          value={input}
          placeholder={placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <button type="button" className="btn-primary" onClick={handleSend} disabled={sending}>
          发送
        </button>
      </div>
    </div>
  );
}
