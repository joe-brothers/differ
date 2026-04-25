import { useUIStore } from "../store";
import { cardStyle, CSS, modalBackdropStyle } from "../styles";
import { Button } from "./Button";

export function PauseModal() {
  const modal = useUIStore((s) => s.modal);
  const callbacks = useUIStore((s) => s.callbacks);

  if (modal.type !== "pause") return null;

  return (
    <div style={modalBackdropStyle(0.5)}>
      <div style={{ ...cardStyle, gap: 16 }}>
        <h2
          style={{
            margin: "0 0 8px 0",
            fontSize: 22,
            lineHeight: "28px",
            fontWeight: 500,
            color: CSS.text,
          }}
        >
          Paused
        </h2>
        <Button label="Resume" onClick={() => callbacks.onResume?.()} />
        <Button
          label="Main Menu"
          color={CSS.surface}
          onClick={() => callbacks.onMainMenu?.()}
          style={{
            color: CSS.text,
            border: `1px solid ${CSS.border}`,
          }}
        />
      </div>
    </div>
  );
}
