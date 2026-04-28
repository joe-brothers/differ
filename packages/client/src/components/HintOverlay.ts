import { Container, Graphics } from "pixi.js";
import type { DiffRect } from "../types";
import { IMAGE_WIDTH, IMAGE_HEIGHT } from "../constants";

// Spotlight overlay shown over a panel while a hint is pending. The dim
// frame focuses attention on the revealed rect; the pulsing ring on top
// keeps it obviously interactive even at small rect sizes. Rendered in
// image coordinates (0..IMAGE_WIDTH × 0..IMAGE_HEIGHT) and added under
// each panel container, so the panel scale carries it.
//
// The overlay does not capture pointer events — click gating happens in
// GameScene.handleClickAt by hit-testing against the same rect. That keeps
// "click outside the cutout" as a silent no-op (no wrong-click penalty).
const DIM_COLOR = 0x000000;
const DIM_ALPHA = 0.62;
// Padding around the rect for the cutout window. Larger than MARKER_RADIUS
// so the marker that appears on click isn't clipped by the dim frame.
const CUTOUT_PADDING = 28;
const RING_COLOR = 0xfdd663; // amber — bright on dim, distinct from MARKER_COLOR red
const RING_WIDTH = 4;
const RING_RADIUS = 10;
const PULSE_PERIOD_MS = 1100;

export class HintOverlay extends Container {
  private dim: Graphics;
  private ring: Graphics;
  private animStart: number;
  private rafId: number | null = null;

  constructor(rect: DiffRect) {
    super();
    this.eventMode = "none"; // pointer-through; clicks routed via GameScene

    const cx = rect.start_point.x;
    const cy = rect.start_point.y;
    const cw = rect.width;
    const ch = rect.height;
    const ox = Math.max(0, cx - CUTOUT_PADDING);
    const oy = Math.max(0, cy - CUTOUT_PADDING);
    const oxe = Math.min(IMAGE_WIDTH, cx + cw + CUTOUT_PADDING);
    const oye = Math.min(IMAGE_HEIGHT, cy + ch + CUTOUT_PADDING);

    this.dim = new Graphics();
    // Four-rect frame around the cutout (top, bottom, left strip, right strip).
    this.dim.rect(0, 0, IMAGE_WIDTH, oy);
    this.dim.rect(0, oye, IMAGE_WIDTH, IMAGE_HEIGHT - oye);
    this.dim.rect(0, oy, ox, oye - oy);
    this.dim.rect(oxe, oy, IMAGE_WIDTH - oxe, oye - oy);
    this.dim.fill({ color: DIM_COLOR, alpha: DIM_ALPHA });
    this.addChild(this.dim);

    this.ring = new Graphics();
    this.ring.roundRect(ox, oy, oxe - ox, oye - oy, RING_RADIUS);
    this.ring.stroke({ color: RING_COLOR, width: RING_WIDTH });
    this.addChild(this.ring);

    this.animStart = performance.now();
    this.tick();
  }

  private tick = (): void => {
    const elapsed = performance.now() - this.animStart;
    const t = (elapsed % PULSE_PERIOD_MS) / PULSE_PERIOD_MS;
    // Cosine pulse: 1.0 → 0.55 → 1.0 over the period.
    const pulse = 0.5 + 0.5 * Math.cos(t * Math.PI * 2);
    this.ring.alpha = 0.55 + 0.45 * pulse;
    this.rafId = requestAnimationFrame(this.tick);
  };

  override destroy(): void {
    if (this.rafId != null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    super.destroy();
  }
}
