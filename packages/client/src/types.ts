// Re-export what we can from shared; everything else is renderer-local.
export type { PublicUser } from "@differ/shared";

// Renderer-local rect shape (kept for existing components).
export interface DiffRect {
  id: string;
  start_point: { x: number; y: number };
  width: number;
  height: number;
}

// Parsed image data for game use.
export interface ImageData {
  id: string;
  originalUrl: string;
  differentUrl: string;
  diffRects: DiffRect[];
}

export interface SelectedDifference {
  imageIndex: number;
  diffIndex: number;
  rect: DiffRect;
  found: boolean;
  // True when this diff was surfaced by a hint rather than a click. The
  // marker is rendered in a muted color so the player can tell which ones
  // they actually spotted vs. which the game gave them.
  viaHint: boolean;
}

// Game mode types
export type GameMode = "menu" | "playing" | "paused" | "completed";

// Game type
export type GameType = "single" | "one_on_one" | "daily";

// Game state
export interface GameState {
  mode: GameMode;
  gameType: GameType;
  roomCode: string;
  // Server-authoritative wall-clock when active play begins. May be in the
  // future during the initial countdown window.
  serverStartedAt: number | null;
  currentImageIndex: number;
  selectedImages: ImageData[];
  selectedDifferences: SelectedDifference[][];
  foundCount: number;
  inputDisabled: boolean;
  opponentFoundCount: number;
  opponentUsername: string;
  opponentWins: number;
  // Wall-clock at which the current pause began; null while playing.
  // Combined with `pausedMs` this gives a pause-aware effective elapsed time
  // for the local timer (1v1 mode never pauses so this stays null there).
  pausedAt: number | null;
  // Total milliseconds spent paused so far in this game.
  pausedMs: number;
  // Daily-only running total of hints used in the current attempt. Mirrored
  // into the UI store on every server `hint_revealed`.
  hintsUsed: number;
}

// Scene interface
export interface IScene {
  init(): Promise<void>;
  update(deltaTime: number): void;
  destroy(): void;
  resize?(width: number, height: number): void;
}
