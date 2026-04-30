// Server configuration. Empty default = same-origin requests. Dev relies on
// the Vite proxy (vite.config.ts), prod relies on deploying API on the same
// registrable domain. Override via VITE_API_BASE_URL only for cross-origin.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "";

// Cloudflare Turnstile site key (public). Empty disables client-side widget;
// pair with empty TURNSTILE_SECRET on the server to keep verification a no-op.
export const TURNSTILE_SITE_KEY =
  (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) ?? "";

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
// Muted Chromium gray — applied to diffs revealed by a daily Hint so the
// player can tell at a glance which ones they actually spotted.
export const MARKER_HINT_COLOR = 0x80868b;
export const MARKER_STROKE_WIDTH = 4;

// UI Colors — Pixi side mirror of CSS tokens in src/ui/styles.ts.
// See DESIGN.md for the canonical palette. Two palettes (light/dark) are
// defined and `COLORS` is mutated in place by `applyPalette()` so existing
// `import { COLORS }` consumers always see the active theme without rebinding.
type Palette = {
  background: number;
  surface: number;
  surfaceMuted: number;
  surfaceSunken: number;
  border: number;
  borderStrong: number;
  text: number;
  textSecondary: number;
  textTertiary: number;
  primary: number;
  primaryHover: number;
  primaryPressed: number;
  primarySoft: number;
  primaryOn: number;
  success: number;
  successBg: number;
  warning: number;
  warningBg: number;
  error: number;
  errorBg: number;
  overlay: number;
  gold: number;
  goldBg: number;
  silver: number;
  silverBg: number;
  bronze: number;
  bronzeBg: number;
};

const LIGHT_PALETTE: Palette = {
  background: 0xffffff,
  surface: 0xffffff,
  surfaceMuted: 0xf8f9fa,
  surfaceSunken: 0xf1f3f4,
  border: 0xdadce0,
  borderStrong: 0xbdc1c6,

  text: 0x202124,
  textSecondary: 0x5f6368,
  textTertiary: 0x80868b,

  primary: 0x1a73e8,
  primaryHover: 0x1b66c9,
  primaryPressed: 0x1557b0,
  primarySoft: 0xe8f0fe,
  primaryOn: 0xffffff,

  success: 0x188038,
  successBg: 0xe6f4ea,
  warning: 0xb06000,
  warningBg: 0xfef7e0,
  error: 0xd93025,
  errorBg: 0xfce8e6,

  overlay: 0x202124,

  gold: 0xf9ab00,
  goldBg: 0xfef7e0,
  silver: 0x8a8d91,
  silverBg: 0xeceef1,
  bronze: 0xa0561a,
  bronzeBg: 0xf8e4d0,
};

// Material/Chromium dark scheme. Surfaces sit just above #202124 background,
// text colors borrow from the dark Material palette, primary brightens to
// #8AB4F8 so it stays legible on dark surfaces.
const DARK_PALETTE: Palette = {
  background: 0x202124,
  surface: 0x2d2e31,
  surfaceMuted: 0x303134,
  surfaceSunken: 0x1f2023,
  border: 0x3c4043,
  borderStrong: 0x5f6368,

  text: 0xe8eaed,
  textSecondary: 0x9aa0a6,
  textTertiary: 0x80868b,

  primary: 0x8ab4f8,
  primaryHover: 0xaecbfa,
  primaryPressed: 0xc7dbfd,
  primarySoft: 0x1f3f66,
  primaryOn: 0x202124,

  success: 0x81c995,
  successBg: 0x1e3a2a,
  warning: 0xfdd663,
  warningBg: 0x4d3f12,
  error: 0xf28b82,
  errorBg: 0x4a1d1a,

  overlay: 0x000000,

  gold: 0xfdd663,
  goldBg: 0x4d3f12,
  silver: 0xbdc1c6,
  silverBg: 0x2a2a2d,
  bronze: 0xe8ab6f,
  bronzeBg: 0x3d2615,
};

export const COLORS: Palette = { ...LIGHT_PALETTE };

export function applyPalette(mode: "light" | "dark"): void {
  const next = mode === "dark" ? DARK_PALETTE : LIGHT_PALETTE;
  Object.assign(COLORS, next);
}

// Layout
export const UI_PADDING = 20;
export const IMAGE_GAP = 40;
