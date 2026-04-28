import { Application, Container, Assets, Graphics, Sprite } from "pixi.js";
import type { IScene, DiffRect } from "../types";
import {
  IMAGE_WIDTH,
  IMAGE_HEIGHT,
  IMAGE_GAP,
  UI_PADDING,
  WRONG_CLICK_COOLDOWN_MS,
  IMAGES_PER_GAME,
  COLORS,
  MARKER_COLOR,
  MARKER_HINT_COLOR,
} from "../constants";
import { gameState } from "../managers/GameStateManager";
import { authState } from "../managers/AuthStateManager";
import { game } from "../core/Game";
import { ImagePanel } from "../components/ImagePanel";
import { MaskedDiffSprite } from "../components/MaskedDiffSprite";
import { DiffMarker } from "../components/DiffMarker";
import { NavButtons } from "../components/NavButtons";
import { MenuIcon } from "../components/MenuIcon";
import { CelebrationEffect } from "../components/CelebrationEffect";
import { CountdownOverlay } from "../components/CountdownOverlay";
import { HintOverlay } from "../components/HintOverlay";
import { useUIStore } from "../ui/store";

export class GameScene extends Container implements IScene {
  private app: Application;

  // Game area
  private gameArea: Container;
  private leftPanel: ImagePanel | null = null;
  private rightPanelContainer: Container;
  private rightBackgroundSprite: Sprite | null = null;
  private rightMaskedSprite: MaskedDiffSprite | null = null;
  private rightMarkersContainer: Container;
  private rightHitArea: Container | null = null;

  // UI (Pixi: in-canvas controls). Text-heavy HUD + modals live in the React
  // layer — see src/ui/react + ui/store.
  private uiLayer: Container;
  private navButtons: NavButtons;
  private menuIcon: MenuIcon;

  // Overlays
  private overlayLayer: Container;
  private countdownOverlay: CountdownOverlay;
  private celebrationEffect: CelebrationEffect;

  // Placeholder
  private placeholderContainer: Container;

  // Layout
  private imageScale: number = 1;

  // Click handling — optimistic UI; server decides canonical truth
  private pendingClicks = 0;

  // End-of-game state (set once game_end arrives)
  private gameEnded = false;

  // When non-null, `update()` freezes the timer at this value. Used to show
  // the server's final elapsedMs verbatim after game_end.
  private timerFrozenAtSec: number | null = null;

  // Track listener off-handles so we can detach on destroy without using
  // gameState.removeAllListeners() (which would also wipe the uiStore bridge).
  private offStateListeners: (() => void)[] = [];
  private offClickResult?: () => void;
  private offGameEnd?: () => void;
  private offPlayerLeft?: () => void;
  private offPlayerOffline?: () => void;
  private offPlayerOnline?: () => void;
  private offPlayerReady?: () => void;
  private offHintRevealed?: () => void;
  private offKeyDown?: () => void;

  // Hint mode state. The overlays mirror `gameState.pendingHint`; we keep
  // direct references so they can be removed without rebuilding the panels.
  private hintOverlayLeft: HintOverlay | null = null;
  private hintOverlayRight: HintOverlay | null = null;

  constructor(app: Application) {
    super();
    this.app = app;

    this.gameArea = new Container();
    this.rightPanelContainer = new Container();
    this.rightMarkersContainer = new Container();
    this.uiLayer = new Container();
    this.overlayLayer = new Container();
    this.placeholderContainer = new Container();

    this.navButtons = new NavButtons();
    this.menuIcon = new MenuIcon();
    this.countdownOverlay = new CountdownOverlay(app.screen.width, app.screen.height);
    this.celebrationEffect = new CelebrationEffect();

    this.addChild(this.placeholderContainer, this.gameArea, this.uiLayer, this.overlayLayer);
  }

