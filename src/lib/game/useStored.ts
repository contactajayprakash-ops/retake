"use client";

import { useSyncExternalStore } from "react";

const EVENT = "retake:storage";

/**
 * Reads one localStorage key in a way that survives server rendering: the
 * server (and the first client render) see null, then the real value comes
 * in without a hydration mismatch. Writes made through `writeStored` notify
 * every subscriber on the page.
 */
export function useStoredValue(key: string): string | null {
  return useSyncExternalStore(
    (notify) => {
      window.addEventListener("storage", notify);
      window.addEventListener(EVENT, notify);
      return () => {
        window.removeEventListener("storage", notify);
        window.removeEventListener(EVENT, notify);
      };
    },
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
}

export function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode or storage blocked; the session just won't survive a reload */
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

/** True once the component is running in the browser; false during SSR and hydration. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
