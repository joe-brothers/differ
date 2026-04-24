import { Container, Graphics } from "pixi.js";
import { COLORS } from "../constants";

export class MenuIcon extends Container {
  private bg: Graphics;
  private onClick: (() => void) | null = null;

  constructor() {
    super();

    const size = 44;
    const padding = 10;

    // Background
    this.bg = new Graphics();
    this.bg.roundRect(0, 0, size, size, 8);
    this.bg.fill(COLORS.primary);
    this.addChild(this.bg);

    // Draw hamburger icon (three lines)
    const icon = new Graphics();
    const lineWidth = size - padding * 2;
    const lineHeight = 3;
    const gap = 6;
    const startY = (size - lineHeight * 3 - gap * 2) / 2;

    for (let i = 0; i < 3; i++) {
      icon.rect(
        padding,
        startY + i * (lineHeight + gap),
        lineWidth,
        lineHeight,
      );
    }
    icon.fill(COLORS.text);
    this.addChild(icon);

    // Make interactive
    this.eventMode = "static";
    this.cursor = "pointer";

    this.on("pointerover", () => {
      this.bg.clear();
      this.bg.roundRect(0, 0, size, size, 8);
      this.bg.fill(COLORS.primaryHover);
    });

    this.on("pointerout", () => {
      this.bg.clear();
      this.bg.roundRect(0, 0, size, size, 8);
      this.bg.fill(COLORS.primary);
    });

    this.on("pointerdown", () => {
      this.onClick?.();
    });
  }

  setCallback(onClick: () => void): void {
    this.onClick = onClick;
  }
}
