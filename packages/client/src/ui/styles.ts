import type { CSSProperties } from "react";

export const FONT_FAMILY = "Arial, sans-serif";

export const CSS = {
  background: "#1a1a2e",
  panel: "#2a2a4e",
  primary: "#4a90d9",
  primaryHover: "#6ba3e0",
  text: "#ffffff",
  textSecondary: "#cccccc",
  success: "#4caf50",
  error: "#ff5252",
  gold: "#ffd700",
  disabled: "#888888",
};

export const buttonStyle = (color: string = CSS.primary, disabled = false): CSSProperties => ({
  width: "200px",
  padding: "12px 24px",
  borderRadius: "10px",
  border: "none",
  backgroundColor: disabled ? CSS.disabled : color,
  color: CSS.text,
  fontFamily: FONT_FAMILY,
  fontSize: "20px",
  fontWeight: "bold",
  cursor: disabled ? "default" : "pointer",
  transition: "opacity 0.15s ease",
});

export const cardStyle: CSSProperties = {
  backgroundColor: CSS.panel,
  borderRadius: "20px",
  padding: "40px",
  minWidth: "320px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "16px",
  boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
  fontFamily: FONT_FAMILY,
  color: CSS.text,
};

export const modalBackdropStyle = (alpha = 0.7): CSSProperties => ({
  position: "absolute",
  inset: 0,
  backgroundColor: `rgba(0, 0, 0, ${alpha})`,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 20,
  fontFamily: FONT_FAMILY,
  // #react-root sets pointer-events: none; modals re-enable to capture clicks.
  pointerEvents: "auto",
});
