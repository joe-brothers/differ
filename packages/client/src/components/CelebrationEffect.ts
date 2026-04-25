import { Container } from "pixi.js";
import confetti from "canvas-confetti";

// Cool-tone palette: Chromium blues stepping from primary down to a faint
// tint, plus white and a neutral grey for variety. Reads cleanly against
// both the white surface and arbitrary game images.
const THEME_COLORS = ["#1A73E8", "#8AB4F8", "#A8C7FA", "#FFFFFF", "#BDC1C6"];

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

    // 360° burst: particles radiate outward from the origin in all directions.
    // Low gravity so they drift outward rather than rain straight down — feels
    // like an "image cleared" pop, not a cannon shot from below.
    void confetti({
      particleCount: 110,
      spread: 360,
      startVelocity: 28,
      gravity: 0.45,
      ticks: 80, // ~1.3s lifetime
      decay: 0.9,
      scalar: 0.9,
      origin,
      colors: THEME_COLORS,
      disableForReducedMotion: true,
      zIndex: 30, // above Pixi canvas, below blocking modals
    });

    // Resolve before particles have fully cleared so the next-image
    // transition doesn't stall on the visual.
    return new Promise((resolve) => window.setTimeout(resolve, 350));
  }
}

function clamp01(v: number): number {
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}
