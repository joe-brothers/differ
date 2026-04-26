import { Application, Container, Graphics, Text } from "pixi.js";
import type { IScene } from "../types";
import { COLORS, UI_PADDING } from "../constants";
import { game } from "../core/Game";
import { authApi } from "../network/rest";
import type { RecentGameEntry } from "@differ/shared";

const FONT_SANS = "Arial, sans-serif";
const FONT_MONO = '"Roboto Mono", "JetBrains Mono", ui-monospace, monospace';

const ROW_HEIGHT = 52;
const HEADER_HEIGHT = 36;
const CARD_WIDTH = 600;
const HORIZONTAL_PADDING = 16;
const PAGE_LIMIT = 20;

const COL = {
  outcomeX: HORIZONTAL_PADDING,
  modeX: HORIZONTAL_PADDING + 84,
  opponentX: HORIZONTAL_PADDING + 84 + 56,
  timeX: CARD_WIDTH - HORIZONTAL_PADDING - 110,
  dateX: CARD_WIDTH - HORIZONTAL_PADDING,
};

export class HistoryScene extends Container implements IScene {
  private app: Application;
  private listContainer: Container;
  private statusText: Text | null = null;

  constructor(app: Application) {
    super();
    this.app = app;
    this.listContainer = new Container();
  }

  async init(): Promise<void> {
    this.createTitle();
    this.createBackButton();
    this.addChild(this.listContainer);

    this.statusText = new Text({
      text: "Loading...",
      style: {
        fontFamily: FONT_SANS,
        fontSize: 14,
        fill: COLORS.textSecondary,
      },
    });
    this.statusText.anchor.set(0.5);
    this.statusText.position.set(
      Math.round(this.app.screen.width / 2),
      Math.round(this.app.screen.height / 2),
    );
    this.addChild(this.statusText);

    try {
      const res = await authApi.recent(PAGE_LIMIT);
      if (this.statusText) this.statusText.visible = false;
      this.renderEntries(res.games.filter(isDisplayable));
    } catch {
      if (this.statusText) this.statusText.text = "Failed to load history";
    }
  }

