import { useState, type CSSProperties, type MouseEvent } from "react";
import { buttonStyle, CSS } from "../styles";

interface Props {
  label: string;
  color?: string;
  disabled?: boolean;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  style?: CSSProperties;
}

export function Button({ label, color = CSS.primary, disabled = false, onClick, style }: Props) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        ...buttonStyle(color, disabled),
        opacity: !disabled && hover ? 0.85 : 1,
        ...style,
      }}
    >
      {label}
    </button>
  );
}
