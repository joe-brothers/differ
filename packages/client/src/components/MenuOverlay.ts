import { Container, Graphics, Text } from "pixi.js";
import { COLORS } from "../constants";

export class MenuOverlay extends Container {
  private background: Graphics;
  private menuContainer: Container;
  private onResume: (() => void) | null = null;
  private onMainMenu: (() => void) | null = null;

  constructor(screenWidth: number, screenHeight: number) {
    super();

    // Semi-transparent background
    this.background = new Graphics();
    this.background.rect(0, 0, screenWidth, screenHeight);
    this.background.fill({ color: COLORS.overlay, alpha: 0.7 });
    this.background.eventMode = "static"; // Block clicks through
    this.addChild(this.background);

    // Menu container
    this.menuContainer = new Container();
    this.menuContainer.position.set(screenWidth / 2, screenHeight / 2);

    // Menu background
    const menuBg = new Graphics();
    const menuWidth = 300;
    const menuHeight = 250;
    menuBg.roundRect(
      -menuWidth / 2,
      -menuHeight / 2,
      menuWidth,
      menuHeight,
      16,
    );
    menuBg.fill(0x2a2a4e);
    this.menuContainer.addChild(menuBg);

    // Title
    const title = new Text({
      text: "Paused",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 32,
        fontWeight: "bold",
        fill: COLORS.text,
      },
    });
    title.anchor.set(0.5);
    title.position.set(0, -70);
    this.menuContainer.addChild(title);

    // Resume button
    const resumeBtn = this.createButton("Resume", 0);
    resumeBtn.on("pointerdown", () => this.onResume?.());
    this.menuContainer.addChild(resumeBtn);

    // Main Menu button
    const mainMenuBtn = this.createButton("Main Menu", 70);
    mainMenuBtn.on("pointerdown", () => this.onMainMenu?.());
    this.menuContainer.addChild(mainMenuBtn);

    this.addChild(this.menuContainer);

    // Hidden by default
    this.visible = false;
  }

  private createButton(label: string, yOffset: number): Container {
    const buttonWidth = 200;
    const buttonHeight = 50;
    const button = new Container();
    button.position.set(0, yOffset);

    const bg = new Graphics();
    bg.roundRect(
      -buttonWidth / 2,
      -buttonHeight / 2,
      buttonWidth,
      buttonHeight,
      10,
    );
    bg.fill(COLORS.primary);

    const text = new Text({
      text: label,
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 22,
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
      bg.roundRect(
        -buttonWidth / 2,
        -buttonHeight / 2,
        buttonWidth,
        buttonHeight,
        10,
      );
      bg.fill(COLORS.primaryHover);
    });

    button.on("pointerout", () => {
      bg.clear();
      bg.roundRect(
        -buttonWidth / 2,
        -buttonHeight / 2,
        buttonWidth,
        buttonHeight,
        10,
      );
      bg.fill(COLORS.primary);
    });

    return button;
  }

  setCallbacks(onResume: () => void, onMainMenu: () => void): void {
    this.onResume = onResume;
    this.onMainMenu = onMainMenu;
  }

  show(): void {
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }

  resize(screenWidth: number, screenHeight: number): void {
    this.background.clear();
    this.background.rect(0, 0, screenWidth, screenHeight);
    this.background.fill({ color: COLORS.overlay, alpha: 0.7 });

    this.menuContainer.position.set(screenWidth / 2, screenHeight / 2);
  }
}
