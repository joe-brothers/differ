import { useUIStore } from "../store";
import { cardStyle, CSS, modalBackdropStyle } from "../styles";
import { Button } from "./Button";

export function PauseModal() {
  const modal = useUIStore((s) => s.modal);
  const callbacks = useUIStore((s) => s.callbacks);

  if (modal.type !== "pause") return null;

  return (
    <div style={modalBackdropStyle(0.7)}>
      <div style={{ ...cardStyle, gap: 20 }}>
        <h2
          style={{
            margin: "0 0 8px 0",
            fontSize: 32,
            fontWeight: "bold",
            color: CSS.text,
          }}
        >
          Paused
        </h2>
        <Button label="Resume" onClick={() => callbacks.onResume?.()} />
        <Button label="Main Menu" onClick={() => callbacks.onMainMenu?.()} />
      </div>
    </div>
  );
}
