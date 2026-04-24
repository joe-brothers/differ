import { Container, Graphics, Text } from "pixi.js";
import { COLORS } from "../constants";

export interface PlayerResultData {
  username: string;
  foundCount: number;
  elapsedTimeMs: number;
}

export class MatchResultScreen extends Container {
  private background: Graphics;
  private contentContainer: Container;
  private onPlayAgain: (() => void) | null = null;
  private onMainMenu: (() => void) | null = null;

  constructor(screenWidth: number, screenHeight: number) {
    super();

    this.background = new Graphics();
    this.background.rect(0, 0, screenWidth, screenHeight);
    this.background.fill({ color: COLORS.overlay, alpha: 0.85 });
    this.background.eventMode = "static";
    this.addChild(this.background);

    this.contentContainer = new Container();
    this.contentContainer.position.set(screenWidth / 2, screenHeight / 2);
    this.addChild(this.contentContainer);

    this.visible = false;
  }

  show(
    result: "win" | "lose" | "draw",
    myStats: PlayerResultData,
    opponentStats: PlayerResultData,
  ): void {
    this.contentContainer.removeChildren();

    const panelWidth = 420;
    const panelHeight = 400;
    const panel = new Graphics();
    panel.roundRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 20);
    panel.fill(0x2a2a4e);
    this.contentContainer.addChild(panel);

    // Result title
    const resultTexts: Record<string, { text: string; color: number }> = {
      win: { text: "You Win!", color: COLORS.success },
      lose: { text: "You Lose!", color: COLORS.error },
      draw: { text: "Draw!", color: COLORS.primary },
    };
    const { text: resultLabel, color: resultColor } = resultTexts[result];

    const title = new Text({
      text: resultLabel,
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 40,
        fontWeight: "bold",
        fill: resultColor,
      },
    });
    title.anchor.set(0.5);
    title.position.set(0, -150);
    this.contentContainer.addChild(title);

    // Player stats
    this.addPlayerStats("You", myStats, -70);
    this.addPlayerStats(opponentStats.username, opponentStats, 0);

    // Buttons
    const playAgainBtn = this.createButton("Play Again", 80, COLORS.success);
    playAgainBtn.on("pointerdown", () => this.onPlayAgain?.());
    this.contentContainer.addChild(playAgainBtn);

    const mainMenuBtn = this.createButton("Main Menu", 140, COLORS.primary);
    mainMenuBtn.on("pointerdown", () => this.onMainMenu?.());
    this.contentContainer.addChild(mainMenuBtn);

    this.visible = true;
  }

  private addPlayerStats(label: string, stats: PlayerResultData, yOffset: number): void {
    const ms = stats.elapsedTimeMs;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const timeStr = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

    const text = new Text({
      text: `${label}: ${stats.foundCount} found - ${timeStr}`,
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 18,
        fill: COLORS.text,
      },
    });
    text.anchor.set(0.5);
    text.position.set(0, yOffset);
    this.contentContainer.addChild(text);
  }

  private createButton(label: string, yPos: number, color: number): Container {
    const buttonWidth = 200;
    const buttonHeight = 50;
    const button = new Container();
    button.position.set(0, yPos);

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
      bg.clear();
      bg.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);
      bg.fill(hoverColor);
    });
    button.on("pointerout", () => {
      bg.clear();
      bg.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);
      bg.fill(color);
    });

    return button;
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
