import { Application, Container, Graphics, Text } from "pixi.js";
import type { IScene } from "../types";
import { COLORS, UI_PADDING } from "../constants";
import { game } from "../core/Game";
import { leaderboardApi } from "../network/rest";
import type { LeaderboardEntry } from "@differ/shared";

type LbMode = "single" | "1v1";

export class LeaderboardScene extends Container implements IScene {
  private app: Application;
  private entriesContainer: Container;
  private tabs: { single: Container; onevone: Container } | null = null;
  private loadingText: Text | null = null;
  private currentMode: LbMode = "single";

  constructor(app: Application) {
    super();
    this.app = app;
    this.entriesContainer = new Container();
  }

  async init(): Promise<void> {
    this.createTitle();
    this.createTabs();
    this.createBackButton();
    this.addChild(this.entriesContainer);

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

    await this.loadMode(this.currentMode);
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

  private createTabs(): void {
    const y = UI_PADDING + 60;
    const tabWidth = 140;
    const tabHeight = 36;
    const gap = 12;
    const totalWidth = tabWidth * 2 + gap;
    const startX = this.app.screen.width / 2 - totalWidth / 2;

    const singleTab = this.makeTab("5 Sprint", tabWidth, tabHeight, () => {
      this.setMode("single");
    });
    singleTab.position.set(startX + tabWidth / 2, y);

    const multiTab = this.makeTab("1v1", tabWidth, tabHeight, () => {
      this.setMode("1v1");
    });
    multiTab.position.set(startX + tabWidth + gap + tabWidth / 2, y);

    this.addChild(singleTab, multiTab);
    this.tabs = { single: singleTab, onevone: multiTab };
    this.highlightTabs();
  }

  private makeTab(
    label: string,
    w: number,
    h: number,
    onClick: () => void,
  ): Container {
    const button = new Container();
    const bg = new Graphics();
    bg.roundRect(-w / 2, -h / 2, w, h, 8);
    bg.fill(0x3a3a5e);

    const text = new Text({
      text: label,
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 16,
        fontWeight: "bold",
        fill: COLORS.textSecondary,
      },
    });
    text.anchor.set(0.5);

    button.addChild(bg, text);
    button.eventMode = "static";
    button.cursor = "pointer";
    (button as Container & { __bg: Graphics; __text: Text }).__bg = bg;
    (button as Container & { __bg: Graphics; __text: Text }).__text = text;

    button.on("pointerdown", onClick);
    return button;
  }

  private highlightTabs(): void {
    if (!this.tabs) return;
    const paint = (c: Container, active: boolean) => {
      const el = c as Container & { __bg: Graphics; __text: Text };
      el.__bg.clear();
      el.__bg.roundRect(-70, -18, 140, 36, 8);
      el.__bg.fill(active ? COLORS.primary : 0x3a3a5e);
      el.__text.style.fill = active ? COLORS.text : COLORS.textSecondary;
    };
    paint(this.tabs.single, this.currentMode === "single");
    paint(this.tabs.onevone, this.currentMode === "1v1");
  }

  private async setMode(mode: LbMode): Promise<void> {
    if (this.currentMode === mode) return;
    this.currentMode = mode;
    this.highlightTabs();
    await this.loadMode(mode);
  }

  private async loadMode(mode: LbMode): Promise<void> {
    this.entriesContainer.removeChildren();
    if (this.loadingText) {
      this.loadingText.text = "Loading...";
      this.loadingText.visible = true;
    }
    try {
      const result = await leaderboardApi.list(mode, 20, 0);
      if (this.loadingText) this.loadingText.visible = false;
      this.renderEntries(result.entries);
    } catch {
      if (this.loadingText) this.loadingText.text = "Failed to load leaderboard";
    }
  }

  private createBackButton(): void {
    const buttonWidth = 120;
    const buttonHeight = 40;
    const button = new Container();
    button.position.set(
      UI_PADDING + buttonWidth / 2,
      this.app.screen.height - UI_PADDING - buttonHeight / 2,
    );

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

    button.on("pointerdown", () => {
      game.showMainMenu();
    });

    this.addChild(button);
  }

  private renderEntries(entries: LeaderboardEntry[]): void {
    this.entriesContainer.removeChildren();

    const startY = UI_PADDING + 120;
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

    const header = new Text({
      text: "  #    Player              Wins    Best",
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
      const rankColor = entry.rank <= 3 ? 0xffd700 : COLORS.text;
      const rankStr = entry.rank.toString().padStart(3, " ");
      const nameStr = entry.name.padEnd(20, " ").slice(0, 20);
      const winsStr = entry.wins.toString().padStart(4, " ");
      const bestStr = entry.bestMs != null ? formatMs(entry.bestMs) : "   --";

      const row = new Text({
        text: `${rankStr}   ${nameStr} ${winsStr}  ${bestStr}`,
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

  update(): void { /* no-op */ }

  resize(_width: number, _height: number): void {
    // Simplified - would need to reposition elements
  }

  destroy(): void {
    this.removeAllListeners();
    super.destroy({ children: true });
  }
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
