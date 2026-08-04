"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";

export type ChatMessage = { role: "user" | "assistant"; content: string };
export type MentionItem = { id: string; label: string };

type Props = {
  messages: ChatMessage[];
  onSend: (message: string, mentionedIds: string[]) => void | Promise<void>;
  sending?: boolean;
  placeholder?: string;
  className?: string;
  /** When provided, typing "@" opens a picker over these items (e.g. highlights to target). */
  mentionables?: MentionItem[];
};

type ActiveMention = { start: number; query: string };

function detectMention(value: string, cursor: number): ActiveMention | null {
  const upToCursor = value.slice(0, cursor);
  const atIndex = upToCursor.lastIndexOf("@");
  if (atIndex === -1) return null;
  const before = atIndex === 0 ? "" : upToCursor[atIndex - 1];
  if (before && !/\s/.test(before)) return null;
  const query = upToCursor.slice(atIndex + 1);
  if (/\s/.test(query)) return null;
  return { start: atIndex, query };
}

export function ChatPanel({ messages, onSend, sending, placeholder, className, mentionables }: Props) {
  const [input, setInput] = useState("");
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const [activeMention, setActiveMention] = useState<ActiveMention | null>(null);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingCursorRef = useRef<number | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    if (pendingCursorRef.current === null || !textareaRef.current) return;
    textareaRef.current.selectionStart = textareaRef.current.selectionEnd = pendingCursorRef.current;
    pendingCursorRef.current = null;
  }, [input]);

  const matches =
    mentionables && activeMention
      ? mentionables.filter((m) => m.label.toLowerCase().includes(activeMention.query.toLowerCase()))
      : [];

  function handleChange(value: string, cursor: number) {
    setInput(value);
    setActiveMention(mentionables ? detectMention(value, cursor) : null);
    setHighlightIndex(0);
  }

  function selectMention(item: MentionItem) {
    if (!activeMention || !textareaRef.current) return;
    const cursor = textareaRef.current.selectionStart;
    const before = input.slice(0, activeMention.start);
    const after = input.slice(cursor);
    const inserted = `@${item.label} `;
    setInput(before + inserted + after);
    setMentionedIds((ids) => (ids.includes(item.id) ? ids : [...ids, item.id]));
    setActiveMention(null);
    pendingCursorRef.current = (before + inserted).length;
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    const ids = mentionedIds;
    setMentionedIds([]);
    await onSend(text, ids);
  }

  function handleKeyDown(e: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (activeMention && matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => (i + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        selectMention(matches[highlightIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setActiveMention(null);
        return;
      }
    }
    // Enter always just inserts a newline — sending only happens via the
    // button, so a message can be drafted across multiple lines freely.
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
        {sending && <div className="px-2 text-xs text-neutral-500">思考中…，请勿离开页面</div>}
      </div>
      <div className="relative flex gap-2 border-t border-neutral-200 p-2 dark:border-neutral-800">
        {activeMention && matches.length > 0 && (
          <div className="absolute bottom-full left-2 z-10 mb-1 max-h-48 w-64 overflow-y-auto rounded border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            {matches.map((m, i) => (
              <button
                key={m.id}
                type="button"
                className={`block w-full truncate px-3 py-1.5 text-left text-sm ${
                  i === highlightIndex ? "bg-black/5 dark:bg-white/10" : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectMention(m);
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
        <textarea
          ref={textareaRef}
          className="textarea flex-1"
          rows={2}
          value={input}
          placeholder={mentionables ? `${placeholder ?? ""}（输入 @ 可指定操作对象）` : placeholder}
          onChange={(e) => handleChange(e.target.value, e.target.selectionStart)}
          onKeyDown={handleKeyDown}
        />
        <button type="button" className="btn-primary" onClick={handleSend} disabled={sending}>
          发送
        </button>
      </div>
    </div>
  );
}
