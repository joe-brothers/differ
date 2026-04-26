import { Container, Graphics, Text } from "pixi.js";
import { COLORS } from "../constants";

export class NavButtons extends Container {
  private prevButton: Container;
  private nextButton: Container;
  private onPrev: (() => void) | null = null;
  private onNext: (() => void) | null = null;

  constructor() {
    super();

    this.prevButton = this.createButton("‹", true);
    this.nextButton = this.createButton("›", false);

    this.prevButton.position.set(0, 0);
    this.nextButton.position.set(60, 0);

    this.addChild(this.prevButton, this.nextButton);
  }

  private createButton(label: string, isPrev: boolean): Container {
    const size = 50;
    const button = new Container();

    const bg = new Graphics();
    bg.roundRect(0, 0, size, size, 4);
    bg.fill(COLORS.primary);

    const text = new Text({
      text: label,
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 22,
        fontWeight: "500",
        fill: COLORS.primaryOn,
      },
    });
    text.anchor.set(0.5);
    text.position.set(size / 2, 16);

    const keyHint = new Text({
      text: isPrev ? "A" : "D",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 11,
        fontWeight: "700",
        fill: COLORS.primaryOn,
        letterSpacing: 0.5,
      },
    });
    keyHint.anchor.set(0.5);
    keyHint.position.set(size / 2, 36);
    keyHint.alpha = 0.85;

    button.addChild(bg, text, keyHint);

    button.eventMode = "static";
    button.cursor = "pointer";

    button.on("pointerover", () => {
      bg.clear();
      bg.roundRect(0, 0, size, size, 4);
      bg.fill(COLORS.primaryHover);
    });

    button.on("pointerout", () => {
      bg.clear();
      bg.roundRect(0, 0, size, size, 4);
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
    this.prevButton.alpha = currentIndex > 0 ? 1 : 0.4;
    this.prevButton.eventMode = currentIndex > 0 ? "static" : "none";

    this.nextButton.alpha = currentIndex < totalImages - 1 ? 1 : 0.4;
    this.nextButton.eventMode = currentIndex < totalImages - 1 ? "static" : "none";
  }
}
