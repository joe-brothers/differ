import { Application, Container, Graphics, Text } from "pixi.js";
import type { IScene } from "../types";
import { COLORS, UI_PADDING } from "../constants";
import { game } from "../core/Game";
import { leaderboardApi } from "../network/rest";
import type { LeaderboardEntry } from "@differ/shared";

export class LeaderboardScene extends Container implements IScene {
  private app: Application;
  private entriesContainer: Container;
  private loadingText: Text | null = null;

  constructor(app: Application) {
    super();
    this.app = app;
    this.entriesContainer = new Container();
  }

  async init(): Promise<void> {
    this.createTitle();
    this.createBackButton();
    this.addChild(this.entriesContainer);

    // Show loading
    this.loadingText = new Text({
      text: "Loading...",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 20,
        fill: COLORS.textSecondary,
      },
    });
    this.loadingText.anchor.set(0.5);
    this.loadingText.position.set(
      this.app.screen.width / 2,
      this.app.screen.height / 2,
    );
    this.addChild(this.loadingText);

    // Fetch leaderboard
    try {
      const result = await leaderboardApi.list("single", 20, 0);
      this.loadingText.visible = false;
      this.renderEntries(result.entries);
    } catch {
      this.loadingText.text = "Failed to load leaderboard";
    }
  }

  private createTitle(): void {
    const title = new Text({
      text: "Leaderboard",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 40,
        fontWeight: "bold",
        fill: COLORS.text,
      },
    });
    title.anchor.set(0.5, 0);
    title.position.set(this.app.screen.width / 2, UI_PADDING);
    this.addChild(title);
  }

  private createBackButton(): void {
    const buttonWidth = 120;
    const buttonHeight = 40;
    const button = new Container();
    button.position.set(UI_PADDING + buttonWidth / 2, this.app.screen.height - UI_PADDING - buttonHeight / 2);

    const bg = new Graphics();
    bg.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
    bg.fill(COLORS.primary);

    const text = new Text({
      text: "Back",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 18,
        fontWeight: "bold",
        fill: COLORS.text,
      },
    });
    text.anchor.set(0.5);

    button.addChild(bg, text);
    button.eventMode = "static";
    button.cursor = "pointer";

    button.on("pointerover", () => {
      bg.clear();
      bg.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
      bg.fill(COLORS.primaryHover);
    });
    button.on("pointerout", () => {
      bg.clear();
      bg.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 8);
      bg.fill(COLORS.primary);
    });
    button.on("pointerdown", () => {
      game.showMainMenu();
    });

    this.addChild(button);
  }

  private renderEntries(entries: LeaderboardEntry[]): void {
    this.entriesContainer.removeChildren();

    const startY = 80;
    const rowHeight = 40;
    const centerX = this.app.screen.width / 2;

    if (entries.length === 0) {
      const noData = new Text({
        text: "No records yet. Be the first!",
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 20,
          fill: COLORS.textSecondary,
        },
      });
      noData.anchor.set(0.5);
      noData.position.set(centerX, this.app.screen.height / 2);
      this.entriesContainer.addChild(noData);
      return;
    }

    // Header
    const header = new Text({
      text: "  #    Player              Time",
      style: {
        fontFamily: "monospace",
        fontSize: 16,
        fill: COLORS.textSecondary,
      },
    });
    header.anchor.set(0.5, 0);
    header.position.set(centerX, startY);
    this.entriesContainer.addChild(header);

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const ms = entry.elapsedMs;
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      const timeStr = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;

      const rankColor = entry.rank <= 3 ? 0xffd700 : COLORS.text;
      const rankStr = entry.rank.toString().padStart(3, " ");
      const nameStr = entry.name.padEnd(20, " ").slice(0, 20);

      const row = new Text({
        text: `${rankStr}   ${nameStr} ${timeStr}`,
        style: {
          fontFamily: "monospace",
          fontSize: 16,
          fill: rankColor,
        },
      });
      row.anchor.set(0.5, 0);
      row.position.set(centerX, startY + (i + 1) * rowHeight);
      this.entriesContainer.addChild(row);
    }
  }

  update(): void {}

  resize(_width: number, _height: number): void {
    // Simplified - would need to reposition elements
  }

  destroy(): void {
    this.removeAllListeners();
    super.destroy({ children: true });
  }
}
