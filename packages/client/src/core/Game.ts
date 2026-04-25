import { Application, Assets } from "pixi.js";
import type { Puzzle, ServerWelcome } from "@differ/shared";
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

// Persisted on game_start (or welcome-in-progress) so a tab close/reopen
// during an active game can rejoin automatically instead of dumping the
// player back on the main menu.
const ACTIVE_ROOM_KEY = "differ_active_room";
type PersistedRoom = { roomCode: string; gameType: GameType };

function readActiveRoom(): PersistedRoom | null {
  try {
    const raw = localStorage.getItem(ACTIVE_ROOM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedRoom;
    if (!parsed?.roomCode || !parsed?.gameType) return null;
    return parsed;
  } catch {
    return null;
  }
}
function writeActiveRoom(roomCode: string, gameType: GameType): void {
  try {
    localStorage.setItem(ACTIVE_ROOM_KEY, JSON.stringify({ roomCode, gameType }));
  } catch {
    /* ignore */
  }
}
function clearActiveRoom(): void {
  try {
    localStorage.removeItem(ACTIVE_ROOM_KEY);
  } catch {
    /* ignore */
  }
}

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
    if (!restored) {
      await this.showAuthScene();
      return;
    }
    // Tab close/reopen during an active game: reconnect to the persisted
    // room and let the welcome-in-progress handler mount GameScene.
    const active = readActiveRoom();
    if (active) {
      const resumed = await this.tryResumeActiveRoom(active);
      if (resumed) return;
    }
    await this.showMainMenu();
  }

  private async tryResumeActiveRoom(active: PersistedRoom): Promise<boolean> {
    await this.sceneManager.switchTo(LoadingScene);
    try {
      return await this.connectAndPlay(active.roomCode, active.gameType, { resume: true });
    } catch {
      clearActiveRoom();
      this.teardownSocket();
      return false;
    }
  }

  async showAuthScene(): Promise<void> {
    await this.sceneManager.switchTo(AuthScene);
  }

  async showMainMenu(): Promise<void> {
    clearActiveRoom();
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
    if (!authState.isAuthenticated()) throw new Error("Not authenticated");

    const { roomCode } = await roomApi.create({ mode: "single" });
    await this.connectAndPlay(roomCode, "single");
  }

  // Create a new 1v1 room and share the code with a friend.
  async createRoom1v1(): Promise<string> {
    if (!authState.isAuthenticated()) throw new Error("Not authenticated");
    const { roomCode } = await roomApi.create({ mode: "1v1" });
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
    options: { resume?: boolean } = {},
  ): Promise<boolean> {
    if (!authState.isAuthenticated()) throw new Error("Not authenticated");

    this.teardownSocket();
    const socket = new RoomSocket(roomApi.wsUrl(roomCode));
    this.socket = socket;

    // `game_start` is emitted by the server on both first-game auto-start
    // and successful rematch votes. Either way, rebuild state and mount
    // GameScene (the scene manager destroys any prior scene).
    socket.on("game_start", async (msg: { puzzles: Puzzle[]; startedAt: number }) => {
      const images = await this.loadPuzzleImages(msg.puzzles);
      const differences = this.buildSelectedDifferences(images);
      gameState.initGame(roomCode, images, differences, gameType, msg.startedAt);
      writeActiveRoom(roomCode, gameType);
      await this.sceneManager.switchTo(GameScene);
    });

    // Game ended — the room reverts to a waiting/rematch lobby, so there
    // is no longer an in-progress session to auto-rejoin on next load.
    socket.on("game_end", () => {
      clearActiveRoom();
    });

    // Welcome-based rejoin: if the server says a game is already in
    // progress for this socket's user (i.e. we were already a player and
    // reconnected), hydrate from the welcome payload and mount GameScene.
    socket.on("welcome", async (msg: ServerWelcome) => {
      if (msg.status === "in_progress" && msg.puzzles && msg.startedAt != null) {
        await this.mountResumedGame(roomCode, gameType, msg);
      }
    });

    if (options.resume) {
      // Await welcome so the resume caller knows whether a GameScene was
      // actually mounted (true) or we should fall through to the main
      // menu (false — room is no longer in progress, or socket died).
      const welcomed = new Promise<boolean>((resolve) => {
        const onWelcome = (msg: ServerWelcome) => {
          socket.off("welcome", onWelcome);
          socket.off("close", onClose);
          resolve(msg.status === "in_progress");
        };
        const onClose = () => {
          socket.off("welcome", onWelcome);
          resolve(false);
        };
        socket.on("welcome", onWelcome);
        socket.on("close", onClose);
      });
      await socket.connect();
      return welcomed;
    }

    await socket.connect();
    return true;
  }

  private async mountResumedGame(
    roomCode: string,
    gameType: GameType,
    welcome: ServerWelcome,
  ): Promise<void> {
    if (!welcome.puzzles || welcome.startedAt == null) return;
    const images = await this.loadPuzzleImages(welcome.puzzles);
    const differences = this.buildSelectedDifferences(images);

    if (welcome.yourFound) {
      for (const entry of welcome.yourFound) {
        const diffs = differences[entry.puzzleIdx];
        if (!diffs) continue;
        const foundIds = new Set(entry.diffIds);
        for (const d of diffs) if (foundIds.has(d.rect.id)) d.found = true;
      }
    }

    const myId = authState.getUser()?.userId;
    const myFoundCount = differences.reduce((n, arr) => n + arr.filter((d) => d.found).length, 0);
    const opponentCount = welcome.progress?.find((p) => p.userId !== myId)?.foundCount ?? 0;
    const opponent = welcome.players.find((p) => p.userId !== myId);
    if (opponent) gameState.setOpponent(opponent.name, opponent.wins);

    gameState.initGame(
      roomCode,
      images,
      differences,
      gameType,
      welcome.startedAt,
      myFoundCount,
      opponentCount,
    );
    writeActiveRoom(roomCode, gameType);
    await this.sceneManager.switchTo(GameScene);
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
