"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const EVENT = "ezorder:stored";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/**
 * A small value remembered on this phone (name, language).
 * `ready` is false during the first server render, before the phone's memory can be read.
 */
export function useStored<T>(key: string, fallback: T): [T, (value: T) => void, boolean] {
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) ?? "";
      } catch {
        return "";
      }
    },
    () => null,
  );

  const value = useMemo(() => {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }, [raw, fallback]);

  const set = useCallback(
    (next: T) => {
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // Private mode: the value just will not be remembered.
      }
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );

  return [value, set, raw !== null];
}
