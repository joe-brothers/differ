import { Container, Graphics, Text } from "pixi.js";
import { COLORS } from "../constants";

export class CountdownOverlay extends Container {
  private background: Graphics;
  private countdownText: Text;

  constructor(screenWidth: number, screenHeight: number) {
    super();

    // Semi-transparent background — Chromium charcoal scrim.
    this.background = new Graphics();
    this.background.rect(0, 0, screenWidth, screenHeight);
    this.background.fill({ color: COLORS.overlay, alpha: 0.6 });
    this.background.eventMode = "static"; // Block clicks through
    this.addChild(this.background);

    // Countdown text — must remain white over the dark scrim.
    this.countdownText = new Text({
      text: "",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 120,
        fontWeight: "500",
        fill: COLORS.primaryOn,
      },
    });
    this.countdownText.anchor.set(0.5);
    this.countdownText.position.set(screenWidth / 2, screenHeight / 2);
    this.addChild(this.countdownText);

    // Hidden by default
    this.visible = false;
  }

  // Each frame is anchored to an absolute wall-clock instant relative to
  // `startedAt`, *not* sequenced by setTimeout from `play()` invocation. If
  // image loading or scene mount drags `play()` past one of the offsets we
  // simply skip that frame instead of clipping the next one — which is how
  // "3 → 2 → 시작" used to leak through with no "1".
  async play(startedAt: number): Promise<void> {
    this.visible = true;

    const frames: { text: string; offsetBeforeStart: number }[] = [
      { text: "3", offsetBeforeStart: 3000 },
      { text: "2", offsetBeforeStart: 2000 },
      { text: "1", offsetBeforeStart: 1000 },
      { text: "FIND!", offsetBeforeStart: 0 },
    ];

    for (const frame of frames) {
      const fireAt = startedAt - frame.offsetBeforeStart;
      const wait = fireAt - Date.now();
      if (wait > 0) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((r) => setTimeout(r, wait));
      } else if (frame.text !== "FIND!" && wait < -200) {
        // We're already past this frame's slot by a meaningful margin;
        // don't show a stale number that would race with the next one.
        continue;
      }
      this.showItem(frame.text);
    }

    // Hold "FIND!" briefly past startedAt so the transition to the board
    // doesn't feel jumpy, then hide.
    await new Promise<void>((r) => setTimeout(r, 250));
    this.visible = false;
  }

  private showItem(text: string): void {
    this.countdownText.text = text;
    this.countdownText.scale.set(0.5);
    this.countdownText.alpha = 0;

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
  }

  resize(screenWidth: number, screenHeight: number): void {
    this.background.clear();
    this.background.rect(0, 0, screenWidth, screenHeight);
    this.background.fill({ color: COLORS.overlay, alpha: 0.6 });

    this.countdownText.position.set(screenWidth / 2, screenHeight / 2);
  }
}
