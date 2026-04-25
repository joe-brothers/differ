import { Application, Container, Graphics, Text } from "pixi.js";
import type { IScene } from "../types";
import { COLORS, UI_PADDING } from "../constants";
import { game } from "../core/Game";
import { leaderboardApi } from "../network/rest";
import type { LeaderboardEntry } from "@differ/shared";

type LbMode = "single" | "1v1";

const FONT_SANS = "Arial, sans-serif";
const FONT_MONO = '"Roboto Mono", "JetBrains Mono", ui-monospace, monospace';

const ROW_HEIGHT = 44;
const HEADER_HEIGHT = 36;
// Both modes show a single metric column (single → Best time, 1v1 → Wins).
const CARD_WIDTH = 460;
const HORIZONTAL_PADDING = 16;

export class LeaderboardScene extends Container implements IScene {
  private app: Application;
  private tableContainer: Container;
  private tabs: { single: Container; onevone: Container } | null = null;
  private loadingText: Text | null = null;
  private currentMode: LbMode = "single";

  constructor(app: Application) {
    super();
    this.app = app;
    this.tableContainer = new Container();
  }

  async init(): Promise<void> {
    this.createTitle();
    this.createTabs();
    this.createBackButton();
    this.addChild(this.tableContainer);

    this.loadingText = new Text({
      text: "Loading...",
      style: {
        fontFamily: FONT_SANS,
        fontSize: 14,
        fill: COLORS.textSecondary,
      },
    });
    this.loadingText.anchor.set(0.5);
    this.loadingText.position.set(
      Math.round(this.app.screen.width / 2),
      Math.round(this.app.screen.height / 2),
    );
    this.addChild(this.loadingText);

    await this.loadMode(this.currentMode);
  }

  private createTitle(): void {
    const title = new Text({
      text: "Leaderboard",
      style: {
        fontFamily: FONT_SANS,
        fontSize: 28,
        fontWeight: "500",
        fill: COLORS.text,
      },
    });
    title.anchor.set(0.5, 0);
    title.position.set(Math.round(this.app.screen.width / 2), UI_PADDING);
    this.addChild(title);
  }

