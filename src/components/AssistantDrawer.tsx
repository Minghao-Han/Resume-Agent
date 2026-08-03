"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { ChatPanel, type ChatMessage } from "./ChatPanel";
import { ApiError, apiPost } from "@/lib/apiClient";
import { toast } from "@/lib/toast";

const STORAGE_KEY = "resume-agent:assistant-drawer";
const POSITION_KEY = "resume-agent:assistant-drawer-pos";
const BUTTON_SIZE = 48;
const PANEL_WIDTH = 384;
const PANEL_HEIGHT = 512;
const GAP = 12;
const DRAG_THRESHOLD = 4;

type StoredState = { sessionId?: string; messages: ChatMessage[] };
type Position = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function AssistantDrawer() {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [pos, setPos] = useState<Position | null>(null);

  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0, moved: false });

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

  // Position is only meaningful client-side (needs window dimensions), so it
  // starts null (button falls back to a CSS bottom-right corner) and gets a
  // real pixel position — restored from last drag, or a sensible default —
  // once mounted in the browser.
  useEffect(() => {
    const raw = localStorage.getItem(POSITION_KEY);
    if (raw) {
      try {
        setPos(JSON.parse(raw));
        return;
      } catch {
        // fall through to default
      }
    }
    setPos({ x: window.innerWidth - BUTTON_SIZE - 20, y: window.innerHeight - BUTTON_SIZE - 20 });
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
    const current = pos ?? { x: e.clientX - BUTTON_SIZE / 2, y: e.clientY - BUTTON_SIZE / 2 };
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, origX: current.x, origY: current.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) dragRef.current.moved = true;
    const next = {
      x: clamp(dragRef.current.origX + dx, 0, window.innerWidth - BUTTON_SIZE),
      y: clamp(dragRef.current.origY + dy, 0, window.innerHeight - BUTTON_SIZE),
    };
    setPos(next);
  }

  function onPointerUp() {
    if (!dragRef.current.dragging) return;
    dragRef.current.dragging = false;
    setPos((current) => {
      if (current) localStorage.setItem(POSITION_KEY, JSON.stringify(current));
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
    if (!pos) return {};
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = clamp(pos.x + BUTTON_SIZE - PANEL_WIDTH, GAP, vw - PANEL_WIDTH - GAP);
    const spaceAbove = pos.y - GAP;
    const top =
      spaceAbove >= PANEL_HEIGHT
        ? pos.y - PANEL_HEIGHT - GAP
        : clamp(pos.y + BUTTON_SIZE + GAP, GAP, vh - PANEL_HEIGHT - GAP);
    return { left, top, right: "auto", bottom: "auto" };
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
        style={pos ? { left: pos.x, top: pos.y, right: "auto", bottom: "auto" } : undefined}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 touch-none cursor-grab items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg select-none hover:bg-neutral-700 active:cursor-grabbing dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
        aria-label="打开助手（可拖动）"
      >
        {open ? "×" : "AI"}
      </button>
      {open && (
        <div
          style={panelStyle()}
          className="fixed bottom-20 right-5 z-40 flex h-[32rem] w-96 flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950"
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