  async init(): Promise<void> {
    this.setupLayout();
    this.setupUI();
    this.setupOverlays();
    this.setupStateListeners();
    this.setupSocketListeners();
    this.setupKeyboardShortcuts();

    // React overlay reads from the store; publish HUD + wire modal callbacks.
    const ui = useUIStore.getState();
    ui.mountHud();
    ui.setCallbacks({
      onResume: () => this.resumeGame(),
      onMainMenu: () => game.showMainMenu(),
      onPlayAgain: () => this.handlePlayAgain(),
      onPauseRequest: () => this.showPauseMenu(),
    });

    this.createPlaceholders();
    this.gameArea.visible = false;

    this.loadCurrentImage();

    const state = gameState.getState();
    const remaining = state.serverStartedAt ? state.serverStartedAt - Date.now() : 0;
    if (remaining > 200) {
      // Countdown is cosmetic; the authoritative start moment is
      // state.serverStartedAt — both clients reveal the board at that
      // instant regardless of their image-load / countdown variance.
      this.countdownOverlay.play().catch(() => {
        /* swallow */
      });
      await new Promise((r) => setTimeout(r, remaining));
      this.countdownOverlay.visible = false;
    }

    this.placeholderContainer.removeChildren();
    this.gameArea.visible = true;
  }

  private setupLayout(): void {
    const screenWidth = this.app.screen.width;
    const screenHeight = this.app.screen.height;

    const availableWidth = screenWidth - IMAGE_GAP - UI_PADDING * 2;
    const availableHeight = screenHeight - UI_PADDING * 2 - 80;
    const maxImageWidth = availableWidth / 2;

    const scaleX = maxImageWidth / IMAGE_WIDTH;
    const scaleY = availableHeight / IMAGE_HEIGHT;
    this.imageScale = Math.min(scaleX, scaleY, 1);

    const scaledWidth = IMAGE_WIDTH * this.imageScale;
    const scaledHeight = IMAGE_HEIGHT * this.imageScale;

    const totalWidth = scaledWidth * 2 + IMAGE_GAP;
    const startX = (screenWidth - totalWidth) / 2;
    const startY = (screenHeight - scaledHeight) / 2 + 20;

    this.gameArea.position.set(startX, startY);
  }

  private createPlaceholders(): void {
    const scaledWidth = IMAGE_WIDTH * this.imageScale;
    const scaledHeight = IMAGE_HEIGHT * this.imageScale;

    this.placeholderContainer.position.copyFrom(this.gameArea.position);

    const leftPlaceholder = new Graphics();
    leftPlaceholder.roundRect(0, 0, scaledWidth, scaledHeight, 8);
    leftPlaceholder.fill({ color: COLORS.surfaceSunken });
    leftPlaceholder.stroke({ width: 1, color: COLORS.border });
    this.placeholderContainer.addChild(leftPlaceholder);

    const rightPlaceholder = new Graphics();
    rightPlaceholder.roundRect(scaledWidth + IMAGE_GAP, 0, scaledWidth, scaledHeight, 8);
    rightPlaceholder.fill({ color: COLORS.surfaceSunken });
    rightPlaceholder.stroke({ width: 1, color: COLORS.border });
    this.placeholderContainer.addChild(rightPlaceholder);
  }

  private setupUI(): void {
    const state = gameState.getState();

    if (state.gameType !== "one_on_one") {
      this.menuIcon.position.set(this.app.screen.width - UI_PADDING - 44, UI_PADDING);
      this.menuIcon.setCallback(() => this.showPauseMenu());
      this.uiLayer.addChild(this.menuIcon);
    }

    this.navButtons.position.set(
      this.app.screen.width / 2 - 55,
      this.app.screen.height - UI_PADDING - 50,
    );
    this.navButtons.setCallbacks(
      () => gameState.prevImage(),
      () => gameState.nextImage(),
    );
    this.navButtons.updateState(0, IMAGES_PER_GAME);
    this.uiLayer.addChild(this.navButtons);
    // HUD state (foundCount, currentImageIndex, opponentFoundCount, gameType)
    // was hydrated from gameState by ui.mountHud() in init() and stays in
    // sync via the store<->gameState bridge. Nothing to wire here.
  }

  private setupOverlays(): void {
    // Modal callbacks are registered on the store in init(); nothing to wire
    // here beyond the still-Pixi overlays below.
    this.overlayLayer.addChild(this.countdownOverlay);
    this.overlayLayer.addChild(this.celebrationEffect);
  }

  private handlePlayAgain(): void {
    const state = gameState.getState();
    if (state.gameType === "one_on_one") {
      // Rematch path: stay in the same room; send `ready` and wait for the
      // opponent. Game.ts handles the transition on the next `game_start`.
      game.sendReady();
      useUIStore.getState().markRematchPending();
    } else {
      game.startSinglePlayer();
    }
  }

