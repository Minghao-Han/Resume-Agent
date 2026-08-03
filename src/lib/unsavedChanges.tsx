"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

type UnsavedChangesContextValue = {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
};

const UnsavedChangesContext = createContext<UnsavedChangesContextValue>({
  isDirty: false,
  setDirty: () => {},
});

/**
 * App-wide "does the currently mounted page have unsaved edits" flag. Only
 * one page is ever mounted at a time (plain route navigation unmounts the
 * previous one), so a single shared flag — rather than per-page state — is
 * enough. Pages report into it via useReportDirty(); NavBar and the
 * beforeunload listener here both read from it to guard navigation.
 */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [isDirty, setDirty] = useState(false);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirty) return;
      e.preventDefault();
      // Chrome requires returnValue to be set for the native prompt to show;
      // the actual text shown is browser-controlled, not this string.
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  return (
    <UnsavedChangesContext.Provider value={{ isDirty, setDirty }}>
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  return useContext(UnsavedChangesContext);
}

/** Pages call this with their own computed dirty boolean to report it up. */
export function useReportDirty(isDirty: boolean) {
  const { setDirty } = useUnsavedChanges();
  useEffect(() => {
    setDirty(isDirty);
    return () => setDirty(false);
  }, [isDirty, setDirty]);
}

export const UNSAVED_CHANGES_MESSAGE = "有未保存的修改，离开后将会丢失，确定要离开吗？";
