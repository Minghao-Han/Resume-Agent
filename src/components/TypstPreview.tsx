"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { compileTypstSvg } from "@/lib/typstClient";

export type TypstCompileInfo = { pageCount: number; error: string | null; width?: number; height?: number };

type Props = {
  source: string;
  className?: string;
  onCompiled?: (info: TypstCompileInfo) => void;
  debounceMs?: number;
};

const MIN_SCALE = 0.25;
const MAX_SCALE = 4;

export function TypstPreview({ source, className, onCompiled, debounceMs = 300 }: Props) {
  const [svg, setSvg] = useState("");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);

  const containerRef = useRef<HTMLDivElement>(null);

  const onCompiledRef = useRef(onCompiled);
  useEffect(() => {
    onCompiledRef.current = onCompiled;
  });

  const generationRef = useRef(0);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, startScrollLeft: 0, startScrollTop: 0 });

  useEffect(() => {
    const generation = ++generationRef.current;
    const handle = setTimeout(async () => {
      try {
        const { svg: compiled, pageCount, width, height } = await compileTypstSvg(source);
        if (generationRef.current !== generation) return;
        setSvg(compiled);
        setSize({ width, height });
        setError(null);
        onCompiledRef.current?.({ pageCount, error: null, width, height });
      } catch (err) {
        if (generationRef.current !== generation) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        onCompiledRef.current?.({ pageCount: 0, error: message });
      }
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [source, debounceMs]);

  function resetView() {
    setScale(1);
    containerRef.current?.scrollTo({ top: 0, left: 0 });
  }

  // Plain wheel scrolls the page stack natively (up/down through pages, or
  // sideways when zoomed in). Ctrl/Cmd+wheel zooms instead, like a PDF viewer.
  function onWheel(e: ReactWheelEvent<HTMLDivElement>) {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * (e.deltaY < 0 ? 1.1 : 0.9))));
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const el = containerRef.current;
    if (!el) return;
    dragRef.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startScrollLeft: el.scrollLeft,
      startScrollTop: el.scrollTop,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const el = containerRef.current;
    if (!dragRef.current.dragging || !el) return;
    el.scrollLeft = dragRef.current.startScrollLeft - (e.clientX - dragRef.current.startX);
    el.scrollTop = dragRef.current.startScrollTop - (e.clientY - dragRef.current.startY);
  }

  function onPointerUp() {
    dragRef.current.dragging = false;
  }

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => setScale((s) => Math.max(MIN_SCALE, s * 0.8))}
          className="rounded border px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
        >
          −
        </button>
        <span className="tabular-nums w-12 text-center">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          onClick={() => setScale((s) => Math.min(MAX_SCALE, s * 1.2))}
          className="rounded border px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
        >
          +
        </button>
        <button
          type="button"
          onClick={resetView}
          className="rounded border px-2 py-1 hover:bg-black/5 dark:hover:bg-white/10"
        >
          重置视图
        </button>
        <span className="ml-auto text-xs text-neutral-400">滚轮翻页 · ⌘/Ctrl+滚轮缩放 · 拖动平移</span>
      </div>
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 overflow-auto rounded border bg-neutral-200 touch-none cursor-grab active:cursor-grabbing dark:bg-neutral-800"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {error && (
          <div className="absolute inset-0 z-10 overflow-auto whitespace-pre-wrap bg-white/95 p-4 text-sm text-red-600 dark:bg-black/90 dark:text-red-400">
            {error}
          </div>
        )}
        <div style={{ width: size.width * scale, height: size.height * scale }} className="p-4">
          <div
            style={{
              width: size.width,
              height: size.height,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
            className="shadow-md"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        </div>
      </div>
    </div>
  );
}
