import { create } from "zustand";
import type { GameType } from "../types";
import { gameState } from "../managers/GameStateManager";

// Shape of the modal currently shown over the game scene. The whole overlay
// layer is driven from this single discriminated union so only one modal can
// be visible at a time — no independent show/hide flags to get out of sync.
export type OverlayModal =
  | { type: "none" }
  | { type: "pause" }
  | { type: "complete-single"; elapsedSec: number; rank?: number }
  | {
      type: "complete-1v1";
      result: "win" | "lose";
      // Winner's clock (filled even for the loser, so we can decide whether
      // to show it). Loser sees a foundCount progress line instead.
      elapsedSec: number;
      foundCount: number;
      opponentFoundCount: number;
      opponentName: string;
    }
  | {
      type: "complete-daily";
      // null when the daily ran out the clock (timeout) — modal renders the
      // foundCount line instead of a time.
      elapsedSec: number | null;
      foundCount: number;
      // UTC date this attempt was for (YYYY-MM-DD). Used in the share text.
      date: string;
      // # hints used in this attempt. 0 → render the Flawless badge in the
      // share text and on the modal; >0 → omit it (the run is still a clear,
      // streak-keeping completion, just not a leaderboard one).
      hintsUsed: number;
    };

interface UIStore {
  // HUD — visible only while GameScene is mounted.
  hudVisible: boolean;
  foundCount: number;
  currentImageIndex: number;
  opponentFoundCount: number;
  opponentOnline: boolean;
  opponentName: string;
  opponentWins: number;
  gameType: GameType;
  timerSec: number;
  // Daily-only HUD state. `hintCooldownUntilMs` is wall-clock; the Hint button
  // re-enables itself once Date.now() passes it. `hintsUsed` is purely
  // informational so other UI (the Flawless badge) can read a single source.
  hintsUsed: number;
  hintCooldownUntilMs: number;

  // Overlay modal state
  modal: OverlayModal;
  rematchPending: boolean;
  // Set when the OPPONENT has signaled rematch (we received their player_ready
  // post-game). Independent of `rematchPending` which tracks the local user's
  // own click. Reset on modal close / new game.
  opponentRematch: boolean;

  // Callbacks wired up by the current scene on mount; cleared on unmount.
  // React buttons fire these instead of holding scene references themselves.
  callbacks: {
    onResume?: () => void;
    onMainMenu?: () => void;
    onPlayAgain?: () => void;
    onPauseRequest?: () => void;
  };

  // --- Actions (called imperatively from Pixi scenes / Game controller) ---

  // Hydrates HUD state from gameState when GameScene mounts.
  mountHud: () => void;
  unmountHud: () => void;

  // Per-frame timer tick (driven by Pixi ticker in GameScene.update).
  setTimerSec: (sec: number) => void;

  // Opponent presence (socket events).
  setOpponentOnline: (online: boolean) => void;

  // Modal helpers.
  openPause: () => void;
  closePause: () => void;
  showCompleteSingle: (elapsedSec: number, rank?: number) => void;
  showComplete1v1: (
    result: "win" | "lose",
    elapsedSec: number,
    foundCount: number,
    opponentFoundCount: number,
    opponentName: string,
  ) => void;
  showCompleteDaily: (args: {
    elapsedSec: number | null;
    foundCount: number;
    date: string;
    hintsUsed: number;
  }) => void;
  // Daily-only: server-acknowledged hint reveal. Records the cooldown and
  // bumps the running total — both are displayed by the HUD button.
  recordHintUsed: (cooldownMs: number, hintsUsed: number) => void;
  markRematchPending: () => void;
  markOpponentRematch: () => void;

  setCallbacks: (cb: Partial<UIStore["callbacks"]>) => void;
  resetCallbacks: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  hudVisible: false,
  foundCount: 0,
  currentImageIndex: 0,
  opponentFoundCount: 0,
  opponentOnline: true,
  opponentName: "",
  opponentWins: 0,
  gameType: "single",
  timerSec: 0,
  hintsUsed: 0,
  hintCooldownUntilMs: 0,
  modal: { type: "none" },
  rematchPending: false,
  opponentRematch: false,
  callbacks: {},

  mountHud: () => {
    const s = gameState.getState();
    set({
      hudVisible: true,
      foundCount: s.foundCount,
      currentImageIndex: s.currentImageIndex,
      opponentFoundCount: s.opponentFoundCount,
      opponentOnline: true,
      opponentName: s.opponentUsername,
      opponentWins: s.opponentWins,
      gameType: s.gameType,
      timerSec: 0,
      hintsUsed: s.hintsUsed,
      // Reconnect mid-cooldown is rare enough that the welcome payload doesn't
      // ship a remaining-cooldown value; the worst case is the user gets to
      // hint a touch sooner than they otherwise would have.
      hintCooldownUntilMs: 0,
      modal: { type: "none" },
      rematchPending: false,
      opponentRematch: false,
    });
  },

  unmountHud: () => {
    set({
      hudVisible: false,
      modal: { type: "none" },
      rematchPending: false,
      opponentRematch: false,
      callbacks: {},
    });
  },

  setTimerSec: (sec) => set({ timerSec: sec }),
  setOpponentOnline: (online) => set({ opponentOnline: online }),

  openPause: () => set({ modal: { type: "pause" } }),
  closePause: () => set((s) => (s.modal.type === "pause" ? { modal: { type: "none" } } : {})),

  showCompleteSingle: (elapsedSec, rank) =>
    set({
      modal: { type: "complete-single", elapsedSec, rank },
      rematchPending: false,
      opponentRematch: false,
    }),
  showComplete1v1: (result, elapsedSec, foundCount, opponentFoundCount, opponentName) =>
    set({
      modal: {
        type: "complete-1v1",
        result,
        elapsedSec,
        foundCount,
        opponentFoundCount,
        opponentName,
      },
      rematchPending: false,
      opponentRematch: false,
    }),
  showCompleteDaily: ({ elapsedSec, foundCount, date, hintsUsed }) =>
    set({
      modal: { type: "complete-daily", elapsedSec, foundCount, date, hintsUsed },
      rematchPending: false,
      opponentRematch: false,
    }),
  recordHintUsed: (cooldownMs, hintsUsed) =>
    set({
      hintsUsed,
      hintCooldownUntilMs: Date.now() + cooldownMs,
    }),
  markRematchPending: () => set({ rematchPending: true }),
  markOpponentRematch: () => set({ opponentRematch: true }),

  setCallbacks: (cb) => set((s) => ({ callbacks: { ...s.callbacks, ...cb } })),
  resetCallbacks: () => set({ callbacks: {} }),
}));

// --- Bridge: reflect relevant gameState events into the UI store. -----------
// gameState remains the source of truth for game mechanics; this layer just
// projects the subset the DOM cares about so React can re-render declaratively.

gameState.on("differenceFound", (payload: { total: number }) => {
  useUIStore.setState({ foundCount: payload.total });
});
gameState.on("imageChanged", (idx: number) => {
  useUIStore.setState({ currentImageIndex: idx });
});
gameState.on("opponentDifferenceFound", (count: number) => {
  useUIStore.setState({ opponentFoundCount: count });
});
gameState.on("reset", () => {
  useUIStore.getState().unmountHud();
});