  private setupStateListeners(): void {
    // Text counters (foundCount, imageIndex, opponentCount) are mirrored into
    // the React store by src/ui/store.ts — this scene only listens for the
    // side effects that affect Pixi objects.
    const on = <T>(event: string, handler: (payload: T) => void) => {
      gameState.on(event, handler);
      this.offStateListeners.push(() => gameState.off(event, handler));
    };

    on<{ diffIndex: number }>("differenceFound", ({ diffIndex }) => {
      this.addMarkerForDiff(diffIndex);
    });

    on<void>("imageCompleted", () => {
      this.playCelebration();
    });

    on<number>("imageChanged", (index) => {
      // Panels are about to be rebuilt; drop hint overlay refs (otherwise
      // their RAF callbacks keep ticking against orphaned Graphics).
      this.hideHintOverlays();
      this.loadCurrentImage();
      this.navButtons.updateState(index, IMAGES_PER_GAME);
    });

    on<void>("inputDisabled", () => this.setInputEnabled(false));
    on<void>("inputEnabled", () => this.setInputEnabled(true));

    on<{ rect: DiffRect }>("hintEntered", ({ rect }) => {
      this.showHintOverlays(rect);
      this.navButtons.setForceDisabled(true);
    });
    on<void>("hintExited", () => {
      this.hideHintOverlays();
      this.navButtons.setForceDisabled(false);
    });

    // Timer is now server-driven (see update()); modeChanged just governs
    // input via other listeners. Likewise, gameCompleted/gameLost are
    // no-ops here — the result screen is driven by `game_end` from the
    // socket layer.
  }

