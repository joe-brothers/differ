import { Container } from "pixi.js";
import confetti from "canvas-confetti";

// Theme-aligned palette pulled from DESIGN.md tokens. Mid-saturation hues
// (no `#202124` greys, no `#E8F0FE` pastels) so the confetti reads clearly
// against both the white surface and the underlying images.
const THEME_COLORS = ["#1A73E8", "#8AB4F8", "#188038", "#F9AB00", "#D93025"];

// Still extends Container so GameScene's `overlayLayer.addChild(...)` keeps
// working, but the actual particles render on canvas-confetti's own DOM
// canvas, layered above the Pixi canvas.
export class CelebrationEffect extends Container {
  play(centerX: number, centerY: number): Promise<void> {
    // The Pixi canvas matches the viewport (`resizeTo: window`), so world
    // coords == CSS pixels. Convert to a 0..1 origin for canvas-confetti.
    const w = window.innerWidth;
    const h = window.innerHeight;
    const origin = {
      x: clamp01(centerX / w),
      y: clamp01(centerY / h),
    };

    // Basic-cannon preset, gently tuned for an "image cleared" beat.
    void confetti({
      particleCount: 80,
      spread: 70,
      startVelocity: 35,
      gravity: 0.9,
      ticks: 200, // ~3.3s before particles are reaped
      scalar: 0.9,
      origin,
      colors: THEME_COLORS,
      disableForReducedMotion: true,
      zIndex: 30, // above Pixi canvas, below blocking modals
    });

    // Resolve before the particles have finished so the next-image
    // transition doesn't stall waiting on the visual to clear.
    return new Promise((resolve) => window.setTimeout(resolve, 450));
  }
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
