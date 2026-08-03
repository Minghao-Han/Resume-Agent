"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from "react";
import { compileTypstSvg } from "@/lib/typstClient";

export type TypstCompileInfo = { pageCount: number; error: string | null };

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
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const onCompiledRef = useRef(onCompiled);
  useEffect(() => {
    onCompiledRef.current = onCompiled;
  });

  const generationRef = useRef(0);
  const dragRef = useRef({ dragging: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  useEffect(() => {
    const generation = ++generationRef.current;
    const handle = setTimeout(async () => {
      try {
        const { svg: compiled, pageCount } = await compileTypstSvg(source);
        if (generationRef.current !== generation) return;
        setSvg(compiled);
        setError(null);
        onCompiledRef.current?.({ pageCount, error: null });
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
    setOffset({ x: 0, y: 0 });
  }

  function onWheel(e: ReactWheelEvent<HTMLDivElement>) {
    e.preventDefault();
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * (e.deltaY < 0 ? 1.1 : 0.9))));
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, origX: offset.x, origY: offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current.dragging) return;
    setOffset({
      x: dragRef.current.origX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.origY + (e.clientY - dragRef.current.startY),
    });
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
      </div>
      <div
        className="relative flex-1 min-h-0 overflow-hidden rounded border bg-neutral-100 dark:bg-neutral-900 touch-none cursor-grab active:cursor-grabbing"
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
        <div
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: "top left",
            width: "fit-content",
          }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