  private createTabs(): void {
    const y = UI_PADDING + 60;
    const tabWidth = 140;
    const tabHeight = 36;
    const gap = 12;
    const totalWidth = tabWidth * 2 + gap;
    const startX = Math.round(this.app.screen.width / 2 - totalWidth / 2);

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

  private makeTab(label: string, w: number, h: number, onClick: () => void): Container {
    const button = new Container();
    const bg = new Graphics();
    bg.roundRect(-w / 2, -h / 2, w, h, 4);
    bg.fill(COLORS.surface);
    bg.stroke({ color: COLORS.border, width: 1 });

    const text = new Text({
      text: label,
      style: {
        fontFamily: FONT_SANS,
        fontSize: 14,
        fontWeight: "500",
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
      el.__bg.roundRect(-70, -18, 140, 36, 4);
      el.__bg.fill(active ? COLORS.primarySoft : COLORS.surface);
      el.__bg.stroke({ color: active ? COLORS.primary : COLORS.border, width: 1 });
      el.__text.style.fill = active ? COLORS.primary : COLORS.textSecondary;
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
    this.tableContainer.removeChildren();
    if (this.loadingText) {
      this.loadingText.text = "Loading...";
      this.loadingText.visible = true;
    }
    try {
      const result = await leaderboardApi.list(mode, 20, 0);
      // Drop request if the user switched modes while we were waiting.
      if (this.currentMode !== mode) return;
      if (this.loadingText) this.loadingText.visible = false;
      this.renderEntries(result.entries, mode);
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
    bg.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 4);
    bg.fill(COLORS.primary);

    const text = new Text({
      text: "Back",
      style: {
        fontFamily: FONT_SANS,
        fontSize: 14,
        fontWeight: "500",
        fill: COLORS.primaryOn,
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

  private renderEntries(entries: LeaderboardEntry[], mode: LbMode): void {
    this.tableContainer.removeChildren();

    const cardX = Math.round(this.app.screen.width / 2 - CARD_WIDTH / 2);
    const cardY = UI_PADDING + 130;
    this.tableContainer.position.set(cardX, cardY);

    if (entries.length === 0) {
      this.renderEmptyCard();
      return;
    }

    const cardHeight = HEADER_HEIGHT + entries.length * ROW_HEIGHT;

    // Card surface
    const card = new Graphics();
    card.roundRect(0, 0, CARD_WIDTH, cardHeight, 8);
    card.fill(COLORS.surface);
    card.stroke({ color: COLORS.border, width: 1 });
    this.tableContainer.addChild(card);

    // Header
    this.tableContainer.addChild(this.buildHeader(mode));

    // Header divider
    const headerDivider = new Graphics();
    headerDivider.rect(0, HEADER_HEIGHT, CARD_WIDTH, 1);
    headerDivider.fill(COLORS.border);
    this.tableContainer.addChild(headerDivider);

    for (let i = 0; i < entries.length; i++) {
      const rowY = HEADER_HEIGHT + i * ROW_HEIGHT;
      this.tableContainer.addChild(this.buildRow(entries[i], rowY, mode));
      if (i < entries.length - 1) {
        const divider = new Graphics();
        divider.rect(HORIZONTAL_PADDING, rowY + ROW_HEIGHT, CARD_WIDTH - HORIZONTAL_PADDING * 2, 1);
        divider.fill(COLORS.border);
        this.tableContainer.addChild(divider);
      }
    }
  }

  private renderEmptyCard(): void {
    const cardHeight = 96;
    const card = new Graphics();
    card.roundRect(0, 0, CARD_WIDTH, cardHeight, 8);
    card.fill(COLORS.surface);
    card.stroke({ color: COLORS.border, width: 1 });
    this.tableContainer.addChild(card);

    const msg = new Text({
      text: "No records yet. Be the first.",
      style: {
        fontFamily: FONT_SANS,
        fontSize: 14,
        fill: COLORS.textSecondary,
      },
    });
    msg.anchor.set(0.5);
    msg.position.set(Math.round(CARD_WIDTH / 2), Math.round(cardHeight / 2));
    this.tableContainer.addChild(msg);
  }

  private buildHeader(mode: LbMode): Container {
    const header = new Container();

    const make = (label: string, x: number, anchorX: 0 | 1) => {
      const t = new Text({
        text: label.toUpperCase(),
        style: {
          fontFamily: FONT_SANS,
          fontSize: 11,
          fontWeight: "500",
          letterSpacing: 0.5,
          fill: COLORS.textSecondary,
        },
      });
      t.anchor.set(anchorX, 0.5);
      t.position.set(Math.round(x), Math.round(HEADER_HEIGHT / 2));
      header.addChild(t);
    };

    make("Rank", HORIZONTAL_PADDING, 0);
    make("Player", HORIZONTAL_PADDING + 64, 0);
    make(mode === "single" ? "Best" : "Wins", CARD_WIDTH - HORIZONTAL_PADDING, 1);

    return header;
  }

  private buildRow(entry: LeaderboardEntry, rowY: number, mode: LbMode): Container {
    const row = new Container();
    row.position.set(0, rowY);

    // Rank chip — gold/silver/bronze for the podium, neutral chip otherwise.
    const rankChip = this.buildRankChip(entry.rank);
    rankChip.position.set(HORIZONTAL_PADDING, Math.round(ROW_HEIGHT / 2));
    row.addChild(rankChip);

    const name = new Text({
      text: entry.name,
      style: {
        fontFamily: FONT_SANS,
        fontSize: 14,
        fontWeight: "500",
        fill: COLORS.text,
      },
    });
    name.anchor.set(0, 0.5);
    name.position.set(HORIZONTAL_PADDING + 64, Math.round(ROW_HEIGHT / 2));
    row.addChild(name);

    let metricText: string;
    let metricColor: number;
    if (mode === "single") {
      metricText = entry.bestMs != null ? formatMs(entry.bestMs) : "–";
      metricColor = entry.bestMs != null ? COLORS.text : COLORS.textTertiary;
    } else {
      metricText = entry.wins.toString();
      metricColor = COLORS.text;
    }

    const metric = new Text({
      text: metricText,
      style: {
        fontFamily: FONT_MONO,
        fontSize: 14,
        fill: metricColor,
      },
    });
    metric.anchor.set(1, 0.5);
    metric.position.set(CARD_WIDTH - HORIZONTAL_PADDING, Math.round(ROW_HEIGHT / 2));
    row.addChild(metric);

    return row;
  }

  private buildRankChip(rank: number): Container {
    const chip = new Container();
    const size = 24;
    const palette = podiumPalette(rank);

    const bg = new Graphics();
    bg.circle(0, 0, size / 2);
    bg.fill(palette.bg);
    chip.addChild(bg);

    const label = new Text({
      text: rank.toString(),
      style: {
        fontFamily: FONT_MONO,
        fontSize: 12,
        fontWeight: "500",
        fill: palette.fg,
      },
    });
    label.anchor.set(0.5);
    chip.addChild(label);

    return chip;
  }

  update(): void {
    /* no-op */
  }

  resize(_width: number, _height: number): void {
    // Simplified — would need to reposition elements
  }

  destroy(): void {
    this.removeAllListeners();
    super.destroy({ children: true });
  }
}

function podiumPalette(rank: number): { bg: number; fg: number } {
  if (rank === 1) return { bg: COLORS.goldBg, fg: COLORS.gold };
  if (rank === 2) return { bg: COLORS.silverBg, fg: COLORS.silver };
  if (rank === 3) return { bg: COLORS.bronzeBg, fg: COLORS.bronze };
  return { bg: COLORS.surfaceMuted, fg: COLORS.textSecondary };
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
