import { Container, Graphics, Text } from "pixi.js";
import { COLORS } from "../constants";

export class NavButtons extends Container {
  private prevButton: Container;
  private nextButton: Container;
  private onPrev: (() => void) | null = null;
  private onNext: (() => void) | null = null;

  constructor() {
    super();

    this.prevButton = this.createButton("<", true);
    this.nextButton = this.createButton(">", false);

    // Position buttons (will be adjusted by parent)
    this.prevButton.position.set(0, 0);
    this.nextButton.position.set(60, 0);

    this.addChild(this.prevButton, this.nextButton);
  }

  private createButton(label: string, isPrev: boolean): Container {
    const size = 50;
    const button = new Container();

    const bg = new Graphics();
    bg.roundRect(0, 0, size, size, 8);
    bg.fill(COLORS.primary);

    const text = new Text({
      text: label,
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 24,
        fontWeight: "bold",
        fill: COLORS.text,
      },
    });
    text.anchor.set(0.5);
    text.position.set(size / 2, size / 2);

    button.addChild(bg, text);

    button.eventMode = "static";
    button.cursor = "pointer";

    button.on("pointerover", () => {
      bg.clear();
      bg.roundRect(0, 0, size, size, 8);
      bg.fill(COLORS.primaryHover);
    });

    button.on("pointerout", () => {
      bg.clear();
      bg.roundRect(0, 0, size, size, 8);
      bg.fill(COLORS.primary);
    });

    button.on("pointerdown", () => {
      if (isPrev) {
        this.onPrev?.();
      } else {
        this.onNext?.();
      }
    });

    return button;
  }

  setCallbacks(onPrev: () => void, onNext: () => void): void {
    this.onPrev = onPrev;
    this.onNext = onNext;
  }

  updateState(currentIndex: number, totalImages: number): void {
    // Disable prev if at first image
    this.prevButton.alpha = currentIndex > 0 ? 1 : 0.5;
    this.prevButton.eventMode = currentIndex > 0 ? "static" : "none";

    // Disable next if at last image
    this.nextButton.alpha = currentIndex < totalImages - 1 ? 1 : 0.5;
    this.nextButton.eventMode =
      currentIndex < totalImages - 1 ? "static" : "none";
  }
}
