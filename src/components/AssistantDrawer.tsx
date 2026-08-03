"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { ChatPanel, type ChatMessage } from "./ChatPanel";
import { ApiError, apiPost } from "@/lib/apiClient";
import { toast } from "@/lib/toast";

const STORAGE_KEY = "resume-agent:assistant-drawer";
const POSITION_KEY = "resume-agent:assistant-drawer-y";
const TAB_SIZE = 56; // circle diameter
const PANEL_HEIGHT = 512;
const GAP = 12;
const DRAG_THRESHOLD = 4;

type StoredState = { sessionId?: string; messages: ChatMessage[] };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function AssistantDrawer() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  // Vertical position only — horizontally the tab always stays flush against
  // the right edge, so dragging can only slide it up/down along that edge.
  const [y, setY] = useState<number | null>(null);

  const dragRef = useRef({ dragging: false, startY: 0, origY: 0, moved: false });

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

  // y is only meaningful client-side (needs window height), so it starts
  // null (tab falls back to a CSS bottom-anchored position) and gets a real
  // pixel value — restored from last drag, or a sensible default — once
  // mounted in the browser.
  useEffect(() => {
    const raw = localStorage.getItem(POSITION_KEY);
    if (raw) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) {
        setY(parsed);
        return;
      }
    }
    setY(window.innerHeight - TAB_SIZE - 96);
  }, []);

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

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    const currentY = y ?? e.clientY - TAB_SIZE / 2;
    dragRef.current = { dragging: true, startY: e.clientY, origY: currentY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragRef.current.dragging) return;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dy) > DRAG_THRESHOLD) dragRef.current.moved = true;
    setY(clamp(dragRef.current.origY + dy, 0, window.innerHeight - TAB_SIZE));
  }

  function onPointerUp() {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    setY((current) => {
      if (current !== null) localStorage.setItem(POSITION_KEY, String(current));
      return current;
    });
  }

  function handleClick() {
    if (dragRef.current.moved) {
      dragRef.current.moved = false;
      return;
    }
    setOpen((o) => !o);
  }

  function panelStyle(): CSSProperties {
    if (y === null) return {};
    const vh = window.innerHeight;
    const spaceAbove = y - GAP;
    const top =
      spaceAbove >= PANEL_HEIGHT ? y - PANEL_HEIGHT - GAP : clamp(y + TAB_SIZE + GAP, GAP, vh - PANEL_HEIGHT - GAP);
    return { top, bottom: "auto" };
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={y === null ? undefined : { top: y, bottom: "auto" }}
        className={`fixed z-40 flex h-14 w-14 touch-none cursor-grab items-center justify-center rounded-full bg-neutral-900 text-sm font-medium text-white shadow-lg transition-[right] duration-200 ease-out select-none active:cursor-grabbing dark:bg-white dark:text-neutral-900 ${
          open ? "right-0" : "-right-7 hover:right-0"
        }`}
        aria-label="打开助手（沿右边缘可拖动）"
      >
        {open ? "Close" : "AI"}
      </button>
      {open && (
        <div
          style={panelStyle()}
          className="fixed right-16 z-40 flex h-[32rem] w-96 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
        >
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
