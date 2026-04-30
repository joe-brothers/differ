import { useEffect, useState } from "react";
import { useUIStore } from "../store";
import { themeManager, type ThemeMode } from "../../managers/ThemeManager";
import { CSS, FONT_FAMILY, RADIUS, SHADOW } from "../styles";

// Three-way segmented control: System / Light / Dark.
// Hidden during gameplay (the HUD owns the screen there) so the toggle
// doesn't visually compete with the timer/score chips. `data-theme` flips
// instantly via ThemeManager; no scene rebuild needed for React/DOM.
export function ThemeToggle() {
  const hudVisible = useUIStore((s) => s.hudVisible);
  const [mode, setMode] = useState<ThemeMode>(() => themeManager.getMode());

  // Picker only listens for *resolved* changes to keep its rendered "active"
  // pill in sync when the user picks System and the OS preference flips.
  useEffect(() => themeManager.subscribe(() => setMode(themeManager.getMode())), []);

  if (hudVisible) return null;

  const choose = (next: ThemeMode) => {
    themeManager.setMode(next);
    setMode(next);
  };

  return (
    <div
      style={{
        position: "absolute",
        right: 16,
        bottom: 16,
        display: "inline-flex",
        gap: 0,
        padding: 2,
        borderRadius: RADIUS.pill,
        background: CSS.surface,
        border: `1px solid ${CSS.border}`,
        boxShadow: SHADOW.s1,
        fontFamily: FONT_FAMILY,
        pointerEvents: "auto",
        zIndex: 5,
      }}
      role="group"
      aria-label="Theme"
    >
      <Segment
        label="Auto"
        title="System default"
        active={mode === "system"}
        onClick={() => choose("system")}
        icon="🖥️"
      />
      <Segment
        label="Light"
        title="Light"
        active={mode === "light"}
        onClick={() => choose("light")}
        icon="☀️"
      />
      <Segment
        label="Dark"
        title="Dark"
        active={mode === "dark"}
        onClick={() => choose("dark")}
        icon="🌙"
      />
    </div>
  );
}

function Segment({
  label,
  title,
  active,
  onClick,
  icon,
}: {
  label: string;
  title: string;
  active: boolean;
  onClick: () => void;
  icon: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        height: 28,
        border: "none",
        borderRadius: RADIUS.pill,
        background: active ? CSS.primarySoft : "transparent",
        color: active ? CSS.primary : CSS.textSecondary,
        fontFamily: FONT_FAMILY,
        fontSize: 12,
        fontWeight: 500,
        cursor: "pointer",
        lineHeight: 1,
      }}
    >
      <span aria-hidden style={{ fontSize: 13 }}>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
