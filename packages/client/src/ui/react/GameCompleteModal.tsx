import { useUIStore, type OverlayModal } from "../store";
import { cardStyle, CSS, modalBackdropStyle } from "../styles";
import { Button } from "./Button";

function formatTime(elapsedSec: number): string {
  const minutes = Math.floor(elapsedSec / 60);
  const seconds = Math.floor(elapsedSec % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

interface Copy {
  title: string;
  titleColor: string;
  subtitle: string;
  playAgainLabel: string;
}

function getCopy(
  modal: Extract<OverlayModal, { type: "complete-single" } | { type: "complete-1v1" }>,
): Copy {
  if (modal.type === "complete-single") {
    return {
      title: "Congratulations!",
      titleColor: CSS.success,
      subtitle: "You found all differences!",
      playAgainLabel: "Play Again",
    };
  }
  const isWin = modal.result === "win";
  return {
    title: isWin ? "You Win!" : "You Lost!",
    titleColor: isWin ? CSS.success : CSS.error,
    subtitle: isWin ? "You found all differences first!" : "Your opponent finished first!",
    playAgainLabel: "Rematch",
  };
}

export function GameCompleteModal() {
  const modal = useUIStore((s) => s.modal);
  const rematchPending = useUIStore((s) => s.rematchPending);
  const callbacks = useUIStore((s) => s.callbacks);

  if (modal.type !== "complete-single" && modal.type !== "complete-1v1") return null;

  const copy = getCopy(modal);
  const rank = modal.type === "complete-single" ? modal.rank : undefined;

  const playAgainLabel = rematchPending ? "Waiting for opponent..." : copy.playAgainLabel;

  return (
    <div style={modalBackdropStyle(0.85)}>
      <div style={{ ...cardStyle, minWidth: 400 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 36,
            fontWeight: "bold",
            color: copy.titleColor,
          }}
        >
          {copy.title}
        </h2>
        <p style={{ margin: 0, fontSize: 20, color: CSS.textSecondary }}>{copy.subtitle}</p>

        <div style={{ marginTop: 12, fontSize: 18, color: CSS.textSecondary }}>Your Time</div>
        <div
          style={{
            fontSize: 56,
            fontWeight: "bold",
            color: CSS.text,
            lineHeight: 1.1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatTime(modal.elapsedSec)}
        </div>

        {rank !== undefined && (
          <div
            style={{
              marginTop: 8,
              fontSize: 28,
              fontWeight: "bold",
              color: rank <= 3 ? CSS.gold : CSS.primary,
            }}
          >
            Rank #{rank}
          </div>
        )}

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <Button
            label={playAgainLabel}
            color={CSS.success}
            disabled={rematchPending}
            onClick={() => callbacks.onPlayAgain?.()}
          />
          <Button label="Main Menu" color={CSS.primary} onClick={() => callbacks.onMainMenu?.()} />
        </div>
      </div>
    </div>
  );
}
