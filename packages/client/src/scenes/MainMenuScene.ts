import { Application, Container, Graphics, Text } from "pixi.js";
import type { IScene } from "../types";
import { COLORS } from "../constants";
import { game } from "../core/Game";
import { authState } from "../managers/AuthStateManager";
import { HtmlOverlay } from "../ui/HtmlOverlay";
import { ApiError } from "../network/rest";

export class MainMenuScene extends Container implements IScene {
  private app: Application;
  private title: Text | null = null;
  private sprintButton: Container | null = null;
  private matchButton: Container | null = null;
  private leaderboardButton: Container | null = null;
  private usernameText: Text | null = null;
  private logoutText: Text | null = null;
  private upgradeText: Text | null = null;
  private upgradeOverlay: HtmlOverlay | null = null;

  constructor(app: Application) {
    super();
    this.app = app;
  }

  async init(): Promise<void> {
    this.createTitle();
    this.createSprintButton();
    this.createMatchButton();
    this.createLeaderboardButton();
    this.createUserInfo();
  }

  private createTitle(): void {
    this.title = new Text({
      text: "Find the Difference",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 36,
        fontWeight: "500",
        fill: COLORS.text,
      },
    });
    this.title.anchor.set(0.5);
    this.title.position.set(this.app.screen.width / 2, this.app.screen.height / 4);
    this.addChild(this.title);
  }

  private drawFilledButton(bg: Graphics, w: number, h: number, fill: number): void {
    bg.clear();
    bg.roundRect(-w / 2, -h / 2, w, h, 4);
    bg.fill(fill);
  }

  private drawOutlinedButton(bg: Graphics, w: number, h: number, fill: number): void {
    bg.clear();
    bg.roundRect(-w / 2, -h / 2, w, h, 4);
    bg.fill(fill);
    bg.stroke({ color: COLORS.border, width: 1 });
  }

  private createSprintButton(): void {
    const buttonWidth = 250;
    const buttonHeight = 48;
    const buttonX = this.app.screen.width / 2;
    const buttonY = this.app.screen.height / 2 - 40;

    this.sprintButton = new Container();
    this.sprintButton.position.set(buttonX, buttonY);

    const bg = new Graphics();
    this.drawFilledButton(bg, buttonWidth, buttonHeight, COLORS.primary);

    const text = new Text({
      text: "5 Sprint",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 16,
        fontWeight: "500",
        fill: COLORS.primaryOn,
      },
    });
    text.anchor.set(0.5);

    this.sprintButton.addChild(bg, text);
    this.sprintButton.eventMode = "static";
    this.sprintButton.cursor = "pointer";

    this.sprintButton.on("pointerover", () => {
      this.drawFilledButton(bg, buttonWidth, buttonHeight, COLORS.primaryHover);
    });
    this.sprintButton.on("pointerout", () => {
      this.drawFilledButton(bg, buttonWidth, buttonHeight, COLORS.primary);
    });
    this.sprintButton.on("pointerdown", () => {
      game.startSinglePlayer();
    });

    this.addChild(this.sprintButton);
  }

  private createMatchButton(): void {
    const buttonWidth = 250;
    const buttonHeight = 48;
    const buttonX = this.app.screen.width / 2;
    const buttonY = this.app.screen.height / 2 + 16;

    this.matchButton = new Container();
    this.matchButton.position.set(buttonX, buttonY);

    const bg = new Graphics();
    this.drawOutlinedButton(bg, buttonWidth, buttonHeight, COLORS.surface);

    const text = new Text({
      text: "1v1 Match",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 16,
        fontWeight: "500",
        fill: COLORS.text,
      },
    });
    text.anchor.set(0.5);

    this.matchButton.addChild(bg, text);
    this.matchButton.eventMode = "static";
    this.matchButton.cursor = "pointer";

    this.matchButton.on("pointerover", () => {
      this.drawOutlinedButton(bg, buttonWidth, buttonHeight, COLORS.surfaceMuted);
    });
    this.matchButton.on("pointerout", () => {
      this.drawOutlinedButton(bg, buttonWidth, buttonHeight, COLORS.surface);
    });
    this.matchButton.on("pointerdown", () => {
      game.showMatchmaking();
    });

    this.addChild(this.matchButton);
  }

  private createLeaderboardButton(): void {
    const buttonWidth = 250;
    const buttonHeight = 48;
    const buttonX = this.app.screen.width / 2;
    const buttonY = this.app.screen.height / 2 + 72;

    this.leaderboardButton = new Container();
    this.leaderboardButton.position.set(buttonX, buttonY);

    const bg = new Graphics();
    this.drawOutlinedButton(bg, buttonWidth, buttonHeight, COLORS.surface);

    const text = new Text({
      text: "Leaderboard",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 14,
        fontWeight: "500",
        fill: COLORS.primary,
      },
    });
    text.anchor.set(0.5);

    this.leaderboardButton.addChild(bg, text);
    this.leaderboardButton.eventMode = "static";
    this.leaderboardButton.cursor = "pointer";

    this.leaderboardButton.on("pointerover", () => {
      this.drawOutlinedButton(bg, buttonWidth, buttonHeight, COLORS.primarySoft);
    });
    this.leaderboardButton.on("pointerout", () => {
      this.drawOutlinedButton(bg, buttonWidth, buttonHeight, COLORS.surface);
    });
    this.leaderboardButton.on("pointerdown", () => {
      game.showLeaderboard();
    });

    this.addChild(this.leaderboardButton);
  }

  private createUserInfo(): void {
    const user = authState.getUser();
    if (!user) return;

    this.usernameText = new Text({
      text: user.name,
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 18,
        fill: COLORS.text,
      },
    });
    this.usernameText.anchor.set(1, 0);
    this.usernameText.position.set(this.app.screen.width - 20, 20);
    this.addChild(this.usernameText);

    let nextY = 46;

    // Guests get a "Save Account" link that lets them claim a permanent
    // username/password without losing their session or stats.
    if (user.isGuest) {
      this.upgradeText = new Text({
        text: "Save Account",
        style: {
          fontFamily: "Arial, sans-serif",
          fontSize: 16,
          fill: COLORS.primary,
        },
      });
      this.upgradeText.anchor.set(1, 0);
      this.upgradeText.position.set(this.app.screen.width - 20, nextY);
      this.upgradeText.eventMode = "static";
      this.upgradeText.cursor = "pointer";
      this.upgradeText.on("pointerover", () => {
        if (this.upgradeText) this.upgradeText.style.fill = COLORS.primaryHover;
      });
      this.upgradeText.on("pointerout", () => {
        if (this.upgradeText) this.upgradeText.style.fill = COLORS.primary;
      });
      this.upgradeText.on("pointerdown", () => this.openUpgradeModal());
      this.addChild(this.upgradeText);
      nextY += 26;
    }

    this.logoutText = new Text({
      text: "Logout",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 16,
        fill: COLORS.textSecondary,
      },
    });
    this.logoutText.anchor.set(1, 0);
    this.logoutText.position.set(this.app.screen.width - 20, nextY);
    this.logoutText.eventMode = "static";
    this.logoutText.cursor = "pointer";
    this.logoutText.on("pointerover", () => {
      if (this.logoutText) this.logoutText.style.fill = COLORS.text;
    });
    this.logoutText.on("pointerout", () => {
      if (this.logoutText) this.logoutText.style.fill = COLORS.textSecondary;
    });
    this.logoutText.on("pointerdown", async () => {
      await authState.logout();
      game.showAuthScene();
    });
    this.addChild(this.logoutText);
  }

  private openUpgradeModal(): void {
    this.upgradeOverlay?.destroy();
    this.upgradeOverlay = new HtmlOverlay();
    const card = this.upgradeOverlay.createFormContainer();

    const heading = document.createElement("h2");
    heading.textContent = "Save Account";
    Object.assign(heading.style, {
      color: "#202124",
      margin: "0 0 8px 0",
      fontSize: "20px",
      fontWeight: "500",
      textAlign: "center",
    });
    card.appendChild(heading);

    const blurb = document.createElement("p");
    blurb.textContent = "Pick a username and password to keep your guest progress.";
    Object.assign(blurb.style, {
      color: "#5F6368",
      fontSize: "13px",
      textAlign: "center",
      margin: "0 0 12px 0",
    });
    card.appendChild(blurb);

    const usernameInput = this.upgradeOverlay.createInput(card, {
      type: "text",
      placeholder: "Username",
      name: "username",
    });
    const passwordInput = this.upgradeOverlay.createInput(card, {
      type: "password",
      placeholder: "Password",
      name: "password",
    });

    const errorText = this.upgradeOverlay.createErrorText(card);
    const submitBtn = this.upgradeOverlay.createButton(card, "Save");
    const cancelBtn = this.upgradeOverlay.createSecondaryButton(card, "Cancel");

    cancelBtn.addEventListener("click", () => {
      this.upgradeOverlay?.destroy();
      this.upgradeOverlay = null;
    });

    const submit = async () => {
      const username = usernameInput.value.trim();
      const password = passwordInput.value;
      if (!username || !password) {
        errorText.textContent = "Username and password are required.";
        return;
      }
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving...";
      errorText.textContent = "";
      try {
        await authState.upgrade(username, password);
        this.upgradeOverlay?.destroy();
        this.upgradeOverlay = null;
        // Refresh the menu so the upgrade link disappears and the new name
        // shows up in the corner.
        await game.showMainMenu();
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.code === "username_taken") {
            errorText.textContent = "Username is already taken.";
          } else {
            errorText.textContent = err.message || "Something went wrong.";
          }
        } else {
          errorText.textContent = "Network error. Try again.";
        }
        submitBtn.disabled = false;
        submitBtn.textContent = "Save";
      }
    };
    submitBtn.addEventListener("click", submit);
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") submit();
    };
    usernameInput.addEventListener("keydown", onKeyDown);
    passwordInput.addEventListener("keydown", onKeyDown);
    usernameInput.focus();
  }

  update(): void {
    // No updates needed for menu
  }

  resize(width: number, height: number): void {
    if (this.title) {
      this.title.position.set(width / 2, height / 4);
    }
    if (this.sprintButton) {
      this.sprintButton.position.set(width / 2, height / 2 - 40);
    }
    if (this.matchButton) {
      this.matchButton.position.set(width / 2, height / 2 + 16);
    }
    if (this.leaderboardButton) {
      this.leaderboardButton.position.set(width / 2, height / 2 + 72);
    }
    if (this.usernameText) {
      this.usernameText.position.set(width - 20, 20);
    }
    if (this.upgradeText) {
      this.upgradeText.position.set(width - 20, 46);
    }
    if (this.logoutText) {
      this.logoutText.position.set(width - 20, this.upgradeText ? 72 : 46);
    }
  }

  destroy(): void {
    this.upgradeOverlay?.destroy();
    this.upgradeOverlay = null;
    this.removeAllListeners();
    super.destroy({ children: true });
  }
}
