import { Application, Container, Assets, Graphics, Sprite, Text } from "pixi.js";
import type { IScene } from "../types";
import {
  IMAGE_WIDTH,
  IMAGE_HEIGHT,
  IMAGE_GAP,
  UI_PADDING,
  WRONG_CLICK_COOLDOWN_MS,
  IMAGES_PER_GAME,
  TOTAL_DIFFS_PER_GAME,
  COLORS,
} from "../constants";
import { gameState } from "../managers/GameStateManager";
import { authState } from "../managers/AuthStateManager";
import { game } from "../core/Game";
import { ImagePanel } from "../components/ImagePanel";
import { MaskedDiffSprite } from "../components/MaskedDiffSprite";
import { DiffMarker } from "../components/DiffMarker";
import { Timer } from "../components/Timer";
import { NavButtons } from "../components/NavButtons";
import { ProgressDisplay } from "../components/ProgressDisplay";
import { MenuOverlay } from "../components/MenuOverlay";
import { MenuIcon } from "../components/MenuIcon";
import { CelebrationEffect } from "../components/CelebrationEffect";
import { GameCompleteScreen } from "../components/GameCompleteScreen";
import { CountdownOverlay } from "../components/CountdownOverlay";

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

  // UI
  private uiLayer: Container;
  private timer: Timer;
  private navButtons: NavButtons;
  private progressDisplay: ProgressDisplay;
  private menuIcon: MenuIcon;

  // Multiplayer UI
  private opponentProgressText: Text | null = null;

  // Overlays
  private overlayLayer: Container;
  private countdownOverlay: CountdownOverlay;
  private menuOverlay: MenuOverlay;
  private celebrationEffect: CelebrationEffect;
  private gameCompleteScreen: GameCompleteScreen;

  // Placeholder
  private placeholderContainer: Container;

  // Layout
  private imageScale: number = 1;

  // Click handling — optimistic UI; server decides canonical truth
  private pendingClicks = 0;

  // End-of-game state (set once game_end arrives)
  private gameEnded = false;
  private opponentOnline = true;

  // When non-null, `update()` freezes the timer at this value. Used to show
  // the server's final elapsedMs verbatim after game_end.
  private timerFrozenAtSec: number | null = null;

  // Track off-screen WS handlers so we can detach on destroy
  private offClickResult?: () => void;
  private offGameEnd?: () => void;
  private offPlayerLeft?: () => void;
  private offPlayerOffline?: () => void;
  private offPlayerOnline?: () => void;

  constructor(app: Application) {
    super();
    this.app = app;

    this.gameArea = new Container();
    this.rightPanelContainer = new Container();
    this.rightMarkersContainer = new Container();
    this.uiLayer = new Container();
    this.overlayLayer = new Container();
    this.placeholderContainer = new Container();

    this.timer = new Timer();
    this.navButtons = new NavButtons();
    this.progressDisplay = new ProgressDisplay();
    this.menuIcon = new MenuIcon();
    this.countdownOverlay = new CountdownOverlay(app.screen.width, app.screen.height);
    this.menuOverlay = new MenuOverlay(app.screen.width, app.screen.height);
    this.celebrationEffect = new CelebrationEffect();
    this.gameCompleteScreen = new GameCompleteScreen(app.screen.width, app.screen.height);

    this.addChild(this.placeholderContainer, this.gameArea, this.uiLayer, this.overlayLayer);
  }

  async init(): Promise<void> {
    this.setupLayout();
    this.setupUI();
    this.setupOverlays();
    this.setupStateListeners();
    this.setupSocketListeners();

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
    leftPlaceholder.fill({ color: 0x2a2a4e });
    leftPlaceholder.stroke({ width: 2, color: 0x4a4a6e });
    this.placeholderContainer.addChild(leftPlaceholder);

    const rightPlaceholder = new Graphics();
    rightPlaceholder.roundRect(scaledWidth + IMAGE_GAP, 0, scaledWidth, scaledHeight, 8);
    rightPlaceholder.fill({ color: 0x2a2a4e });
    rightPlaceholder.stroke({ width: 2, color: 0x4a4a6e });
    this.placeholderContainer.addChild(rightPlaceholder);
  }

  private setupUI(): void {
    this.timer.position.set(UI_PADDING, UI_PADDING);
    this.uiLayer.addChild(this.timer);

    this.progressDisplay.position.set(this.app.screen.width / 2 - 40, UI_PADDING);
    this.uiLayer.addChild(this.progressDisplay);

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

    if (state.gameType === "one_on_one") {
      this.opponentProgressText = new Text({
        text: `Opponent ${state.opponentFoundCount}/${TOTAL_DIFFS_PER_GAME}`,
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 16,
          fill: COLORS.textSecondary,
        },
      });
      // Right-aligned at top-right (menu icon is hidden in 1v1 mode).
      this.opponentProgressText.anchor.set(1, 0);
      this.opponentProgressText.position.set(this.app.screen.width - UI_PADDING, UI_PADDING);
      this.uiLayer.addChild(this.opponentProgressText);
    }

    // Hydrate my progress count too (non-zero on resume from a mid-game
    // reconnect where some diffs were already found before the reload).
    this.progressDisplay.updateFoundCount(state.foundCount);
  }

  private setupOverlays(): void {
    this.menuOverlay.setCallbacks(
      () => this.resumeGame(),
      () => game.showMainMenu(),
    );

    const state = gameState.getState();
    if (state.gameType === "one_on_one") {
      // Rematch path: stay in the same room; send `ready` and wait for the
      // opponent. Game.ts handles the transition on the next `game_start`.
      this.gameCompleteScreen.setCallbacks(
        () => this.requestRematch(),
        () => game.showMainMenu(),
      );
    } else {
      this.gameCompleteScreen.setCallbacks(
        () => game.startSinglePlayer(),
        () => game.showMainMenu(),
      );
    }
    this.overlayLayer.addChild(this.countdownOverlay);
    this.overlayLayer.addChild(this.menuOverlay);
    this.overlayLayer.addChild(this.celebrationEffect);
    this.overlayLayer.addChild(this.gameCompleteScreen);
  }

  private requestRematch(): void {
    game.sendReady();
    this.gameCompleteScreen.markRematchPending();
  }

  private setupStateListeners(): void {
    gameState.on("differenceFound", ({ diffIndex, total }) => {
      this.progressDisplay.updateFoundCount(total);
      this.addMarkerForDiff(diffIndex);
    });

    gameState.on("imageCompleted", () => {
      this.playCelebration();
    });

    // Completion is server-authoritative. On local completion we just pause
    // the timer; the result screen appears when the server's `game_end`
    // message arrives (handled in setupSocketListeners).
    gameState.on("gameCompleted", () => {
      // no-op: timer now read-only from server state
    });

    gameState.on("gameLost", () => {
      // no-op: timer now read-only from server state
    });

    gameState.on("imageChanged", (index: number) => {
      this.loadCurrentImage();
      this.progressDisplay.updateImageIndex(index);
      this.navButtons.updateState(index, IMAGES_PER_GAME);
    });

    gameState.on("inputDisabled", () => this.setInputEnabled(false));
    gameState.on("inputEnabled", () => this.setInputEnabled(true));

    // Timer is now server-driven (see update()); modeChanged just governs
    // input via other listeners.

    gameState.on("opponentDifferenceFound", () => {
      this.refreshOpponentText();
    });
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
      results: { userId: string; name: string; elapsedMs: number | null; foundCount: number }[];
    }) => {
      this.gameEnded = true;
      const state = gameState.getState();

      if (msg.winnerId && msg.winnerId !== myId) {
        gameState.handleGameEnded(msg.winnerId);
      }

      const mine = msg.results.find((r) => r.userId === myId);
      const myElapsedSec = mine?.elapsedMs != null ? mine.elapsedMs / 1000 : 0;
      this.timerFrozenAtSec = myElapsedSec;

      if (state.gameType === "one_on_one") {
        const isWin = msg.winnerId === myId;
        this.gameCompleteScreen.showResult(isWin ? "win" : "lose", myElapsedSec, {
          playAgainLabel: "Rematch",
        });
      } else {
        this.gameCompleteScreen.show(myElapsedSec);
      }
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

    socket.on("click_result", onClick);
    socket.on("game_end", onEnd);
    socket.on("player_left", onLeft);
    socket.on("player_offline", onOffline);
    socket.on("player_online", onOnline);
    this.offClickResult = () => socket.off("click_result", onClick);
    this.offGameEnd = () => socket.off("game_end", onEnd);
    this.offPlayerLeft = () => socket.off("player_left", onLeft);
    this.offPlayerOffline = () => socket.off("player_offline", onOffline);
    this.offPlayerOnline = () => socket.off("player_online", onOnline);
  }

  private setOpponentOnline(online: boolean): void {
    this.opponentOnline = online;
    this.refreshOpponentText();
  }

  private refreshOpponentText(): void {
    if (!this.opponentProgressText) return;
    const state = gameState.getState();
    const base = `Opponent ${state.opponentFoundCount}/${TOTAL_DIFFS_PER_GAME}`;
    this.opponentProgressText.text = this.opponentOnline ? base : `${base} (Disconnected)`;
    this.opponentProgressText.style.fill = this.opponentOnline
      ? COLORS.textSecondary
      : COLORS.error;
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
        const marker = new DiffMarker(centerX, centerY, undefined, false);
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

    const marker = new DiffMarker(centerX, centerY, undefined, true);
    this.rightMarkersContainer.addChild(marker);
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
    this.menuOverlay.show();
  }

  private resumeGame(): void {
    gameState.resume();
    this.placeholderContainer.removeChildren();
    this.gameArea.visible = true;
    this.menuOverlay.hide();
  }

  update(_deltaTime: number): void {
    if (this.timerFrozenAtSec != null) {
      this.timer.setTime(this.timerFrozenAtSec);
      return;
    }
    const state = gameState.getState();
    if (!state.serverStartedAt) return;
    const elapsedSec = Math.max(0, (Date.now() - state.serverStartedAt) / 1000);
    this.timer.setTime(elapsedSec);
  }

  resize(width: number, height: number): void {
    this.setupLayout();
    this.progressDisplay.position.set(width / 2 - 40, UI_PADDING);
    this.menuIcon.position.set(width - UI_PADDING - 44, UI_PADDING);
    this.navButtons.position.set(width / 2 - 55, height - UI_PADDING - 50);
    if (this.opponentProgressText) {
      this.opponentProgressText.position.set(width - UI_PADDING, UI_PADDING);
    }
    this.countdownOverlay.resize(width, height);
    this.menuOverlay.resize(width, height);
    this.gameCompleteScreen.resize(width, height);

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

    gameState.removeAllListeners();
    this.removeAllListeners();
    super.destroy({ children: true });
  }
}
