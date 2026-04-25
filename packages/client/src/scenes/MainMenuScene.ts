import { Application, Container, Graphics, Text } from "pixi.js";
import type { IScene } from "../types";
import { COLORS } from "../constants";
import { game } from "../core/Game";
import { authState } from "../managers/AuthStateManager";

export class MainMenuScene extends Container implements IScene {
  private app: Application;
  private title: Text | null = null;
  private sprintButton: Container | null = null;
  private matchButton: Container | null = null;
  private leaderboardButton: Container | null = null;
  private usernameText: Text | null = null;
  private logoutText: Text | null = null;

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
        fontSize: 48,
        fontWeight: "bold",
        fill: COLORS.text,
      },
    });
    this.title.anchor.set(0.5);
    this.title.position.set(this.app.screen.width / 2, this.app.screen.height / 4);
    this.addChild(this.title);
  }

  private createSprintButton(): void {
    const buttonWidth = 250;
    const buttonHeight = 60;
    const buttonX = this.app.screen.width / 2;
    const buttonY = this.app.screen.height / 2 - 50;

    this.sprintButton = new Container();
    this.sprintButton.position.set(buttonX, buttonY);

    const bg = new Graphics();
    bg.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12);
    bg.fill(COLORS.primary);

    const text = new Text({
      text: "5 Sprint",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 28,
        fontWeight: "bold",
        fill: COLORS.text,
      },
    });
    text.anchor.set(0.5);

    this.sprintButton.addChild(bg, text);
    this.sprintButton.eventMode = "static";
    this.sprintButton.cursor = "pointer";

    this.sprintButton.on("pointerover", () => {
      bg.clear();
      bg.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12);
      bg.fill(COLORS.primaryHover);
    });
    this.sprintButton.on("pointerout", () => {
      bg.clear();
      bg.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12);
      bg.fill(COLORS.primary);
    });
    this.sprintButton.on("pointerdown", () => {
      game.startSinglePlayer();
    });

    this.addChild(this.sprintButton);
  }

  private createMatchButton(): void {
    const buttonWidth = 250;
    const buttonHeight = 60;
    const buttonX = this.app.screen.width / 2;
    const buttonY = this.app.screen.height / 2 + 30;

    this.matchButton = new Container();
    this.matchButton.position.set(buttonX, buttonY);

    const bg = new Graphics();
    bg.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12);
    bg.fill(COLORS.success);

    const text = new Text({
      text: "1v1 Match",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 28,
        fontWeight: "bold",
        fill: COLORS.text,
      },
    });
    text.anchor.set(0.5);

    this.matchButton.addChild(bg, text);
    this.matchButton.eventMode = "static";
    this.matchButton.cursor = "pointer";

    const hoverColor = COLORS.success + 0x222222;
    this.matchButton.on("pointerover", () => {
      bg.clear();
      bg.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12);
      bg.fill(hoverColor);
    });
    this.matchButton.on("pointerout", () => {
      bg.clear();
      bg.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12);
      bg.fill(COLORS.success);
    });
    this.matchButton.on("pointerdown", () => {
      game.showMatchmaking();
    });

    this.addChild(this.matchButton);
  }

  private createLeaderboardButton(): void {
    const buttonWidth = 250;
    const buttonHeight = 50;
    const buttonX = this.app.screen.width / 2;
    const buttonY = this.app.screen.height / 2 + 110;

    this.leaderboardButton = new Container();
    this.leaderboardButton.position.set(buttonX, buttonY);

    const bg = new Graphics();
    bg.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12);
    bg.fill(0x3a3a5e);

    const text = new Text({
      text: "Leaderboard",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 22,
        fill: COLORS.textSecondary,
      },
    });
    text.anchor.set(0.5);

    this.leaderboardButton.addChild(bg, text);
    this.leaderboardButton.eventMode = "static";
    this.leaderboardButton.cursor = "pointer";

    this.leaderboardButton.on("pointerover", () => {
      bg.clear();
      bg.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12);
      bg.fill(0x4a4a6e);
    });
    this.leaderboardButton.on("pointerout", () => {
      bg.clear();
      bg.roundRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 12);
      bg.fill(0x3a3a5e);
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

    this.logoutText = new Text({
      text: "Logout",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 16,
        fill: COLORS.textSecondary,
      },
    });
    this.logoutText.anchor.set(1, 0);
    this.logoutText.position.set(this.app.screen.width - 20, 46);
    this.logoutText.eventMode = "static";
    this.logoutText.cursor = "pointer";
    this.logoutText.on("pointerover", () => {
      if (this.logoutText) this.logoutText.style.fill = COLORS.text;
    });
    this.logoutText.on("pointerout", () => {
      if (this.logoutText) this.logoutText.style.fill = COLORS.textSecondary;
    });
    this.logoutText.on("pointerdown", () => {
      authState.logout();
      game.showAuthScene();
    });
    this.addChild(this.logoutText);
  }

  update(): void {
    // No updates needed for menu
  }

  resize(width: number, height: number): void {
    if (this.title) {
      this.title.position.set(width / 2, height / 4);
    }
    if (this.sprintButton) {
      this.sprintButton.position.set(width / 2, height / 2 - 50);
    }
    if (this.matchButton) {
      this.matchButton.position.set(width / 2, height / 2 + 30);
    }
    if (this.leaderboardButton) {
      this.leaderboardButton.position.set(width / 2, height / 2 + 110);
    }
    if (this.usernameText) {
      this.usernameText.position.set(width - 20, 20);
    }
    if (this.logoutText) {
      this.logoutText.position.set(width - 20, 46);
    }
  }

  destroy(): void {
    this.removeAllListeners();
    super.destroy({ children: true });
  }
}
