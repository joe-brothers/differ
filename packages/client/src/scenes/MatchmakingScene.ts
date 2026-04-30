import { Application, Container, Text } from "pixi.js";
import type { IScene } from "../types";
import { COLORS } from "../constants";
import { game } from "../core/Game";
import { HtmlOverlay } from "../ui/HtmlOverlay";
import { authState } from "../managers/AuthStateManager";
import { gameState } from "../managers/GameStateManager";

export class MatchmakingScene extends Container implements IScene {
  private app: Application;
  private overlay: HtmlOverlay | null = null;
  private title: Text | null = null;
  private statusText: Text | null = null;
  private roomCode: string | null = null;
  private cancelled = false;
  private opponentEl: HTMLDivElement | null = null;
  private waitingSpinner: HTMLDivElement | null = null;
  // Active Quick Match handle, so the Cancel button can abort the queue WS.
  private quickCancel: (() => void) | null = null;
  // Elapsed-time ticker on the searching screen.
  private quickElapsedTimer: number | null = null;

  constructor(app: Application) {
    super();
    this.app = app;
  }

  async init(): Promise<void> {
    this.createTitle();
    // Reused-room path: after a 1v1 game ends and the opponent leaves, we
    // come back here already connected and waiting on the existing code.
    const resumeCode = game.consumePendingWaitingRoomCode();
    if (resumeCode) {
      this.roomCode = resumeCode;
      this.showWaitingWithCode(resumeCode);
    } else {
      this.showChooser();
    }
  }