  private createTitle(): void {
    const title = new Text({
      text: "Recent Games",
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

  private renderEntries(entries: RecentGameEntry[]): void {
    this.listContainer.removeChildren();

    const cardX = Math.round(this.app.screen.width / 2 - CARD_WIDTH / 2);
    const cardY = UI_PADDING + 80;
    this.listContainer.position.set(cardX, cardY);

    if (entries.length === 0) {
      this.renderEmptyCard();
      return;
    }

    const cardHeight = HEADER_HEIGHT + entries.length * ROW_HEIGHT;
    const card = new Graphics();
    card.roundRect(0, 0, CARD_WIDTH, cardHeight, 8);
    card.fill(COLORS.surface);
    card.stroke({ color: COLORS.border, width: 1 });
    this.listContainer.addChild(card);

    this.listContainer.addChild(this.buildHeader());

    const headerDivider = new Graphics();
    headerDivider.rect(0, HEADER_HEIGHT, CARD_WIDTH, 1);
    headerDivider.fill(COLORS.border);
    this.listContainer.addChild(headerDivider);

    for (let i = 0; i < entries.length; i++) {
      const rowY = HEADER_HEIGHT + i * ROW_HEIGHT;
      this.listContainer.addChild(this.buildRow(entries[i], rowY));
      if (i < entries.length - 1) {
        const divider = new Graphics();
        divider.rect(HORIZONTAL_PADDING, rowY + ROW_HEIGHT, CARD_WIDTH - HORIZONTAL_PADDING * 2, 1);
        divider.fill(COLORS.border);
        this.listContainer.addChild(divider);
      }
    }
  }

  private renderEmptyCard(): void {
    const cardHeight = 96;
    const card = new Graphics();
    card.roundRect(0, 0, CARD_WIDTH, cardHeight, 8);
    card.fill(COLORS.surface);
    card.stroke({ color: COLORS.border, width: 1 });
    this.listContainer.addChild(card);

    const msg = new Text({
      text: "No games yet. Start a sprint or 1v1 to build history.",
      style: {
        fontFamily: FONT_SANS,
        fontSize: 14,
        fill: COLORS.textSecondary,
      },
    });
    msg.anchor.set(0.5);
    msg.position.set(Math.round(CARD_WIDTH / 2), Math.round(cardHeight / 2));
    this.listContainer.addChild(msg);
  }

  private buildHeader(): Container {
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
    make("Result", COL.outcomeX, 0);
    make("Mode", COL.modeX, 0);
    make("Opponent", COL.opponentX, 0);
    make("Time", COL.timeX, 0);
    make("When", COL.dateX, 1);
    return header;
  }

  private buildRow(entry: RecentGameEntry, rowY: number): Container {
    const row = new Container();
    row.position.set(0, rowY);
    const midY = Math.round(ROW_HEIGHT / 2);

    row.addChild(this.buildOutcomeChip(entry, COL.outcomeX, midY));

    const modeLabel = new Text({
      text: entry.mode === "single" ? "Sprint" : "1v1",
      style: {
        fontFamily: FONT_SANS,
        fontSize: 13,
        fill: COLORS.textSecondary,
      },
    });
    modeLabel.anchor.set(0, 0.5);
    modeLabel.position.set(COL.modeX, midY);
    row.addChild(modeLabel);

    const opponentLabel = new Text({
      text: entry.mode === "single" ? "Solo" : (entry.opponent?.name ?? "—"),
      style: {
        fontFamily: FONT_SANS,
        fontSize: 14,
        fontWeight: "500",
        fill: entry.mode === "single" ? COLORS.textSecondary : COLORS.text,
      },
    });
    opponentLabel.anchor.set(0, 0.5);
    opponentLabel.position.set(COL.opponentX, midY);
    row.addChild(opponentLabel);

    const timeStr = entry.elapsedMs != null ? formatMs(entry.elapsedMs) : "—";
    const time = new Text({
      text: timeStr,
      style: {
        fontFamily: FONT_MONO,
        fontSize: 13,
        fill: entry.elapsedMs != null ? COLORS.text : COLORS.textTertiary,
      },
    });
    time.anchor.set(0, 0.5);
    time.position.set(COL.timeX, midY);
    row.addChild(time);

    const dateStr = formatRelative(entry.endedAt);
    const date = new Text({
      text: dateStr,
      style: {
        fontFamily: FONT_SANS,
        fontSize: 12,
        fill: COLORS.textTertiary,
      },
    });
    date.anchor.set(1, 0.5);
    date.position.set(COL.dateX, midY);
    row.addChild(date);

    return row;
  }

  private buildOutcomeChip(entry: RecentGameEntry, x: number, midY: number): Container {
    const chip = new Container();
    chip.position.set(x, midY);

    const palette = outcomePalette(entry);
    const w = 64;
    const h = 22;

    const bg = new Graphics();
    bg.roundRect(0, -h / 2, w, h, 4);
    bg.fill(palette.bg);
    chip.addChild(bg);

    const label = new Text({
      text: palette.label,
      style: {
        fontFamily: FONT_SANS,
        fontSize: 11,
        fontWeight: "500",
        letterSpacing: 0.4,
        fill: palette.fg,
      },
    });
    label.anchor.set(0.5);
    label.position.set(Math.round(w / 2), 0);
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

// Solo timeouts are hidden from the recent list — they aren't an interesting
// outcome to surface. 1v1 timeouts remain (rendered as DRAW or WIN/LOSS).
function isDisplayable(entry: RecentGameEntry): boolean {
  return !(entry.outcome === "timeout" && entry.mode === "single");
}

function outcomePalette(entry: RecentGameEntry): { label: string; bg: number; fg: number } {
  if (entry.outcome === "win") {
    return { label: "WIN", bg: COLORS.successBg, fg: COLORS.success };
  }
  if (entry.outcome === "loss") {
    return { label: "LOSS", bg: COLORS.errorBg, fg: COLORS.error };
  }
  // 1v1 timeout with no opponent shown → draw. Solo timeouts are filtered
  // upstream by isDisplayable, so they never reach the palette.
  return { label: "DRAW", bg: COLORS.surfaceMuted, fg: COLORS.textSecondary };
}

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// `endedAt` is the SQL datetime text the server stores ('YYYY-MM-DD HH:MM:SS'
// in UTC). Date parses it as local time on some browsers, so append 'Z' to
// pin it to UTC before computing the delta.
function formatRelative(endedAt: string): string {
  const iso = endedAt.includes("T") ? endedAt : endedAt.replace(" ", "T") + "Z";
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return endedAt;
  const diff = Date.now() - t;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  const d = new Date(t);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
