import { useSyncExternalStore, useCallback } from "react";

const STORAGE_KEY = "snakk-sidebar-collapsed";

function read(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

let collapsed = read();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getSnapshot() {
  return collapsed;
}

function set(value: boolean) {
  if (collapsed === value) return;
  collapsed = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // ignore storage failures
  }
  listeners.forEach((l) => l());
}

export function useSidebarCollapsed() {
  const value = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const setCollapsed = useCallback((next: boolean) => set(next), []);
  const toggle = useCallback(() => set(!collapsed), []);
  return { collapsed: value, setCollapsed, toggle };
}