  private setupSocketListeners(): void {
    const socket = game.getSocket();
    if (!socket) return;

    const myId = authState.getUser()?.userId;

    const onClick = (msg: {
      userId: string;
      puzzleIdx: number;
      hit: boolean;
      diffId?: string;
      foundCount: number;
    }) => {
      if (msg.userId === myId) {
        this.pendingClicks = Math.max(0, this.pendingClicks - 1);
        if (msg.hit && msg.diffId) {
          gameState.markDifferenceFoundById(msg.puzzleIdx, msg.diffId);
        } else if (!msg.hit) {
          this.handleWrongClick();
        }
      } else {
        gameState.handleOpponentDifferenceFound(msg.foundCount);
      }
    };

    const onEnd = (msg: {
      winnerId: string | null;
      results: {
        userId: string;
        name: string;
        elapsedMs: number | null;
        foundCount: number;
        hintsUsed: number;
      }[];
    }) => {
      this.gameEnded = true;
      const state = gameState.getState();

      if (msg.winnerId && msg.winnerId !== myId) {
        gameState.handleGameEnded(msg.winnerId);
      }

      const mine = msg.results.find((r) => r.userId === myId);
      const opp = msg.results.find((r) => r.userId !== myId);
      const myElapsedSec = mine?.elapsedMs != null ? mine.elapsedMs / 1000 : 0;
      const winnerElapsedSec =
        msg.results.find((r) => r.userId === msg.winnerId)?.elapsedMs ?? null;
      this.timerFrozenAtSec = myElapsedSec;

      const ui = useUIStore.getState();
      if (state.gameType === "one_on_one") {
        const isWin = msg.winnerId === myId;
        // Winner pays attention to time, loser to progress; pass both so the
        // modal can pick. Fallback opponent name covers the timeout-no-result
        // case where the room had no one but us.
        const elapsedForModal = isWin
          ? myElapsedSec
          : winnerElapsedSec != null
            ? winnerElapsedSec / 1000
            : 0;
        const myFound = mine?.foundCount ?? state.foundCount;
        const oppFound = opp?.foundCount ?? state.opponentFoundCount ?? 0;
        const opponentName = opp?.name ?? state.opponentUsername ?? "Opponent";
        ui.showComplete1v1(
          isWin ? "win" : "lose",
          elapsedForModal,
          myFound,
          oppFound,
          opponentName,
        );
      } else if (state.gameType === "daily") {
        // Daily attempts are 1-shot — the modal carries the share card
        // payload. UTC date defaults to today since the room itself was
        // started with that date frozen server-side.
        ui.showCompleteDaily({
          elapsedSec: msg.winnerId === myId ? myElapsedSec : null,
          foundCount: mine?.foundCount ?? state.foundCount,
          date: new Date().toISOString().slice(0, 10),
          hintsUsed: mine?.hintsUsed ?? state.hintsUsed,
        });
      } else {
        ui.showCompleteSingle(myElapsedSec);
      }
    };

    // Post-game rematch signal from the other player.
    const onPlayerReady = (msg: { userId: string }) => {
      if (!this.gameEnded) return;
      if (msg.userId === myId) return;
      useUIStore.getState().markOpponentRematch();
    };

    const onLeft = (msg: { userId: string }) => {
      if (msg.userId === myId) return;
      if (this.gameEnded) {
        // Post-game opponent bailed to lobby; keep the room open and show
        // the waiting-for-opponent UI with the same code.
        game.rejoinWaitingRoom(gameState.getState().roomCode);
      }
    };

    const onOffline = (msg: { userId: string }) => {
      if (msg.userId === myId) return;
      this.setOpponentOnline(false);
    };
    const onOnline = (msg: { userId: string }) => {
      if (msg.userId === myId) return;
      this.setOpponentOnline(true);
    };

    const onHintRevealed = (msg: {
      userId: string;
      puzzleIdx: number;
      diffId: string;
      foundCount: number;
      hintsUsed: number;
      cooldownMs: number;
    }) => {
      // Hint is scoped to the puzzle the player was viewing when they asked,
      // so no navigation is needed. We hold off on marking the diff found
      // locally — entering "hint pending" mode instead — until the player
      // clicks the highlighted rect. The server already counted it, so a
      // refresh would surface it as a regular gray marker (acceptable per
      // product call: pending state is not restored across reloads).
      if (msg.userId !== myId) return;
      gameState.recordHintUsed(msg.hintsUsed);
      useUIStore.getState().recordHintUsed(msg.cooldownMs, msg.hintsUsed);
      // Snap to the hinted puzzle if the player swapped pages between the
      // request and this response. Otherwise the spotlight would land on
      // the wrong image.
      if (gameState.getState().currentImageIndex !== msg.puzzleIdx) {
        gameState.navigateToImage(msg.puzzleIdx);
      }
      const ok = gameState.enterHintMode(msg.puzzleIdx, msg.diffId);
      if (!ok) {
        // Fallback: rect lookup failed (e.g., diff already found by stale
        // state). Mark it found the old way so we don't get stuck.
        gameState.markDifferenceFoundById(msg.puzzleIdx, msg.diffId, true);
      }
    };

    socket.on("click_result", onClick);
    socket.on("game_end", onEnd);
    socket.on("player_left", onLeft);
    socket.on("player_offline", onOffline);
    socket.on("player_online", onOnline);
    socket.on("player_ready", onPlayerReady);
    socket.on("hint_revealed", onHintRevealed);
    this.offClickResult = () => socket.off("click_result", onClick);
    this.offGameEnd = () => socket.off("game_end", onEnd);
    this.offPlayerLeft = () => socket.off("player_left", onLeft);
    this.offPlayerOffline = () => socket.off("player_offline", onOffline);
    this.offPlayerOnline = () => socket.off("player_online", onOnline);
    this.offPlayerReady = () => socket.off("player_ready", onPlayerReady);
    this.offHintRevealed = () => socket.off("hint_revealed", onHintRevealed);
  }

  private setupKeyboardShortcuts(): void {
    // Use e.code (physical key) so the shortcut survives IME composition —
    // e.key would surface the composed Korean jamo when 한/영 is set to Korean.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "KeyA" && e.code !== "KeyD") return;
      if (e.repeat) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }

      if (gameState.getState().mode !== "playing") return;
      if (useUIStore.getState().modal.type !== "none") return;
      // Block a/d while a hint is pending — the player should resolve the
      // highlighted rect on this puzzle before navigating away.
      if (gameState.getState().pendingHint) return;

      e.preventDefault();
      if (e.code === "KeyA") {
        gameState.prevImage();
      } else {
        gameState.nextImage();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    this.offKeyDown = () => window.removeEventListener("keydown", onKeyDown);
  }

  private setOpponentOnline(online: boolean): void {
    useUIStore.getState().setOpponentOnline(online);
  }

