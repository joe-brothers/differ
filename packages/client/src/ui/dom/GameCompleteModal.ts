import { CSS, FONT_FAMILY, createButton, createCard } from "./styles";

function formatTime(elapsedTime: number): string {
  const minutes = Math.floor(elapsedTime / 60);
  const seconds = Math.floor(elapsedTime % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

export class GameCompleteModal {
  private root: HTMLDivElement;
  private card: HTMLDivElement;
  private playAgainBtn: HTMLButtonElement | null = null;
  private onPlayAgain: (() => void) | null = null;
  private onMainMenu: (() => void) | null = null;

  constructor() {
    const app = document.getElementById("app");

    this.root = document.createElement("div");
    Object.assign(this.root.style, {
      position: "absolute",
      inset: "0",
      backgroundColor: "rgba(0, 0, 0, 0.85)",
      display: "none",
      justifyContent: "center",
      alignItems: "center",
      zIndex: "20",
      fontFamily: FONT_FAMILY,
    });

    this.card = createCard();
    this.card.style.minWidth = "400px";

    this.root.appendChild(this.card);
    app?.appendChild(this.root);
  }

  setCallbacks(onPlayAgain: () => void, onMainMenu: () => void): void {
    this.onPlayAgain = onPlayAgain;
    this.onMainMenu = onMainMenu;
  }

  show(elapsedTime: number, opts: { rank?: number } = {}): void {
    this.renderCard({
      titleText: "Congratulations!",
      titleColor: CSS.success,
      subtitleText: "You found all differences!",
      elapsedTime,
      rank: opts.rank,
      playAgainLabel: "Play Again",
    });
    this.root.style.display = "flex";
  }

  showResult(
    result: "win" | "lose",
    elapsedTime: number,
    opts: { playAgainLabel?: string } = {},
  ): void {
    const isWin = result === "win";
    this.renderCard({
      titleText: isWin ? "You Win!" : "You Lost!",
      titleColor: isWin ? CSS.success : CSS.error,
      subtitleText: isWin ? "You found all differences first!" : "Your opponent finished first!",
      elapsedTime,
      playAgainLabel: opts.playAgainLabel ?? "Play Again",
    });
    this.root.style.display = "flex";
  }

  markRematchPending(label: string = "Waiting for opponent..."): void {
    if (!this.playAgainBtn) return;
    this.playAgainBtn.disabled = true;
    this.playAgainBtn.textContent = label;
    this.playAgainBtn.style.cursor = "default";
    this.playAgainBtn.style.backgroundColor = CSS.disabled;
  }

  hide(): void {
    this.root.style.display = "none";
  }

  destroy(): void {
    this.root.remove();
  }

  private renderCard(opts: {
    titleText: string;
    titleColor: string;
    subtitleText: string;
    elapsedTime: number;
    rank?: number;
    playAgainLabel: string;
  }): void {
    while (this.card.firstChild) this.card.removeChild(this.card.firstChild);

    const title = document.createElement("h2");
    title.textContent = opts.titleText;
    Object.assign(title.style, {
      margin: "0",
      fontSize: "36px",
      fontWeight: "bold",
      color: opts.titleColor,
    });
    this.card.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.textContent = opts.subtitleText;
    Object.assign(subtitle.style, {
      margin: "0",
      fontSize: "20px",
      color: CSS.textSecondary,
    });
    this.card.appendChild(subtitle);

    const timeLabel = document.createElement("div");
    timeLabel.textContent = "Your Time";
    Object.assign(timeLabel.style, {
      marginTop: "12px",
      fontSize: "18px",
      color: CSS.textSecondary,
    });
    this.card.appendChild(timeLabel);

    const timeText = document.createElement("div");
    timeText.textContent = formatTime(opts.elapsedTime);
    Object.assign(timeText.style, {
      fontSize: "56px",
      fontWeight: "bold",
      color: CSS.text,
      lineHeight: "1.1",
      fontVariantNumeric: "tabular-nums",
    });
    this.card.appendChild(timeText);

    if (opts.rank !== undefined) {
      const rankText = document.createElement("div");
      rankText.textContent = `Rank #${opts.rank}`;
      Object.assign(rankText.style, {
        marginTop: "8px",
        fontSize: "28px",
        fontWeight: "bold",
        color: opts.rank <= 3 ? CSS.gold : CSS.primary,
      });
      this.card.appendChild(rankText);
    }

    const buttons = document.createElement("div");
    Object.assign(buttons.style, {
      marginTop: "16px",
      display: "flex",
      flexDirection: "column",
      gap: "12px",
    });

    this.playAgainBtn = createButton(opts.playAgainLabel, CSS.success);
    this.playAgainBtn.addEventListener("click", () => {
      if (this.playAgainBtn?.disabled) return;
      this.onPlayAgain?.();
    });
    buttons.appendChild(this.playAgainBtn);

    const mainMenuBtn = createButton("Main Menu", CSS.primary);
    mainMenuBtn.addEventListener("click", () => this.onMainMenu?.());
    buttons.appendChild(mainMenuBtn);

    this.card.appendChild(buttons);
  }
}
