// Server configuration
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://127.0.0.1:8787";

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
// Chromium "danger" red — used as the diff marker stroke for status alignment.
export const MARKER_COLOR = 0xd93025;
export const MARKER_STROKE_WIDTH = 4;

// UI Colors — Pixi side mirror of CSS tokens in src/ui/styles.ts.
// See DESIGN.md for the canonical palette.
export const COLORS = {
  // Surfaces
  background: 0xffffff,
  surface: 0xffffff,
  surfaceMuted: 0xf8f9fa,
  surfaceSunken: 0xf1f3f4,
  border: 0xdadce0,
  borderStrong: 0xbdc1c6,

  // Text
  text: 0x202124,
  textSecondary: 0x5f6368,
  textTertiary: 0x80868b,

  // Accent
  primary: 0x1a73e8,
  primaryHover: 0x1b66c9,
  primaryPressed: 0x1557b0,
  primarySoft: 0xe8f0fe,
  primaryOn: 0xffffff,

  // Status
  success: 0x188038,
  successBg: 0xe6f4ea,
  warning: 0xb06000,
  warningBg: 0xfef7e0,
  error: 0xd93025,
  errorBg: 0xfce8e6,

  // Modal scrim — neutral charcoal, not pure black.
  overlay: 0x202124,

  // Highlight (rank gold)
  gold: 0xf9ab00,
};

// Layout
export const UI_PADDING = 20;
export const IMAGE_GAP = 40;
