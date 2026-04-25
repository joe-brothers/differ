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
      opponentName: string;
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
    opponentName: string,
  ) => void;
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
  showComplete1v1: (result, elapsedSec, foundCount, opponentName) =>
    set({
      modal: { type: "complete-1v1", result, elapsedSec, foundCount, opponentName },
      rematchPending: false,
      opponentRematch: false,
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
