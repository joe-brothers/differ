import { Container, Graphics, Text } from "pixi.js";
import { COLORS } from "../constants";

export class CountdownOverlay extends Container {
  private background: Graphics;
  private countdownText: Text;

  constructor(screenWidth: number, screenHeight: number) {
    super();

    // Semi-transparent background
    this.background = new Graphics();
    this.background.rect(0, 0, screenWidth, screenHeight);
    this.background.fill({ color: COLORS.overlay, alpha: 0.7 });
    this.background.eventMode = "static"; // Block clicks through
    this.addChild(this.background);

    // Countdown text
    this.countdownText = new Text({
      text: "",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 120,
        fontWeight: "bold",
        fill: COLORS.text,
      },
    });
    this.countdownText.anchor.set(0.5);
    this.countdownText.position.set(screenWidth / 2, screenHeight / 2);
    this.addChild(this.countdownText);

    // Hidden by default
    this.visible = false;
  }

  async play(): Promise<void> {
    this.visible = true;

    const sequence = ["3", "2", "1", "FIND!"];
    const delay = 800;

    for (const item of sequence) {
      await this.showItem(item, delay);
    }

    this.visible = false;
  }

  private showItem(text: string, duration: number): Promise<void> {
    return new Promise((resolve) => {
      this.countdownText.text = text;
      this.countdownText.scale.set(0.5);
      this.countdownText.alpha = 0;

      // Animate in
      const startTime = performance.now();
      const animateIn = () => {
        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / 200, 1);

        // Ease out quad
        const easeProgress = 1 - (1 - progress) * (1 - progress);

        this.countdownText.scale.set(0.5 + easeProgress * 0.5);
        this.countdownText.alpha = easeProgress;

        if (progress < 1) {
          requestAnimationFrame(animateIn);
        }
      };

      animateIn();

      // Resolve after duration
      setTimeout(resolve, duration);
    });
  }

  resize(screenWidth: number, screenHeight: number): void {
    this.background.clear();
    this.background.rect(0, 0, screenWidth, screenHeight);
    this.background.fill({ color: COLORS.overlay, alpha: 0.7 });

    this.countdownText.position.set(screenWidth / 2, screenHeight / 2);
  }
}
