// Theme: defaults to the OS preference, with an optional explicit override
// (light/dark) persisted in localStorage. The "system" mode means no override
// — the resolved theme follows prefers-color-scheme live.

import { applyPalette } from "../constants";

export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "differ_theme";

type Listener = (resolved: ResolvedTheme) => void;

class ThemeManager {
  private mode: ThemeMode = "system";
  private resolved: ResolvedTheme = "light";
  private listeners = new Set<Listener>();
  private mql: MediaQueryList | null = null;

  init(): void {
    this.mode = readStoredMode();
    this.mql = window.matchMedia("(prefers-color-scheme: dark)");
    this.mql.addEventListener("change", this.onSystemChange);
    this.applyResolved();
  }

  destroy(): void {
    this.mql?.removeEventListener("change", this.onSystemChange);
    this.listeners.clear();
  }

  getMode(): ThemeMode {
    return this.mode;
  }

  getResolved(): ResolvedTheme {
    return this.resolved;
  }

  setMode(mode: ThemeMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode === "system") {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    } else {
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        /* ignore */
      }
    }
    this.applyResolved();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private onSystemChange = (): void => {
    if (this.mode === "system") this.applyResolved();
  };

  private applyResolved(): void {
    const next: ResolvedTheme =
      this.mode === "system" ? (this.mql?.matches ? "dark" : "light") : this.mode;
    const changed = next !== this.resolved;
    this.resolved = next;
    document.documentElement.setAttribute("data-theme", next);
    applyPalette(next);
    if (changed) {
      for (const fn of this.listeners) fn(next);
    }
  }
}

function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

export const themeManager = new ThemeManager();
