import { useUIStore } from "../store";
import { CSS, FONT_FAMILY, FONT_MONO, RADIUS, SHADOW } from "../styles";
import { IMAGES_PER_GAME, TOTAL_DIFFS_PER_GAME, UI_PADDING } from "../../constants";

// Chromium-tracker-style chip: white surface, hairline border, soft shadow.
const chip = {
  background: CSS.surface,
  border: `1px solid ${CSS.border}`,
  borderRadius: `${RADIUS.pill}px`,
  padding: "8px 14px",
  boxShadow: SHADOW.s1,
  fontFamily: FONT_FAMILY,
  color: CSS.text,
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  lineHeight: 1,
} as const;

export function GameHud() {
  const hudVisible = useUIStore((s) => s.hudVisible);
  const timerSec = useUIStore((s) => s.timerSec);
  const foundCount = useUIStore((s) => s.foundCount);
  const currentImageIndex = useUIStore((s) => s.currentImageIndex);
  const opponentFoundCount = useUIStore((s) => s.opponentFoundCount);
  const opponentOnline = useUIStore((s) => s.opponentOnline);
  const opponentName = useUIStore((s) => s.opponentName);
  const opponentWins = useUIStore((s) => s.opponentWins);
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
      }}
    >
      <div
        style={{
          ...chip,
          position: "absolute",
          top: UI_PADDING,
          left: UI_PADDING,
          fontFamily: FONT_MONO,
          fontSize: 18,
          fontWeight: 500,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {`${m}:${s}`}
      </div>

      <div
        style={{
          ...chip,
          position: "absolute",
          top: UI_PADDING,
          left: "50%",
          transform: "translateX(-50%)",
          gap: 12,
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {foundCount}/{TOTAL_DIFFS_PER_GAME}
        </span>
        <span style={{ width: 1, height: 14, background: CSS.border }} />
        <span style={{ color: CSS.textSecondary, fontWeight: 400 }}>
          Image {currentImageIndex + 1}/{IMAGES_PER_GAME}
        </span>
      </div>

      {showOpponent && (
        <div
          style={{
            ...chip,
            position: "absolute",
            top: UI_PADDING,
            right: UI_PADDING,
            fontSize: 13,
            color: opponentOnline ? CSS.text : CSS.error,
            background: opponentOnline ? CSS.surface : CSS.errorBg,
            borderColor: opponentOnline ? CSS.border : CSS.error,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: opponentOnline ? CSS.success : CSS.error,
            }}
          />
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
            <span>
              {opponentName ? (
                <span style={{ fontFamily: FONT_MONO, fontWeight: 600 }}>{opponentName}</span>
              ) : (
                "Opponent"
              )}{" "}
              {opponentFoundCount}/{TOTAL_DIFFS_PER_GAME}
            </span>
            {opponentName && (
              <span style={{ color: CSS.textSecondary, fontSize: 11, fontWeight: 400 }}>
                {opponentWins} win{opponentWins === 1 ? "" : "s"}
              </span>
            )}
          </span>
          {!opponentOnline && <span style={{ color: CSS.error }}>(Disconnected)</span>}
        </div>
      )}
    </div>
  );
}