  private loadCurrentImage(): void {
    const state = gameState.getState();
    const currentImage = state.selectedImages[state.currentImageIndex];
    const currentDiffs = state.selectedDifferences[state.currentImageIndex];

    if (!currentImage) return;

    this.gameArea.removeChildren();

    const originalTexture = Assets.get(currentImage.originalUrl);
    const differentTexture = Assets.get(currentImage.differentUrl);

    this.leftPanel = new ImagePanel(originalTexture);
    this.leftPanel.scale.set(this.imageScale);
    this.leftPanel.setDifferences(currentDiffs, (x, y) => this.handleClickAt(x, y));
    this.gameArea.addChild(this.leftPanel);

    this.rightPanelContainer = new Container();
    this.rightPanelContainer.position.set(IMAGE_WIDTH * this.imageScale + IMAGE_GAP, 0);
    this.rightPanelContainer.scale.set(this.imageScale);

    this.rightBackgroundSprite = new Sprite(originalTexture);
    this.rightPanelContainer.addChild(this.rightBackgroundSprite);

    this.rightMaskedSprite = new MaskedDiffSprite(differentTexture);
    this.rightMaskedSprite.setDifferences(currentDiffs);
    this.rightPanelContainer.addChild(this.rightMaskedSprite);

    this.rightMarkersContainer = new Container();
    this.rightPanelContainer.addChild(this.rightMarkersContainer);

    this.rightHitArea = this.createRightHitArea();
    this.rightPanelContainer.addChild(this.rightHitArea);

    this.gameArea.addChild(this.rightPanelContainer);
    this.updateMarkers();
  }

  private createRightHitArea(): Container {
    const hitContainer = new Container();
    const fullHitArea = new Graphics();
    fullHitArea.rect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
    fullHitArea.fill({ color: 0xffffff, alpha: 0 });
    fullHitArea.eventMode = "static";
    fullHitArea.cursor = "default";
    fullHitArea.on("pointerdown", (event) => {
      if (gameState.getState().inputDisabled) return;
      const localPos = event.getLocalPosition(fullHitArea);
      this.handleClickAt(localPos.x, localPos.y);
    });
    hitContainer.addChild(fullHitArea);
    return hitContainer;
  }

  // Click → server via WS; response handled in setupSocketListeners.
  private handleClickAt(x: number, y: number): void {
    const state = gameState.getState();
    if (state.inputDisabled || state.mode !== "playing") return;

    // Hint pending: only the highlighted rect is interactive. Off-target
    // clicks are silent no-ops (no wrong-click penalty — telling the user
    // exactly where to click and then punishing them for missing the dim
    // area would be hostile).
    if (state.pendingHint) {
      const r = state.pendingHint.rect;
      const inside =
        x >= r.start_point.x &&
        x <= r.start_point.x + r.width &&
        y >= r.start_point.y &&
        y <= r.start_point.y + r.height;
      if (!inside) return;
      // Server already counted the diff on hint_revealed; resolve locally
      // and exit hint mode. No `click` is sent.
      gameState.markDifferenceFoundById(
        state.pendingHint.puzzleIdx,
        state.pendingHint.diffId,
        true,
      );
      gameState.exitHintMode();
      return;
    }

    if (this.pendingClicks > 2) return; // crude backpressure

    const socket = game.getSocket();
    if (!socket) return;

    this.pendingClicks++;
    socket.send({
      kind: "click",
      puzzleIdx: state.currentImageIndex,
      x: Math.round(x),
      y: Math.round(y),
    });
  }

  private handleWrongClick(): void {
    const state = gameState.getState();
    if (state.inputDisabled) return;

    this.leftPanel?.showWrongClickFeedback();
    this.showRightPanelWrongClickFeedback();

    gameState.disableInputTemporarily(WRONG_CLICK_COOLDOWN_MS);
  }

  private showRightPanelWrongClickFeedback(): void {
    if (this.rightBackgroundSprite) this.rightBackgroundSprite.tint = 0xff8888;
    if (this.rightMaskedSprite) this.rightMaskedSprite.setTint(0xff8888);
    setTimeout(() => {
      if (this.rightBackgroundSprite) this.rightBackgroundSprite.tint = 0xffffff;
      if (this.rightMaskedSprite) this.rightMaskedSprite.setTint(0xffffff);
    }, 200);
  }

  private updateMarkers(): void {
    const state = gameState.getState();
    const currentDiffs = state.selectedDifferences[state.currentImageIndex];

    this.leftPanel?.updateMarkers();

    this.rightMarkersContainer.removeChildren();
    for (const diff of currentDiffs) {
      if (diff.found) {
        const centerX = diff.rect.start_point.x + diff.rect.width / 2;
        const centerY = diff.rect.start_point.y + diff.rect.height / 2;
        const color = diff.viaHint ? MARKER_HINT_COLOR : MARKER_COLOR;
        const marker = new DiffMarker(centerX, centerY, undefined, false, color);
        this.rightMarkersContainer.addChild(marker);
      }
    }
  }

