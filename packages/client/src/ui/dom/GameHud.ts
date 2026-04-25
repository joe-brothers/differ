import { TOTAL_DIFFS_PER_GAME, IMAGES_PER_GAME, UI_PADDING } from "../../constants";
import { CSS, FONT_FAMILY } from "./styles";

export class GameHud {
  private root: HTMLDivElement;
  private timerEl: HTMLDivElement;
  private foundEl: HTMLDivElement;
  private imageIndexEl: HTMLDivElement;
  private opponentEl: HTMLDivElement | null = null;

  constructor(opts: { showOpponent: boolean }) {
    const app = document.getElementById("app");

    this.root = document.createElement("div");
    Object.assign(this.root.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      zIndex: "10",
      fontFamily: FONT_FAMILY,
      color: CSS.text,
    });

    this.timerEl = document.createElement("div");
    Object.assign(this.timerEl.style, {
      position: "absolute",
      top: `${UI_PADDING}px`,
      left: `${UI_PADDING}px`,
      fontSize: "28px",
      fontWeight: "bold",
      lineHeight: "1",
      fontVariantNumeric: "tabular-nums",
    });
    this.timerEl.textContent = "00:00";
    this.root.appendChild(this.timerEl);

    const progressGroup = document.createElement("div");
    Object.assign(progressGroup.style, {
      position: "absolute",
      top: `${UI_PADDING}px`,
      left: "50%",
      transform: "translateX(-50%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: "6px",
      lineHeight: "1",
    });

    this.foundEl = document.createElement("div");
    Object.assign(this.foundEl.style, {
      fontSize: "24px",
      fontWeight: "bold",
      fontVariantNumeric: "tabular-nums",
    });
    this.foundEl.textContent = `0/${TOTAL_DIFFS_PER_GAME}`;
    progressGroup.appendChild(this.foundEl);

    this.imageIndexEl = document.createElement("div");
    Object.assign(this.imageIndexEl.style, {
      fontSize: "20px",
      color: CSS.textSecondary,
    });
    this.imageIndexEl.textContent = `Image 1/${IMAGES_PER_GAME}`;
    progressGroup.appendChild(this.imageIndexEl);

    this.root.appendChild(progressGroup);

    if (opts.showOpponent) {
      this.opponentEl = document.createElement("div");
      Object.assign(this.opponentEl.style, {
        position: "absolute",
        top: `${UI_PADDING}px`,
        right: `${UI_PADDING}px`,
        fontSize: "16px",
        color: CSS.textSecondary,
        lineHeight: "1",
      });
      this.opponentEl.textContent = `Opponent 0/${TOTAL_DIFFS_PER_GAME}`;
      this.root.appendChild(this.opponentEl);
    }

    app?.appendChild(this.root);
  }

  setTime(seconds: number): void {
    const total = Math.max(0, Math.floor(seconds));
    const m = Math.floor(total / 60)
      .toString()
      .padStart(2, "0");
    const s = (total % 60).toString().padStart(2, "0");
    this.timerEl.textContent = `${m}:${s}`;
  }

  updateFoundCount(found: number): void {
    this.foundEl.textContent = `${found}/${TOTAL_DIFFS_PER_GAME}`;
  }

  updateImageIndex(current: number): void {
    this.imageIndexEl.textContent = `Image ${current + 1}/${IMAGES_PER_GAME}`;
  }

  updateOpponent(foundCount: number, online: boolean): void {
    if (!this.opponentEl) return;
    const base = `Opponent ${foundCount}/${TOTAL_DIFFS_PER_GAME}`;
    this.opponentEl.textContent = online ? base : `${base} (Disconnected)`;
    this.opponentEl.style.color = online ? CSS.textSecondary : CSS.error;
  }

  destroy(): void {
    this.root.remove();
  }
}
