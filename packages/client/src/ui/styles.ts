import type { CSSProperties } from "react";

// DESIGN.md — Chromium Issue Tracker–inspired theme.
// Single source of truth for the React/DOM layer. All values are CSS
// variables defined in public/style.css so light/dark switches automatically
// when ThemeManager flips `data-theme` on <html> — no React re-render needed.
// Pixi-side numeric mirrors live in constants.ts.

export const FONT_FAMILY =
  '"Google Sans", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
export const FONT_MONO = '"Roboto Mono", "JetBrains Mono", ui-monospace, monospace';

export const CSS = {
  // Surfaces
  background: "var(--bg)",
  surface: "var(--surface)",
  panel: "var(--surface)",
  surfaceMuted: "var(--surface-muted)",
  surfaceSunken: "var(--surface-sunken)",
  border: "var(--border)",
  borderStrong: "var(--border-strong)",

  // Text
  text: "var(--text)",
  textSecondary: "var(--text-secondary)",
  textTertiary: "var(--text-tertiary)",

  // Accent (primary blue)
  primary: "var(--primary)",
  primaryHover: "var(--primary-hover)",
  primaryPressed: "var(--primary-pressed)",
  primarySoft: "var(--primary-soft)",
  primaryOn: "var(--primary-on)",

  // Status pairs (text + tinted bg)
  success: "var(--success)",
  successBg: "var(--success-bg)",
  warning: "var(--warning)",
  warningBg: "var(--warning-bg)",
  error: "var(--error)",
  errorBg: "var(--error-bg)",

  // Misc
  gold: "var(--gold)",
  disabled: "var(--disabled)",
  disabledText: "var(--disabled-text)",
};

export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  pill: 9999,
};

export const SHADOW = {
  s1: "var(--shadow-1)",
  s2: "var(--shadow-2)",
};

// Filled button. The Chromium tracker uses outlined "secondary" buttons too,
// but everywhere this codebase calls Button it wants a tinted action — keep
// the API single-variant (color = fill) and adjust foreground for contrast.
export const buttonStyle = (color: string = CSS.primary, disabled = false): CSSProperties => ({
  minWidth: "200px",
  padding: "10px 24px",
  height: "40px",
  borderRadius: `${RADIUS.sm}px`,
  border: "none",
  backgroundColor: disabled ? CSS.disabled : color,
  color: disabled ? CSS.disabledText : CSS.primaryOn,
  fontFamily: FONT_FAMILY,
  fontSize: "14px",
  fontWeight: 500,
  letterSpacing: "0.25px",
  cursor: disabled ? "default" : "pointer",
  transition: "background-color 80ms ease-out, box-shadow 80ms ease-out",
});

export const cardStyle: CSSProperties = {
  backgroundColor: CSS.surface,
  borderRadius: `${RADIUS.lg}px`,
  border: `1px solid ${CSS.border}`,
  padding: "32px",
  minWidth: "320px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "16px",
  boxShadow: SHADOW.s2,
  fontFamily: FONT_FAMILY,
  color: CSS.text,
};

// `alpha` is kept as an API knob so callers (PauseModal, GameCompleteModal)
// can dial the scrim. We bake it into a per-call rgba so the modal can stay
// at 0.5 even though the global --scrim is tuned for ~0.6.
export const modalBackdropStyle = (alpha = 0.6): CSSProperties => ({
  position: "absolute",
  inset: 0,
  backgroundColor: scrimColor(alpha),
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 20,
  fontFamily: FONT_FAMILY,
  // #react-root sets pointer-events: none; modals re-enable to capture clicks.
  pointerEvents: "auto",
});

// Modal scrim. Light theme: neutral charcoal (matches Chromium). Dark: pure
// black so the dimmed background reads as "darker than the surface."
function scrimColor(alpha: number): string {
  if (typeof document !== "undefined") {
    const t = document.documentElement.getAttribute("data-theme");
    if (t === "dark") return `rgba(0, 0, 0, ${alpha})`;
  }
  return `rgba(32, 33, 36, ${alpha})`;
}
