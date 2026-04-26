import { Graphics } from "pixi.js";
import { MARKER_RADIUS, MARKER_COLOR, MARKER_STROKE_WIDTH } from "../constants";

// Three concentric strokes from outside in:
// 1. Soft dark halo — adds a "shadow" silhouette so the ring still reads on
//    near-white image regions.
// 2. White halo — separates the ring from the underlying image so it stays
//    visible when the underlying pixels happen to share its color.
// 3. The actual ring (red for spotted diffs, gray for hint-revealed ones).
export class DiffMarker extends Graphics {
  constructor(
    x: number,
    y: number,
    radius: number = MARKER_RADIUS,
    animate: boolean = true,
    color: number = MARKER_COLOR,
  ) {
    super();

    this.circle(0, 0, radius);
    this.stroke({
      color: 0x000000,
      width: MARKER_STROKE_WIDTH + 5,
      alpha: 0.28,
    });

    this.circle(0, 0, radius);
    this.stroke({
      color: 0xffffff,
      width: MARKER_STROKE_WIDTH + 3,
      alpha: 0.95,
    });

    this.circle(0, 0, radius);
    this.stroke({ color, width: MARKER_STROKE_WIDTH });

    this.position.set(x, y);

    if (animate) {
      this.playAppearAnimation();
    }
  }

  private playAppearAnimation(): void {
    this.scale.set(0.3);
    this.alpha = 0;

    const duration = 200; // ms
    const startTime = Date.now();

    const animate = (): void => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      this.scale.set(0.3 + 0.7 * eased);
      this.alpha = eased;

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }
}
