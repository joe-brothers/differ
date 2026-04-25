import { useUIStore, type OverlayModal } from "../store";
import { cardStyle, CSS, FONT_MONO, modalBackdropStyle } from "../styles";
import { Button } from "./Button";
import { TOTAL_DIFFS_PER_GAME } from "../../constants";

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
      title: "Congratulations",
      titleColor: CSS.success,
      subtitle: "You found all differences.",
      playAgainLabel: "Play Again",
    };
  }
  const isWin = modal.result === "win";
  const opponent = modal.opponentName || "your opponent";
  return {
    title: isWin ? "You Win" : "You Lost",
    titleColor: isWin ? CSS.success : CSS.error,
    subtitle: isWin ? `You beat ${opponent}.` : `${opponent} beat you.`,
    playAgainLabel: "Rematch",
  };
}

export function GameCompleteModal() {
  const modal = useUIStore((s) => s.modal);
  const rematchPending = useUIStore((s) => s.rematchPending);
  const opponentRematch = useUIStore((s) => s.opponentRematch);
  const callbacks = useUIStore((s) => s.callbacks);

  if (modal.type !== "complete-single" && modal.type !== "complete-1v1") return null;

  const copy = getCopy(modal);
  const rank = modal.type === "complete-single" ? modal.rank : undefined;

  const playAgainLabel = rematchPending ? "Waiting for opponent..." : copy.playAgainLabel;

  // For 1v1: winner sees their time; loser sees their progress so the
  // outcome doesn't feel like a stopwatch they didn't trigger.
  const is1v1 = modal.type === "complete-1v1";
  const isLoser = is1v1 && modal.result === "lose";

  return (
    <div style={modalBackdropStyle(0.5)}>
      <div style={{ ...cardStyle, minWidth: 400, gap: 12 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 28,
            lineHeight: "36px",
            fontWeight: 500,
            color: copy.titleColor,
          }}
        >
          {copy.title}
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: CSS.textSecondary }}>{copy.subtitle}</p>

        {isLoser ? (
          <>
            <div
              style={{ marginTop: 12, fontSize: 12, color: CSS.textSecondary, letterSpacing: 0.5 }}
            >
              YOUR PROGRESS
            </div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 48,
                fontWeight: 500,
                color: CSS.text,
                lineHeight: 1.1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {modal.foundCount}/{TOTAL_DIFFS_PER_GAME}
              <span style={{ fontSize: 16, color: CSS.textSecondary, marginLeft: 8 }}>found</span>
            </div>
          </>
        ) : (
          <>
            <div
              style={{ marginTop: 12, fontSize: 12, color: CSS.textSecondary, letterSpacing: 0.5 }}
            >
              YOUR TIME
            </div>
            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 48,
                fontWeight: 500,
                color: CSS.text,
                lineHeight: 1.1,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatTime(modal.elapsedSec)}
            </div>
          </>
        )}

        {rank !== undefined && (
          <div
            style={{
              marginTop: 4,
              padding: "4px 12px",
              borderRadius: 9999,
              fontSize: 14,
              fontWeight: 500,
              color: rank <= 3 ? CSS.gold : CSS.primary,
              backgroundColor: rank <= 3 ? CSS.warningBg : CSS.primarySoft,
            }}
          >
            Rank #{rank}
          </div>
        )}

        {is1v1 && opponentRematch && !rematchPending && (
          <div
            style={{
              marginTop: 8,
              padding: "8px 12px",
              borderRadius: 6,
              fontSize: 13,
              color: CSS.primary,
              backgroundColor: CSS.primarySoft,
              border: `1px solid ${CSS.primary}33`,
              textAlign: "center",
            }}
          >
            {modal.opponentName || "Opponent"} wants a rematch
          </div>
        )}

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <Button
            label={playAgainLabel}
            color={CSS.primary}
            disabled={rematchPending}
            onClick={() => callbacks.onPlayAgain?.()}
          />
          <Button
            label="Main Menu"
            color={CSS.surface}
            onClick={() => callbacks.onMainMenu?.()}
            style={{ color: CSS.text, border: `1px solid ${CSS.border}` }}
          />
        </div>
      </div>
    </div>
  );
}
