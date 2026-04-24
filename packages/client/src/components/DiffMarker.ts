import { Graphics } from "pixi.js";
import { MARKER_RADIUS, MARKER_COLOR, MARKER_STROKE_WIDTH } from "../constants";

export class DiffMarker extends Graphics {
  constructor(
    x: number,
    y: number,
    radius: number = MARKER_RADIUS,
    animate: boolean = true,
  ) {
    super();

    // Draw red circle outline
    this.circle(0, 0, radius);
    this.stroke({ color: MARKER_COLOR, width: MARKER_STROKE_WIDTH });

    this.position.set(x, y);

    // Play appear animation only if requested
    if (animate) {
      this.playAppearAnimation();
    }
  }

  private playAppearAnimation(): void {
    // Start small and scale up
    this.scale.set(0.3);
    this.alpha = 0;

    // Animate using a simple approach (could use GSAP for better animations)
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
