import { Application, Assets } from "pixi.js";
import type { Puzzle } from "@differ/shared";
import { SceneManager } from "./SceneManager";
import { gameState } from "../managers/GameStateManager";
import { authState } from "../managers/AuthStateManager";
import { MainMenuScene } from "../scenes/MainMenuScene";
import { GameScene } from "../scenes/GameScene";
import { LoadingScene } from "../scenes/LoadingScene";
import { AuthScene } from "../scenes/AuthScene";
import { LeaderboardScene } from "../scenes/LeaderboardScene";
import { MatchmakingScene } from "../scenes/MatchmakingScene";
import type { ImageData, SelectedDifference, DiffRect, GameType } from "../types";
import { CDN_BASE } from "../constants";
import { roomApi } from "../network/rest";
import { RoomSocket } from "../network/ws";

export class Game {
  private app: Application;
  private sceneManager: SceneManager;

  // Active room socket shared with GameScene once game starts.
  private socket: RoomSocket | null = null;

  // Hand-off for MatchmakingScene: a room code to resume waiting on.
  private pendingWaitingRoomCode: string | null = null;

  constructor(app: Application) {
    this.app = app;
    this.sceneManager = new SceneManager(app);

    this.app.ticker.add((ticker) => {
      this.sceneManager.update(ticker.deltaMS);
    });

    this.app.renderer.on("resize", (width: number, height: number) => {
      this.sceneManager.resize(width, height);
    });
  }

  getSocket(): RoomSocket | null {
    return this.socket;
  }

  async start(): Promise<void> {
    const restored = await authState.tryRestore();
    if (restored) {
      await this.showMainMenu();
    } else {
      await this.showAuthScene();
    }
  }

  async showAuthScene(): Promise<void> {
    await this.sceneManager.switchTo(AuthScene);
  }

  async showMainMenu(): Promise<void> {
    this.teardownSocket();
    gameState.reset();
    await this.sceneManager.switchTo(MainMenuScene);
  }

  async showLeaderboard(): Promise<void> {
    await this.sceneManager.switchTo(LeaderboardScene);
  }

  async showMatchmaking(): Promise<void> {
    this.pendingWaitingRoomCode = null;
    await this.sceneManager.switchTo(MatchmakingScene);
  }

  // After a 1v1 game ends and the opponent leaves, the remaining player
  // bounces back to MatchmakingScene's "waiting with this code" view —
  // socket stays connected so a new opponent can simply join again.
  async rejoinWaitingRoom(roomCode: string): Promise<void> {
    this.pendingWaitingRoomCode = roomCode;
    await this.sceneManager.switchTo(MatchmakingScene);
  }

  consumePendingWaitingRoomCode(): string | null {
    const code = this.pendingWaitingRoomCode;
    this.pendingWaitingRoomCode = null;
    return code;
  }

  // Start a single-player sprint. Server auto-starts when the room fills
  // (capacity = 1), so the client just connects and waits for game_start.
  async startSinglePlayer(): Promise<void> {
    await this.sceneManager.switchTo(LoadingScene);
    const token = authState.getToken();
    if (!token) throw new Error("No auth token");

    const { roomCode } = await roomApi.create({ mode: "single" }, token);
    await this.connectAndPlay(roomCode, "single");
  }

  // Create a new 1v1 room and share the code with a friend.
  async createRoom1v1(): Promise<string> {
    const token = authState.getToken();
    if (!token) throw new Error("No auth token");
    const { roomCode } = await roomApi.create({ mode: "1v1" }, token);
    await this.connectAndPlay(roomCode, "one_on_one");
    return roomCode;
  }

  // Join an existing 1v1 room by code.
  async joinRoom1v1(roomCode: string): Promise<void> {
    await this.connectAndPlay(roomCode, "one_on_one");
  }

  // Used for rematch votes in 1v1 (first game auto-starts on capacity fill).
  sendReady(): void {
    this.socket?.send({ kind: "ready" });
  }

  private async connectAndPlay(
    roomCode: string,
    gameType: GameType,
  ): Promise<void> {
    const token = authState.getToken();
    if (!token) throw new Error("No auth token");

    this.teardownSocket();
    const socket = new RoomSocket(roomApi.wsUrl(roomCode), token);
    this.socket = socket;

    // `game_start` is emitted by the server on both first-game auto-start
    // and successful rematch votes. Either way, rebuild state and mount
    // GameScene (the scene manager destroys any prior scene).
    socket.on("game_start", async (msg: { puzzles: Puzzle[]; startedAt: number }) => {
      const images = await this.loadPuzzleImages(msg.puzzles);
      const differences = this.buildSelectedDifferences(images);
      gameState.initGame(roomCode, images, differences, gameType, msg.startedAt);
      await this.sceneManager.switchTo(GameScene);
    });

    await socket.connect();
  }

  private teardownSocket(): void {
    if (this.socket) {
      this.socket.close();
      this.socket.removeAllListeners();
      this.socket = null;
    }
  }

  private puzzleToImageData(p: Puzzle): ImageData {
    const diffRects: DiffRect[] = p.differences.map((d) => ({
      id: d.id,
      start_point: { x: d.sp.x, y: d.sp.y },
      width: d.w,
      height: d.h,
    }));
    return {
      id: p.id,
      originalUrl: `${CDN_BASE}${p.path}.${p.extension}`,
      differentUrl: `${CDN_BASE}${p.path}_d.${p.extension}`,
      diffRects,
    };
  }

  private async loadPuzzleImages(puzzles: Puzzle[]): Promise<ImageData[]> {
    const images = puzzles.map((p) => this.puzzleToImageData(p));
    const results = await Promise.all(
      images.map((img) =>
        Promise.all([Assets.load(img.originalUrl), Assets.load(img.differentUrl)])
          .then(() => img)
          .catch(() => null),
      ),
    );
    return results.filter((r): r is ImageData => r !== null);
  }

  private buildSelectedDifferences(images: ImageData[]): SelectedDifference[][] {
    return images.map((image, imageIndex) =>
      image.diffRects.map((rect, diffIndex) => ({
        imageIndex,
        diffIndex,
        rect,
        found: false,
      })),
    );
  }
}

export let game: Game;

export function setGameInstance(g: Game): void {
  game = g;
}
