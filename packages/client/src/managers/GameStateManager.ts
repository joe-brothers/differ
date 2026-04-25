import { EventEmitter } from "pixi.js";
import type { GameState, GameMode, GameType, ImageData, SelectedDifference } from "../types";
import { IMAGES_PER_GAME, TOTAL_DIFFS_PER_GAME } from "../constants";

export class GameStateManager extends EventEmitter {
  private state: GameState;

  constructor() {
    super();
    this.state = this.getInitialState();
  }

  private getInitialState(): GameState {
    return {
      mode: "menu",
      gameType: "single",
      roomCode: "",
      serverStartedAt: null,
      currentImageIndex: 0,
      selectedImages: [],
      selectedDifferences: [],
      foundCount: 0,
      inputDisabled: false,
      opponentFoundCount: 0,
      opponentUsername: "",
      opponentWins: 0,
      pausedAt: null,
      pausedMs: 0,
    };
  }

  getState(): Readonly<GameState> {
    return this.state;
  }

  setMode(mode: GameMode): void {
    this.state.mode = mode;
    this.emit("modeChanged", mode);
  }

  initGame(
    roomCode: string,
    images: ImageData[],
    differences: SelectedDifference[][],
    gameType: GameType,
    serverStartedAt: number,
    existingFoundCount: number = 0,
    existingOpponentCount: number = 0,
  ): void {
    const prevOpponentName = this.state.opponentUsername;
    const prevOpponentWins = this.state.opponentWins;
    this.state = {
      mode: "playing",
      gameType,
      roomCode,
      serverStartedAt,
      currentImageIndex: 0,
      selectedImages: images,
      selectedDifferences: differences,
      foundCount: existingFoundCount,
      inputDisabled: false,
      opponentFoundCount: existingOpponentCount,
      opponentUsername: prevOpponentName,
      opponentWins: prevOpponentWins,
      pausedAt: null,
      pausedMs: 0,
    };
    this.emit("gameInitialized");
  }

  // Mark a difference as found locally (called after server confirms).
  markDifferenceFound(imageIndex: number, diffIndex: number): void {
    const diff = this.state.selectedDifferences[imageIndex]?.[diffIndex];
    if (!diff || diff.found) return;

    diff.found = true;
    this.state.foundCount++;
    this.emit("differenceFound", {
      imageIndex,
      diffIndex,
      total: this.state.foundCount,
    });

    const currentDiffs = this.state.selectedDifferences[imageIndex];
    if (currentDiffs.every((d) => d.found)) {
      this.emit("imageCompleted", imageIndex);

      if (this.state.foundCount === TOTAL_DIFFS_PER_GAME) {
        this.state.mode = "completed";
        this.emit("gameCompleted");
      }
    }
  }

  // Resolve a click_result from the server to (imageIdx, diffIdx) and mark it.
  markDifferenceFoundById(
    puzzleIndex: number,
    differenceId: string,
  ): { imageIndex: number; diffIndex: number } | null {
    const diffs = this.state.selectedDifferences[puzzleIndex];
    if (!diffs) return null;
    for (let i = 0; i < diffs.length; i++) {
      if (diffs[i].rect.id === differenceId && !diffs[i].found) {
        this.markDifferenceFound(puzzleIndex, i);
        return { imageIndex: puzzleIndex, diffIndex: i };
      }
    }
    return null;
  }

  handleOpponentDifferenceFound(count?: number): void {
    this.state.opponentFoundCount = count ?? this.state.opponentFoundCount + 1;
    this.emit("opponentDifferenceFound", this.state.opponentFoundCount);
  }

  handleGameEnded(winnerUserId: string | null): void {
    if (this.state.mode === "completed") return;
    this.state.mode = "completed";
    this.emit("gameLost", winnerUserId);
  }

  setOpponent(username: string, wins: number): void {
    this.state.opponentUsername = username;
    this.state.opponentWins = wins;
  }

  navigateToImage(index: number): void {
    const newIndex = Math.max(0, Math.min(IMAGES_PER_GAME - 1, index));
    if (newIndex !== this.state.currentImageIndex) {
      this.state.currentImageIndex = newIndex;
      this.emit("imageChanged", newIndex);
    }
  }

  nextImage(): void {
    this.navigateToImage(this.state.currentImageIndex + 1);
  }

  prevImage(): void {
    this.navigateToImage(this.state.currentImageIndex - 1);
  }

  disableInputTemporarily(durationMs: number = 1000): void {
    if (this.state.inputDisabled) return;
    this.state.inputDisabled = true;
    this.emit("inputDisabled");
    setTimeout(() => {
      this.state.inputDisabled = false;
      this.emit("inputEnabled");
    }, durationMs);
  }

  pause(): void {
    if (this.state.mode === "playing") {
      this.state.mode = "paused";
      this.state.pausedAt = Date.now();
      this.emit("modeChanged", "paused");
    }
  }

  resume(): void {
    if (this.state.mode === "paused") {
      if (this.state.pausedAt != null) {
        this.state.pausedMs += Date.now() - this.state.pausedAt;
        this.state.pausedAt = null;
      }
      this.state.mode = "playing";
      this.emit("modeChanged", "playing");
    }
  }

  // Wall-clock elapsed time minus accumulated pauses (and frozen at the
  // pause moment while currently paused). Returns 0 before the game starts.
  getEffectiveElapsedMs(): number {
    const { serverStartedAt, pausedAt, pausedMs } = this.state;
    if (serverStartedAt == null) return 0;
    const reference = pausedAt ?? Date.now();
    return Math.max(0, reference - serverStartedAt - pausedMs);
  }

  reset(): void {
    this.state = this.getInitialState();
    this.emit("reset");
  }

  getCurrentImage(): ImageData | null {
    return this.state.selectedImages[this.state.currentImageIndex] ?? null;
  }

  getCurrentDifferences(): SelectedDifference[] {
    return this.state.selectedDifferences[this.state.currentImageIndex] ?? [];
  }

  getFoundCountForImage(imageIndex: number): number {
    const diffs = this.state.selectedDifferences[imageIndex];
    return diffs ? diffs.filter((d) => d.found).length : 0;
  }
}

export const gameState = new GameStateManager();
