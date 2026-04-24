// Server configuration
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://127.0.0.1:8787";

// CDN and image configuration
export const CDN_BASE = "https://differ-assets.joe-brothers.com";
export const IMAGE_WIDTH = 300;
export const IMAGE_HEIGHT = 430;

// Game configuration (must match @differ/shared)
export const IMAGES_PER_GAME = 5;
export const DIFFS_PER_IMAGE = 5;
export const TOTAL_DIFFS_PER_GAME = IMAGES_PER_GAME * DIFFS_PER_IMAGE; // 25

// Timing
export const WRONG_CLICK_COOLDOWN_MS = 1000;

// Visual styling
export const MARKER_RADIUS = 25;
export const MARKER_COLOR = 0xff0000;
export const MARKER_STROKE_WIDTH = 4;

// UI Colors
export const COLORS = {
  background: 0x1a1a2e,
  primary: 0x4a90d9,
  primaryHover: 0x6ba3e0,
  text: 0xffffff,
  textSecondary: 0xcccccc,
  overlay: 0x000000,
  success: 0x4caf50,
  error: 0xff5252,
};

// Layout
export const UI_PADDING = 20;
export const IMAGE_GAP = 40;
