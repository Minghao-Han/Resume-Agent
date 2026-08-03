export type ToastListener = (message: string) => void;

const listeners = new Set<ToastListener>();

/** Fire-and-forget, non-blocking notification — rendered by <ToastHost/> in the root layout. */
export function toast(message: string) {
  listeners.forEach((listener) => listener(message));
}

export function subscribeToast(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
