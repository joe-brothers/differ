import { Container, Graphics } from "pixi.js";
import { COLORS } from "../constants";

export class MenuIcon extends Container {
  private bg: Graphics;
  private onClick: (() => void) | null = null;

  constructor() {
    super();

    const size = 44;
    const padding = 12;

    // Outlined "secondary" button — white surface with hairline border to
    // match Chromium chrome buttons.
    this.bg = new Graphics();
    this.bg.roundRect(0, 0, size, size, 4);
    this.bg.fill(COLORS.surface);
    this.bg.stroke({ color: COLORS.border, width: 1 });
    this.addChild(this.bg);

    // Hamburger glyph
    const icon = new Graphics();
    const lineWidth = size - padding * 2;
    const lineHeight = 2;
    const gap = 5;
    const startY = (size - lineHeight * 3 - gap * 2) / 2;

    for (let i = 0; i < 3; i++) {
      icon.rect(padding, startY + i * (lineHeight + gap), lineWidth, lineHeight);
    }
    icon.fill(COLORS.text);
    this.addChild(icon);

    this.eventMode = "static";
    this.cursor = "pointer";

    this.on("pointerover", () => {
      this.bg.clear();
      this.bg.roundRect(0, 0, size, size, 4);
      this.bg.fill(COLORS.surfaceMuted);
      this.bg.stroke({ color: COLORS.borderStrong, width: 1 });
    });

    this.on("pointerout", () => {
      this.bg.clear();
      this.bg.roundRect(0, 0, size, size, 4);
      this.bg.fill(COLORS.surface);
      this.bg.stroke({ color: COLORS.border, width: 1 });
    });

    this.on("pointerdown", () => {
      this.onClick?.();
    });
  }

  setCallback(onClick: () => void): void {
    this.onClick = onClick;
  }
}
