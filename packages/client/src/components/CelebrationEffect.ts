import { Container, Graphics } from "pixi.js";
import { COLORS } from "../constants";

// A restrained, theme-aligned "image cleared" feedback:
// • Two thin success-colored rings expanding outward (stroke only, no fill).
// • A handful of small dots radiating outward.
// Avoids the saturated filled-disc effect, which clashed with the light theme.
export class CelebrationEffect extends Container {
  play(centerX: number, centerY: number): Promise<void> {
    return new Promise((resolve) => {
      this.spawnRing(centerX, centerY, { delay: 0, duration: 600 });
      this.spawnRing(centerX, centerY, { delay: 120, duration: 600 });
      this.spawnDots(centerX, centerY);
      // Resolve once the slowest ring would be done.
      window.setTimeout(resolve, 720);
    });
  }

  private spawnRing(cx: number, cy: number, opts: { delay: number; duration: number }): void {
    const ring = new Graphics();
    ring.position.set(cx, cy);
    ring.alpha = 0;
    this.addChild(ring);

    const start = performance.now() + opts.delay;
    const maxRadius = 130;
    const startRadius = 16;

    const animate = () => {
      const now = performance.now();
      if (now < start) {
        requestAnimationFrame(animate);
        return;
      }
      const progress = Math.min((now - start) / opts.duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const radius = startRadius + (maxRadius - startRadius) * eased;

      ring.clear();
      ring.circle(0, 0, radius);
      ring.stroke({ color: COLORS.success, width: 2, alpha: 0.55 * (1 - eased) });
      ring.alpha = 1;

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.removeChild(ring);
        ring.destroy();
      }
    };
    requestAnimationFrame(animate);
  }

  private spawnDots(cx: number, cy: number): void {
    const count = 8;
    const duration = 550;
    const distance = 90;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dot = new Graphics();
      dot.circle(0, 0, 3);
      dot.fill({ color: COLORS.success, alpha: 0.85 });
      dot.position.set(cx, cy);
      this.addChild(dot);

      const start = performance.now();
      const targetX = cx + Math.cos(angle) * distance;
      const targetY = cy + Math.sin(angle) * distance;

      const animate = () => {
        const progress = Math.min((performance.now() - start) / duration, 1);
        // ease-out quad
        const eased = 1 - Math.pow(1 - progress, 2);
        dot.position.set(cx + (targetX - cx) * eased, cy + (targetY - cy) * eased);
        dot.alpha = 0.85 * (1 - eased);
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.removeChild(dot);
          dot.destroy();
        }
      };
      requestAnimationFrame(animate);
    }
  }
}
