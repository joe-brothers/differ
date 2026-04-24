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
}

// Game mode types
export type GameMode = "menu" | "playing" | "paused" | "completed";

// Game type
export type GameType = "single" | "one_on_one";

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
}

// Scene interface
export interface IScene {
  init(): Promise<void>;
  update(deltaTime: number): void;
  destroy(): void;
  resize?(width: number, height: number): void;
}
