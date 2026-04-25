import { useState, type CSSProperties, type MouseEvent } from "react";
import { buttonStyle, CSS } from "../styles";

interface Props {
  label: string;
  color?: string;
  disabled?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  style?: CSSProperties;
}

// State-layer overlay: a translucent dark/black inset ring darkens the
// button uniformly on hover/press regardless of its base color. Mirrors
// Material/Chromium's hover treatment without per-color hover tokens.
function stateOverlay(hover: boolean, pressed: boolean, disabled: boolean): string {
  if (disabled) return "none";
  if (pressed) return "inset 0 0 0 9999px rgba(0,0,0,0.16)";
  if (hover) return "inset 0 0 0 9999px rgba(0,0,0,0.08)";
  return "none";
}

export function Button({ label, color = CSS.primary, disabled = false, onClick, style }: Props) {
  const [hover, setHover] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        ...buttonStyle(color, disabled),
        boxShadow: stateOverlay(hover, pressed, disabled),
        ...style,
      }}
    >
      {label}
    </button>
  );
}