  private addMarkerForDiff(diffIndex: number): void {
    const state = gameState.getState();
    const diff = state.selectedDifferences[state.currentImageIndex][diffIndex];
    if (!diff?.found) return;

    const centerX = diff.rect.start_point.x + diff.rect.width / 2;
    const centerY = diff.rect.start_point.y + diff.rect.height / 2;

    this.leftPanel?.addMarkerForDiff(diffIndex);

    const color = diff.viaHint ? MARKER_HINT_COLOR : MARKER_COLOR;
    const marker = new DiffMarker(centerX, centerY, undefined, true, color);
    this.rightMarkersContainer.addChild(marker);
  }

  private showHintOverlays(rect: DiffRect): void {
    // Defensive: drop any stale overlays from a prior hint before mounting.
    this.hideHintOverlays();
    if (this.leftPanel) {
      this.hintOverlayLeft = new HintOverlay(rect);
      this.leftPanel.addChild(this.hintOverlayLeft);
    }
    if (this.rightPanelContainer) {
      this.hintOverlayRight = new HintOverlay(rect);
      this.rightPanelContainer.addChild(this.hintOverlayRight);
    }
  }

  private hideHintOverlays(): void {
    if (this.hintOverlayLeft) {
      this.hintOverlayLeft.destroy();
      this.hintOverlayLeft = null;
    }
    if (this.hintOverlayRight) {
      this.hintOverlayRight.destroy();
      this.hintOverlayRight = null;
    }
  }

  private setInputEnabled(enabled: boolean): void {
    this.leftPanel?.setInputEnabled(enabled);
    if (this.rightHitArea) {
      for (const child of this.rightHitArea.children) {
        child.eventMode = enabled ? "static" : "none";
        child.cursor = enabled ? "default" : "not-allowed";
      }
    }
  }

  private async playCelebration(): Promise<void> {
    this.setInputEnabled(false);

    const centerX = this.gameArea.x + (IMAGE_WIDTH * this.imageScale * 2 + IMAGE_GAP) / 2;
    const centerY = this.gameArea.y + (IMAGE_HEIGHT * this.imageScale) / 2;

    await this.celebrationEffect.play(centerX, centerY);

    const state = gameState.getState();
    if (state.currentImageIndex < IMAGES_PER_GAME - 1 && state.mode !== "completed") {
      setTimeout(() => gameState.nextImage(), 300);
    }

    if (state.mode === "playing") {
      this.setInputEnabled(true);
    }
  }

  private showPauseMenu(): void {
    gameState.pause();
    this.createPlaceholders();
    this.gameArea.visible = false;
    useUIStore.getState().openPause();
  }

  private resumeGame(): void {
    gameState.resume();
    this.placeholderContainer.removeChildren();
    this.gameArea.visible = true;
    useUIStore.getState().closePause();
  }

  update(_deltaTime: number): void {
    const ui = useUIStore.getState();
    if (this.timerFrozenAtSec != null) {
      ui.setTimerSec(this.timerFrozenAtSec);
      return;
    }
    // gameState owns pause-time accounting so the timer freezes while the
    // pause modal is up (single mode) and resumes from where it left off.
    ui.setTimerSec(gameState.getEffectiveElapsedMs() / 1000);
  }

  resize(width: number, height: number): void {
    this.setupLayout();
    this.menuIcon.position.set(width - UI_PADDING - 44, UI_PADDING);
    this.navButtons.position.set(width / 2 - 55, height - UI_PADDING - 50);
    this.countdownOverlay.resize(width, height);

    if (this.placeholderContainer.children.length > 0) {
      this.placeholderContainer.removeChildren();
      this.createPlaceholders();
    }

    if (this.gameArea.visible) {
      this.loadCurrentImage();
    }
  }

  destroy(): void {
    this.offClickResult?.();
    this.offGameEnd?.();
    this.offPlayerLeft?.();
    this.offPlayerOffline?.();
    this.offPlayerOnline?.();
    this.offPlayerReady?.();
    this.offHintRevealed?.();
    this.offKeyDown?.();
    for (const off of this.offStateListeners) off();
    this.offStateListeners = [];

    this.hideHintOverlays();

    useUIStore.getState().unmountHud();

    this.removeAllListeners();
    super.destroy({ children: true });
  }
}
