"use client";

import { useEffect, useState } from "react";
import { ChatPanel, type ChatMessage } from "./ChatPanel";
import { ApiError, apiPost } from "@/lib/apiClient";
import { toast } from "@/lib/toast";

const STORAGE_KEY = "resume-agent:assistant-drawer";

type StoredState = { sessionId?: string; messages: ChatMessage[] };

export function AssistantDrawer() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const stored: StoredState = JSON.parse(raw);
      setSessionId(stored.sessionId);
      setMessages(stored.messages ?? []);
    } catch {
      // ignore corrupt local state
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId, messages }));
  }, [sessionId, messages]);

  async function handleSend(text: string) {
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const data = await apiPost<{ sessionId?: string; reply: string; isError?: boolean }>("/api/assistant", {
        message: text,
        sessionId,
      });
      if (data.isError) toast(data.reply);
      setSessionId(data.sessionId);
      setMessages((m) => [...m, { role: "assistant", content: data.reply || "(no reply)" }]);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "出错了，请重试。";
      toast(message);
      setMessages((m) => [...m, { role: "assistant", content: `⚠️ ${message}` }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        aria-label="打开助手"
      >
        {open ? "×" : "AI"}
      </button>
      {open && (
        <div className="fixed bottom-20 right-5 z-40 flex h-[32rem] w-96 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950">
          <div className="border-b border-neutral-200 px-3 py-2 text-sm font-medium dark:border-neutral-800">
            助手 · 调整 skills / memory
          </div>
          <ChatPanel
            className="min-h-0 flex-1"
            messages={messages}
            onSend={handleSend}
            sending={sending}
            placeholder="让我调整 .claude/ 下的 skill 或 memory…"
          />
        </div>
      )}
    </>
  );
}
