import { Container, Graphics, Text } from "pixi.js";
import { COLORS } from "../constants";

export class GameCompleteScreen extends Container {
  private background: Graphics;
  private contentContainer: Container;
  private onMainMenu: (() => void) | null = null;
  private onPlayAgain: (() => void) | null = null;

  // Refs for dynamic updates (e.g. rematch "waiting for opponent" state).
  private playAgainBtn: Container | null = null;
  private playAgainBg: Graphics | null = null;
  private playAgainText: Text | null = null;

  constructor(screenWidth: number, screenHeight: number) {
    super();

    // Semi-transparent background
    this.background = new Graphics();
    this.background.rect(0, 0, screenWidth, screenHeight);
    this.background.fill({ color: COLORS.overlay, alpha: 0.85 });
    this.background.eventMode = "static";
    this.addChild(this.background);

    // Content container
    this.contentContainer = new Container();
    this.contentContainer.position.set(screenWidth / 2, screenHeight / 2);
    this.addChild(this.contentContainer);

    // Hidden by default
    this.visible = false;
  }

  show(elapsedTime: number, rank?: number): void {
    // Clear previous content
    this.contentContainer.removeChildren();

    // Background panel
    const panelWidth = 400;
    const panelHeight = rank ? 400 : 350;
    const panel = new Graphics();
    panel.roundRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    panel.fill(0x2a2a4e);
    this.contentContainer.addChild(panel);

    // Title
    const title = new Text({
      text: "Congratulations!",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 36,
        fontWeight: "bold",
        fill: COLORS.success,
      },
    });
    title.anchor.set(0.5);
    title.position.set(0, -panelHeight / 2 + 50);
    this.contentContainer.addChild(title);

