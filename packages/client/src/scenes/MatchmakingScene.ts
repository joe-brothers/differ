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
  }

  private showChooser(): void {
    this.resetOverlay();
    if (!this.overlay) return;

    const card = this.overlay.createFormContainer();

    const heading = document.createElement("h2");
    heading.textContent = "1v1 Match";
    Object.assign(heading.style, {
      color: "#202124",
      margin: "0 0 12px 0",
      fontSize: "20px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    const createBtn = this.overlay.createButton(card, "Create Room");
    const joinBtn = this.overlay.createButton(card, "Join with Code");
    const backBtn = this.overlay.createSecondaryButton(card, "Back");

    createBtn.addEventListener("click", () => this.createRoom());
    joinBtn.addEventListener("click", () => this.showJoinForm());
    backBtn.addEventListener("click", () => game.showMainMenu());
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
      color: "#202124",
      margin: "0 0 8px 0",
      fontSize: "20px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    const codeEl = document.createElement("div");
    Object.assign(codeEl.style, {
      color: "#202124",
      fontSize: "36px",
      fontFamily: '"Roboto Mono", "JetBrains Mono", ui-monospace, monospace',
      fontWeight: "500",
      letterSpacing: "4px",
      textAlign: "center",
      padding: "16px",
      background: "#F1F3F4",
      border: "1px solid #DADCE0",
      borderRadius: "4px",
      margin: "8px 0",
      userSelect: "all",
    });
    codeEl.textContent = code ?? "...";
    card.appendChild(codeEl);

    const hint = document.createElement("p");
    hint.textContent = "Share this code with a friend. Game starts automatically.";
    Object.assign(hint.style, {
      color: "#5F6368",
      fontSize: "13px",
      textAlign: "center",
      margin: "4px 0",
    });
    card.appendChild(hint);

    const cancelBtn = this.overlay!.createSecondaryButton(card, "Cancel");
    cancelBtn.addEventListener("click", () => {
      this.cancelled = true;
      game.showMainMenu();
    });

    return { codeEl, hint };
  }

  private showJoinForm(): void {
    this.resetOverlay();
    if (!this.overlay) return;

    const card = this.overlay.createFormContainer();

    const heading = document.createElement("h2");
    heading.textContent = "Enter Room Code";
    Object.assign(heading.style, {
      color: "#202124",
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
    heading.textContent = `Joined ${this.roomCode ?? ""}`;
    Object.assign(heading.style, {
      color: "#202124",
      margin: "0 0 12px 0",
      fontSize: "20px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    const info = document.createElement("p");
    info.textContent = "Starting soon...";
    Object.assign(info.style, {
      color: "#5F6368",
      fontSize: "14px",
      textAlign: "center",
      margin: "0 0 12px 0",
    });
    card.appendChild(info);

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

    socket.on("welcome", (msg: { players: { userId: string; name: string }[] }) => {
      const other = msg.players.find((p) => p.userId !== myId);
      if (other) gameState.setOpponentUsername(other.name);
    });
    socket.on("player_joined", (msg: { player: { userId: string; name: string } }) => {
      gameState.setOpponentUsername(msg.player.name);
    });
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
    this.removeAllListeners();
    super.destroy({ children: true });
  }
}
