"use client";

import { useEffect, useState } from "react";
import { subscribeToast } from "@/lib/toast";

type ToastItem = { id: number; message: string };

const DISPLAY_MS = 2200;

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    let nextId = 0;
    return subscribeToast((message) => {
      const id = nextId++;
      setItems((prev) => [...prev, { id, message }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== id));
      }, DISPLAY_MS);
    });
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-full bg-neutral-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-white dark:text-neutral-900"
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
