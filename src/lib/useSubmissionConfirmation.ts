import { useCallback, useSyncExternalStore } from "react";

type ConfirmationKind = "quiz" | "code";
const prefix = "rods-leet:submission-confirmation:v1:";
const fallback = new Map<string, boolean>();
const sessionOverrides = new Set<string>();
const listeners = new Set<() => void>();
const preferenceKey = (identity: string, kind: ConfirmationKind) =>
  `${prefix}${encodeURIComponent(identity)}:${kind}`;
const notify = () => listeners.forEach((listener) => listener());

/** Preferences are local to this browser and never affect server judging. */
export function readSubmissionConfirmation(
  identity: string,
  kind: ConfirmationKind,
): boolean {
  const key = preferenceKey(identity, kind);
  if (sessionOverrides.has(key)) return fallback.get(key) ?? false;
  try {
    if (typeof window !== "undefined") {
      const value = window.localStorage.getItem(key) === "true";
      fallback.set(key, value);
      return value;
    }
  } catch {
    // Private browsing or unavailable storage still allows a session preference.
  }
  return fallback.get(key) ?? false;
}

export function writeSubmissionConfirmation(
  identity: string,
  kind: ConfirmationKind,
  value: boolean,
): void {
  const key = preferenceKey(identity, kind);
  fallback.set(key, value);
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(key, String(value));
      sessionOverrides.delete(key);
    }
  } catch {
    // Keep the in-memory preference when persistence is unavailable.
    sessionOverrides.add(key);
  }
  notify();
}

/** Re-enable both confirmations for the current identity from profile settings. */
export function resetSubmissionConfirmations(identity: string): void {
  for (const kind of ["quiz", "code"] as const) {
    writeSubmissionConfirmation(identity, kind, false);
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(prefix)) listener();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function useSubmissionConfirmation(
  identity: string,
  kind: ConfirmationKind,
): { skipConfirmation: boolean; setSkipConfirmation(value: boolean): void } {
  const snapshot = useCallback(
    () => readSubmissionConfirmation(identity, kind),
    [identity, kind],
  );
  const skipConfirmation = useSyncExternalStore(
    subscribe,
    snapshot,
    () => false,
  );
  const setSkipConfirmation = useCallback(
    (value: boolean) => writeSubmissionConfirmation(identity, kind, value),
    [identity, kind],
  );
  return { skipConfirmation, setSkipConfirmation };
}
