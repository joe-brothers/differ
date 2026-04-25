import type { CSSProperties } from "react";

// DESIGN.md — Chromium Issue Tracker–inspired theme.
// Single source of truth for the React/DOM layer. Pixi-side colors live in
// constants.ts (numeric form) and must mirror the values below.

export const FONT_FAMILY =
  '"Google Sans", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
export const FONT_MONO = '"Roboto Mono", "JetBrains Mono", ui-monospace, monospace';

export const CSS = {
  // Surfaces
  background: "#FFFFFF",
  surface: "#FFFFFF",
  panel: "#FFFFFF",
  surfaceMuted: "#F8F9FA",
  surfaceSunken: "#F1F3F4",
  border: "#DADCE0",
  borderStrong: "#BDC1C6",

  // Text
  text: "#202124",
  textSecondary: "#5F6368",
  textTertiary: "#80868B",

  // Accent (primary blue)
  primary: "#1A73E8",
  primaryHover: "#1B66C9",
  primaryPressed: "#1557B0",
  primarySoft: "#E8F0FE",
  primaryOn: "#FFFFFF",

  // Status pairs (text + tinted bg)
  success: "#188038",
  successBg: "#E6F4EA",
  warning: "#B06000",
  warningBg: "#FEF7E0",
  error: "#D93025",
  errorBg: "#FCE8E6",

  // Misc
  gold: "#F9AB00",
  disabled: "#DADCE0",
  disabledText: "#80868B",
};

export const RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  pill: 9999,
};

export const SHADOW = {
  s1: "0 1px 2px 0 rgba(60,64,67,.08), 0 1px 3px 1px rgba(60,64,67,.06)",
  s2: "0 2px 6px 2px rgba(60,64,67,.10), 0 1px 2px 0 rgba(60,64,67,.06)",
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

export const modalBackdropStyle = (alpha = 0.6): CSSProperties => ({
  position: "absolute",
  inset: 0,
  // Chromium uses a neutral charcoal scrim, not pure black.
  backgroundColor: `rgba(32, 33, 36, ${alpha})`,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 20,
  fontFamily: FONT_FAMILY,
  // #react-root sets pointer-events: none; modals re-enable to capture clicks.
  pointerEvents: "auto",
});