  private createTitle(): void {
    this.title = new Text({
      text: "1v1 Match",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 28,
        fontWeight: "500",
        fill: COLORS.text,
      },
    });
    this.title.anchor.set(0.5);
    this.title.position.set(this.app.screen.width / 2, this.app.screen.height * 0.2);
    this.addChild(this.title);
  }

  private resetOverlay(): void {
    this.overlay?.destroy();
    this.overlay = new HtmlOverlay();
    this.statusText?.destroy();
    this.statusText = null;
    this.opponentEl = null;
    this.waitingSpinner = null;
  }

  private showChooser(): void {
    this.resetOverlay();
    if (!this.overlay) return;

    const card = this.overlay.createFormContainer();

    const heading = document.createElement("h2");
    heading.textContent = "1v1 Match";
    Object.assign(heading.style, {
      color: "var(--text)",
      margin: "0 0 12px 0",
      fontSize: "20px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    const quickBtn = this.overlay.createButton(card, "Quick Match");
    const createBtn = this.overlay.createSecondaryButton(card, "Create Room");
    const joinBtn = this.overlay.createSecondaryButton(card, "Join with Code");
    const backBtn = this.overlay.createSecondaryButton(card, "Back");

    quickBtn.addEventListener("click", () => this.startQuickMatch());
    createBtn.addEventListener("click", () => this.createRoom());
    joinBtn.addEventListener("click", () => this.showJoinForm());
    backBtn.addEventListener("click", () => game.showMainMenu());
  }

  private startQuickMatch(): void {
    this.renderSearchingView();
    const handle = game.startQuickMatch();
    this.quickCancel = handle.cancel;
    void (async () => {
      try {
        await handle.matched;
        // game.startQuickMatch already connected us to the room and wired
        // up game_start handling on the room socket. From here, the regular
        // welcome / opponent flow takes over (renderOpponent, etc.) — we
        // hand off to showWaitingJoined so the user sees a familiar lobby
        // card while the server fires game_start.
        if (this.cancelled) return;
        this.quickCancel = null;
        this.stopQuickElapsedTimer();
        this.showWaitingJoined();
      } catch (err) {
        const message = (err as Error).message;
        if (this.cancelled || message === "cancelled") return;
        this.quickCancel = null;
        this.stopQuickElapsedTimer();
        this.showQuickMatchError(message);
      }
    })();
  }

  private renderSearchingView(): void {
    this.resetOverlay();
    if (!this.overlay) return;
    const card = this.overlay.createFormContainer();

    const heading = document.createElement("h2");
    heading.textContent = "Finding a match";
    Object.assign(heading.style, {
      color: "var(--text)",
      margin: "0 0 8px 0",
      fontSize: "20px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    const elapsedEl = document.createElement("p");
    elapsedEl.textContent = "Searching for an opponent... 0s";
    Object.assign(elapsedEl.style, {
      color: "var(--text-secondary)",
      fontSize: "14px",
      textAlign: "center",
      margin: "0 0 12px 0",
    });
    card.appendChild(elapsedEl);

    this.waitingSpinner = this.overlay.createSpinner(card, 24);

    const cancelBtn = this.overlay.createSecondaryButton(card, "Cancel");
    cancelBtn.addEventListener("click", () => {
      this.quickCancel?.();
      this.quickCancel = null;
      this.stopQuickElapsedTimer();
      this.showChooser();
    });

    const startedAt = Date.now();
    this.stopQuickElapsedTimer();
    this.quickElapsedTimer = window.setInterval(() => {
      const secs = Math.floor((Date.now() - startedAt) / 1000);
      elapsedEl.textContent = `Searching for an opponent... ${secs}s`;
    }, 1000);
  }

  private stopQuickElapsedTimer(): void {
    if (this.quickElapsedTimer != null) {
      window.clearInterval(this.quickElapsedTimer);
      this.quickElapsedTimer = null;
    }
  }

  private showQuickMatchError(message: string): void {
    this.resetOverlay();
    if (!this.overlay) return;
    const card = this.overlay.createFormContainer();

    const heading = document.createElement("h2");
    heading.textContent = "Match search failed";
    Object.assign(heading.style, {
      color: "var(--text)",
      margin: "0 0 8px 0",
      fontSize: "20px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    const msg = document.createElement("p");
    msg.textContent = message;
    Object.assign(msg.style, {
      color: "var(--error)",
      fontSize: "13px",
      textAlign: "center",
      margin: "0 0 12px 0",
    });
    card.appendChild(msg);

    const retryBtn = this.overlay.createButton(card, "Try Again");
    const backBtn = this.overlay.createSecondaryButton(card, "Back");
    retryBtn.addEventListener("click", () => this.startQuickMatch());
    backBtn.addEventListener("click", () => this.showChooser());
  }

  private async createRoom(): Promise<void> {
    const { codeEl, hint } = this.renderWaitingView(null);
    try {
      const code = await game.createRoom1v1();
      if (this.cancelled) return;
      this.roomCode = code;
      codeEl.textContent = code;
      this.wireWaitingSocket();
    } catch (err) {
      codeEl.textContent = "";
      hint.textContent = `Failed: ${(err as Error).message}`;
    }
  }

  // Renders the waiting-for-opponent card. When `code` is given, the socket
  // is assumed to already be connected (resume path after opponent left).
  private showWaitingWithCode(code: string): void {
    this.renderWaitingView(code);
    this.wireWaitingSocket();
  }

  private renderWaitingView(code: string | null): {
    codeEl: HTMLDivElement;
    hint: HTMLParagraphElement;
  } {
    this.resetOverlay();
    const card = this.overlay!.createFormContainer();

    const heading = document.createElement("h2");
    heading.textContent = "Waiting for opponent";
    Object.assign(heading.style, {
      color: "var(--text)",
      margin: "0 0 8px 0",
      fontSize: "20px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    // GitHub-style: code text in a relatively-positioned box, copy button
    // pinned to the top-right corner. Stays out of the way until hovered.
    const codeWrap = document.createElement("div");
    Object.assign(codeWrap.style, {
      position: "relative",
      margin: "8px 0",
    });
    card.appendChild(codeWrap);

    const codeEl = document.createElement("div");
    Object.assign(codeEl.style, {
      color: "var(--text)",
      fontSize: "36px",
      fontFamily: '"Roboto Mono", "JetBrains Mono", ui-monospace, monospace',
      fontWeight: "500",
      letterSpacing: "4px",
      textAlign: "center",
      padding: "16px 48px",
      background: "var(--surface-sunken)",
      border: "1px solid var(--border)",
      borderRadius: "4px",
      userSelect: "all",
    });
    codeEl.textContent = code ?? "...";
    codeWrap.appendChild(codeEl);

    const copyBtn = this.makeCopyButton(() => codeEl.textContent ?? "");
    codeWrap.appendChild(copyBtn);

    const hint = document.createElement("p");
    hint.textContent = "Share this code with a friend. Game starts automatically.";
    Object.assign(hint.style, {
      color: "var(--text-secondary)",
      fontSize: "13px",
      textAlign: "center",
      margin: "4px 0",
    });
    card.appendChild(hint);

    // Slot for opponent info, populated when player_joined arrives.
    this.opponentEl = document.createElement("div");
    Object.assign(this.opponentEl.style, {
      color: "var(--text)",
      fontSize: "14px",
      textAlign: "center",
      margin: "8px 0 0 0",
      minHeight: "20px",
    });
    card.appendChild(this.opponentEl);

    // Spinner: visible while we wait for the opponent. Hidden once they join
    // (renderOpponent removes it).
    this.waitingSpinner = this.overlay!.createSpinner(card, 20);

    const cancelBtn = this.overlay!.createSecondaryButton(card, "Cancel");
    cancelBtn.addEventListener("click", () => {
      this.cancelled = true;
      game.showMainMenu();
    });

    return { codeEl, hint };
  }

  // GitHub-style copy button. Pinned top-right of a relatively-positioned
  // parent. Resolves the text lazily so it works for the create-room flow
  // where the code arrives after the button is mounted.
  private makeCopyButton(getText: () => string): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("aria-label", "Copy room code");
    Object.assign(btn.style, {
      position: "absolute",
      top: "8px",
      right: "8px",
      padding: "4px 10px",
      height: "28px",
      borderRadius: "4px",
      border: "1px solid var(--border)",
      background: "var(--surface)",
      color: "var(--text-secondary)",
      fontSize: "12px",
      fontWeight: "500",
      cursor: "pointer",
      transition: "background 80ms ease-out, color 80ms ease-out",
    });
    btn.textContent = "Copy";
    btn.addEventListener("mouseenter", () => {
      btn.style.background = "var(--surface-sunken)";
      btn.style.color = "var(--text)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "var(--surface)";
      btn.style.color = "var(--text-secondary)";
    });
    btn.addEventListener("click", async () => {
      const text = getText();
      if (!text || text === "...") return;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Fallback: select+execCommand if clipboard API blocked (older Safari,
        // permission denied). We don't fail loudly — copy button is a UX
        // niceness, the user can still read the code.
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand("copy");
        } catch {
          /* give up */
        }
        ta.remove();
      }
      const original = btn.textContent;
      btn.textContent = "Copied!";
      btn.style.color = "var(--primary)";
      window.setTimeout(() => {
        btn.textContent = original;
        btn.style.color = "var(--text-secondary)";
      }, 1200);
    });
    return btn;
  }

  // Populate the opponent line under the room code (or "Joined" header).
  private renderOpponent(name: string, wins: number): void {
    if (!this.opponentEl) return;
    this.opponentEl.innerHTML = "";
    const label = document.createElement("span");
    label.textContent = `Opponent: ${name} `;
    const winsBadge = document.createElement("span");
    winsBadge.textContent = `· ${wins} win${wins === 1 ? "" : "s"}`;
    Object.assign(winsBadge.style, { color: "var(--text-secondary)" });
    this.opponentEl.appendChild(label);
    this.opponentEl.appendChild(winsBadge);
    // Once we have an opponent the wait is over; drop the spinner so the
    // card doesn't keep implying "still searching".
    this.waitingSpinner?.remove();
    this.waitingSpinner = null;
  }

  private showJoinForm(): void {
    this.resetOverlay();
    if (!this.overlay) return;

    const card = this.overlay.createFormContainer();

    const heading = document.createElement("h2");
    heading.textContent = "Enter Room Code";
    Object.assign(heading.style, {
      color: "var(--text)",
      margin: "0 0 8px 0",
      fontSize: "20px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    const codeInput = this.overlay.createInput(card, {
      type: "text",
      placeholder: "ABC123",
      name: "roomCode",
      autocomplete: "off",
    });
    codeInput.maxLength = 6;
    codeInput.style.letterSpacing = "4px";
    codeInput.style.fontFamily = '"Roboto Mono", "JetBrains Mono", ui-monospace, monospace';
    codeInput.style.textTransform = "uppercase";

    const errText = this.overlay.createErrorText(card);
    const joinBtn = this.overlay.createButton(card, "Join");
    const backBtn = this.overlay.createSecondaryButton(card, "Back");

    backBtn.addEventListener("click", () => this.showChooser());

    const submit = async () => {
      const code = codeInput.value.trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(code)) {
        errText.textContent = "Code must be 6 alphanumeric characters.";
        return;
      }
      joinBtn.disabled = true;
      errText.textContent = "";
      try {
        await game.joinRoom1v1(code);
        this.roomCode = code;
        this.showWaitingJoined();
      } catch (err) {
        errText.textContent = (err as Error).message;
        joinBtn.disabled = false;
      }
    };
    joinBtn.addEventListener("click", submit);
    codeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    codeInput.focus();
  }

  private showWaitingJoined(): void {
    this.resetOverlay();
    if (!this.overlay) return;
    const card = this.overlay.createFormContainer();

    const heading = document.createElement("h2");
    heading.textContent = "Joined";
    Object.assign(heading.style, {
      color: "var(--text)",
      margin: "0 0 8px 0",
      fontSize: "20px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    if (this.roomCode) {
      const codeWrap = document.createElement("div");
      Object.assign(codeWrap.style, { position: "relative", margin: "0 0 8px 0" });
      const codeEl = document.createElement("div");
      Object.assign(codeEl.style, {
        color: "var(--text)",
        fontSize: "20px",
        fontFamily: '"Roboto Mono", "JetBrains Mono", ui-monospace, monospace',
        fontWeight: "500",
        letterSpacing: "4px",
        textAlign: "center",
        padding: "10px 48px",
        background: "var(--surface-sunken)",
        border: "1px solid var(--border)",
        borderRadius: "4px",
        userSelect: "all",
      });
      codeEl.textContent = this.roomCode;
      codeWrap.appendChild(codeEl);
      codeWrap.appendChild(this.makeCopyButton(() => codeEl.textContent ?? ""));
      card.appendChild(codeWrap);
    }

    const info = document.createElement("p");
    info.textContent = "Starting soon...";
    Object.assign(info.style, {
      color: "var(--text-secondary)",
      fontSize: "14px",
      textAlign: "center",
      margin: "0 0 12px 0",
    });
    card.appendChild(info);

    this.opponentEl = document.createElement("div");
    Object.assign(this.opponentEl.style, {
      color: "var(--text)",
      fontSize: "14px",
      textAlign: "center",
      margin: "0 0 12px 0",
      minHeight: "20px",
    });
    card.appendChild(this.opponentEl);

    this.waitingSpinner = this.overlay.createSpinner(card, 20);

    const cancelBtn = this.overlay.createSecondaryButton(card, "Leave");
    cancelBtn.addEventListener("click", () => {
      this.cancelled = true;
      game.showMainMenu();
    });

    this.wireWaitingSocket();
  }

  // Listens for opponent join events and surfaces the opponent's name.
  // Game.ts handles the actual `game_start` transition to GameScene.
  private wireWaitingSocket(): void {
    const socket = game.getSocket();
    if (!socket) return;
    const myId = authState.getUser()?.userId;

    socket.on("welcome", (msg: { players: { userId: string; name: string; wins: number }[] }) => {
      const other = msg.players.find((p) => p.userId !== myId);
      if (other) {
        gameState.setOpponent(other.name, other.wins);
        this.renderOpponent(other.name, other.wins);
      }
    });
    socket.on(
      "player_joined",
      (msg: { player: { userId: string; name: string; wins: number } }) => {
        gameState.setOpponent(msg.player.name, msg.player.wins);
        this.renderOpponent(msg.player.name, msg.player.wins);
      },
    );
    socket.on("error", (msg: { message: string }) => {
      console.warn("room error", msg.message);
    });
  }

  update(_deltaTime: number): void {
    /* no-op */
  }

  resize(width: number, height: number): void {
    if (this.title) this.title.position.set(width / 2, height * 0.2);
  }

  destroy(): void {
    this.overlay?.destroy();
    this.overlay = null;
    this.stopQuickElapsedTimer();
    // If the user navigated away mid-search (Cancel goes through showChooser,
    // but a hard scene swap doesn't), drop the queue WS to free the seat.
    this.quickCancel?.();
    this.quickCancel = null;
    this.removeAllListeners();
    super.destroy({ children: true });
  }
}
