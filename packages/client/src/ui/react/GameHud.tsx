import { useUIStore } from "../store";
import { CSS, FONT_FAMILY } from "../styles";
import { IMAGES_PER_GAME, TOTAL_DIFFS_PER_GAME, UI_PADDING } from "../../constants";

export function GameHud() {
  const hudVisible = useUIStore((s) => s.hudVisible);
  const timerSec = useUIStore((s) => s.timerSec);
  const foundCount = useUIStore((s) => s.foundCount);
  const currentImageIndex = useUIStore((s) => s.currentImageIndex);
  const opponentFoundCount = useUIStore((s) => s.opponentFoundCount);
  const opponentOnline = useUIStore((s) => s.opponentOnline);
  const gameType = useUIStore((s) => s.gameType);

  if (!hudVisible) return null;

  const showOpponent = gameType === "one_on_one";
  const total = Math.max(0, Math.floor(timerSec));
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 10,
        fontFamily: FONT_FAMILY,
        color: CSS.text,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: UI_PADDING,
          left: UI_PADDING,
          fontSize: 28,
          fontWeight: "bold",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {`${m}:${s}`}
      </div>

      <div
        style={{
          position: "absolute",
          top: UI_PADDING,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 6,
          lineHeight: 1,
        }}
      >
        <div style={{ fontSize: 24, fontWeight: "bold", fontVariantNumeric: "tabular-nums" }}>
          {foundCount}/{TOTAL_DIFFS_PER_GAME}
        </div>
        <div style={{ fontSize: 20, color: CSS.textSecondary }}>
          Image {currentImageIndex + 1}/{IMAGES_PER_GAME}
        </div>
      </div>

      {showOpponent && (
        <div
          style={{
            position: "absolute",
            top: UI_PADDING,
            right: UI_PADDING,
            fontSize: 16,
            lineHeight: 1,
            color: opponentOnline ? CSS.textSecondary : CSS.error,
          }}
        >
          Opponent {opponentFoundCount}/{TOTAL_DIFFS_PER_GAME}
          {!opponentOnline && " (Disconnected)"}
        </div>
      )}
    </div>
  );
}
