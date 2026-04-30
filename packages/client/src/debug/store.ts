import { create } from "zustand";

// Reusable dev-only toggle store. The whole module — store, persistence, the
// `<DebugConsole />` renderer — is only meaningful when `import.meta.env.DEV`
// is true; call sites wrap usage in that check so Rollup eliminates the
// branches at build time and production never reads or writes localStorage
// from here.
//
// To add a new toggle: append a key to `DebugToggles` (default false),
// surface a row in DebugConsole.tsx, and read it from wherever needs gating.
// Panel chrome state (collapsed / x / y) lives on the same persisted record
// but is intentionally separate from the toggle list rendered in the UI.
export interface DebugToggles {
  // Overlay translucent rectangles where each puzzle's diffs are. Lets the
  // developer blow through daily / single runs while QAing flows that need a
  // completed game (e.g., the result screen).
  showDiffs: boolean;
}

interface PanelChrome {
  collapsed: boolean;
  // Top-left position in viewport CSS pixels. Persisted so the panel doesn't
  // jump back into the way after every reload.
  x: number;
  y: number;
}

export interface DebugState extends DebugToggles, PanelChrome {}

const PANEL_DEFAULT_WIDTH = 180;
const DEFAULTS: DebugState = {
  showDiffs: false,
  collapsed: false,
  // Default to the top-right corner. `window` is available because this
  // module only runs in browser builds.
  x: typeof window !== "undefined" ? Math.max(0, window.innerWidth - PANEL_DEFAULT_WIDTH - 8) : 8,
  y: 8,
};

const STORAGE_KEY = "differ:debug";

function load(): DebugState {
  // Even though every reader is gated on `import.meta.env.DEV`, the store
  // factory runs at module-import time. Skip localStorage entirely in prod
  // so the production bundle never touches the storage key (or pulls the
  // STORAGE_KEY string into a code path that runs on real users' machines).
  if (!import.meta.env.DEV) return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<DebugState>;
    // Spread defaults first so flags added later don't crash older saved state.
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function save(state: DebugState) {
  if (!import.meta.env.DEV) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* private mode / quota — drop silently, debug state is non-critical */
  }
}

interface DebugStore extends DebugState {
  toggle: (key: keyof DebugToggles | "collapsed") => void;
  // Live position update during a drag — does NOT persist. Avoids hammering
  // localStorage on every mousemove frame.
  movePanel: (x: number, y: number) => void;
  // Persist the current state. Called once on drag end.
  persist: () => void;
}

export const useDebugStore = create<DebugStore>((set, get) => ({
  ...load(),
  toggle: (key) => {
    const next = { ...get(), [key]: !get()[key] } as DebugState;
    save(next);
    set({ [key]: next[key] } as Partial<DebugStore>);
  },
  movePanel: (x, y) => set({ x, y }),
  persist: () => save(get()),
}));