    // Subtitle
    const subtitle = new Text({
      text: "You found all differences!",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 20,
        fill: COLORS.textSecondary,
      },
    });
    subtitle.anchor.set(0.5);
    subtitle.position.set(0, -panelHeight / 2 + 100);
    this.contentContainer.addChild(subtitle);

    // Time display
    const minutes = Math.floor(elapsedTime / 60);
    const seconds = Math.floor(elapsedTime % 60);
    const timeString = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

    const timeLabel = new Text({
      text: "Your Time",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 18,
        fill: COLORS.textSecondary,
      },
    });
    timeLabel.anchor.set(0.5);
    timeLabel.position.set(0, -panelHeight / 2 + 140);
    this.contentContainer.addChild(timeLabel);

    const timeText = new Text({
      text: timeString,
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 56,
        fontWeight: "bold",
        fill: COLORS.text,
      },
    });
    timeText.anchor.set(0.5);
    timeText.position.set(0, -panelHeight / 2 + 190);
    this.contentContainer.addChild(timeText);

    // Rank display
    let buttonsOffsetY = -panelHeight / 2 + 240;
    if (rank !== undefined) {
      const rankText = new Text({
        text: `Rank #${rank}`,
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 28,
          fontWeight: "bold",
          fill: rank <= 3 ? 0xffd700 : COLORS.primary,
        },
      });
      rankText.anchor.set(0.5);
      rankText.position.set(0, -panelHeight / 2 + 240);
      this.contentContainer.addChild(rankText);
      buttonsOffsetY = -panelHeight / 2 + 290;
    }

    // Play Again button
    const parts = this.createButtonParts("Play Again", buttonsOffsetY, COLORS.success);
    parts.button.on("pointerdown", () => this.onPlayAgain?.());
    this.contentContainer.addChild(parts.button);
    this.playAgainBtn = parts.button;
    this.playAgainBg = parts.bg;
    this.playAgainText = parts.text;

    // Main Menu button
    const mainMenuBtn = this.createButton("Main Menu", buttonsOffsetY + 60, COLORS.primary);
    mainMenuBtn.on("pointerdown", () => this.onMainMenu?.());
    this.contentContainer.addChild(mainMenuBtn);

    this.visible = true;
  }

  private createButton(label: string, yPosition: number, color: number): Container {
    const parts = this.createButtonParts(label, yPosition, color);
    return parts.button;
  }

  private createButtonParts(
    label: string,
    yPosition: number,
    color: number,
  ): { button: Container; bg: Graphics; text: Text } {
    const buttonWidth = 200;
    const buttonHeight = 50;
    const button = new Container();
    button.position.set(0, yPosition);

    const bg = new Graphics();
    bg.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);
    bg.fill(color);

    const text = new Text({
      text: label,
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 20,
        fontWeight: "bold",
        fill: COLORS.text,
      },
    });
    text.anchor.set(0.5);

    button.addChild(bg, text);

    button.eventMode = "static";
    button.cursor = "pointer";

    const hoverColor = color + 0x222222;
    button.on("pointerover", () => {
      if (button.eventMode === "none") return;
      bg.clear();
      bg.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);
      bg.fill(hoverColor);
    });

    button.on("pointerout", () => {
      if (button.eventMode === "none") return;
      bg.clear();
      bg.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);
      bg.fill(color);
    });

    return { button, bg, text };
  }

  showResult(
    result: "win" | "lose",
    elapsedTime: number,
    opts: { playAgainLabel?: string } = {},
  ): void {
    this.contentContainer.removeChildren();

    const panelWidth = 400;
    const panelHeight = 350;
    const panel = new Graphics();
    panel.roundRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    panel.fill(0x2a2a4e);
    this.contentContainer.addChild(panel);

    const isWin = result === "win";
    const title = new Text({
      text: isWin ? "You Win!" : "You Lost!",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 36,
        fontWeight: "bold",
        fill: isWin ? COLORS.success : COLORS.error,
      },
    });
    title.anchor.set(0.5);
    title.position.set(0, -panelHeight / 2 + 50);
    this.contentContainer.addChild(title);

    const subtitle = new Text({
      text: isWin ? "You found all differences first!" : "Your opponent finished first!",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 20,
        fill: COLORS.textSecondary,
      },
    });
    subtitle.anchor.set(0.5);
    subtitle.position.set(0, -panelHeight / 2 + 100);
    this.contentContainer.addChild(subtitle);

    // Time display
    const minutes = Math.floor(elapsedTime / 60);
    const seconds = Math.floor(elapsedTime % 60);
    const timeString = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

    const timeLabel = new Text({
      text: "Your Time",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 18,
        fill: COLORS.textSecondary,
      },
    });
    timeLabel.anchor.set(0.5);
    timeLabel.position.set(0, -panelHeight / 2 + 140);
    this.contentContainer.addChild(timeLabel);

    const timeText = new Text({
      text: timeString,
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 56,
        fontWeight: "bold",
        fill: COLORS.text,
      },
    });
    timeText.anchor.set(0.5);
    timeText.position.set(0, -panelHeight / 2 + 190);
    this.contentContainer.addChild(timeText);

    const buttonsOffsetY = -panelHeight / 2 + 240;

    const parts = this.createButtonParts(
      opts.playAgainLabel ?? "Play Again",
      buttonsOffsetY,
      COLORS.success,
    );
    parts.button.on("pointerdown", () => this.onPlayAgain?.());
    this.contentContainer.addChild(parts.button);
    this.playAgainBtn = parts.button;
    this.playAgainBg = parts.bg;
    this.playAgainText = parts.text;

    const mainMenuBtn = this.createButton("Main Menu", buttonsOffsetY + 60, COLORS.primary);
    mainMenuBtn.on("pointerdown", () => this.onMainMenu?.());
    this.contentContainer.addChild(mainMenuBtn);

    this.visible = true;
  }

  // Disables the "Play Again" button and relabels it. Used after a rematch
  // vote has been cast in 1v1 mode, while we wait for the opponent.
  markRematchPending(label: string = "Waiting for opponent..."): void {
    if (!this.playAgainBtn) return;
    this.playAgainBtn.eventMode = "none";
    this.playAgainBtn.cursor = "default";
    if (this.playAgainText) this.playAgainText.text = label;
    if (this.playAgainBg) {
      this.playAgainBg.tint = 0x888888;
    }
  }

  hide(): void {
    this.visible = false;
  }

  setCallbacks(onPlayAgain: () => void, onMainMenu: () => void): void {
    this.onPlayAgain = onPlayAgain;
    this.onMainMenu = onMainMenu;
  }

  resize(screenWidth: number, screenHeight: number): void {
    this.background.clear();
    this.background.rect(0, 0, screenWidth, screenHeight);
    this.background.fill({ color: COLORS.overlay, alpha: 0.85 });

    this.contentContainer.position.set(screenWidth / 2, screenHeight / 2);
  }
}
