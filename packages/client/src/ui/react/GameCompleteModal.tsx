import { useState, type CSSProperties, type ReactNode } from "react";
import { useUIStore, type OverlayModal } from "../store";
import { cardStyle, CSS, FONT_MONO, modalBackdropStyle } from "../styles";
import { Button } from "./Button";
import { TOTAL_DIFFS_PER_GAME } from "../../constants";

function formatTime(elapsedSec: number): string {
  const minutes = Math.floor(elapsedSec / 60);
  const seconds = Math.floor(elapsedSec % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

const opponentNameStyle: CSSProperties = {
  fontFamily: FONT_MONO,
  fontWeight: 600,
  color: CSS.text,
  padding: "1px 6px",
  borderRadius: 4,
  backgroundColor: CSS.primarySoft,
};

function OpponentName({ name }: { name: string }) {
  return <span style={opponentNameStyle}>{name}</span>;
}

interface Copy {
  title: string;
  titleColor: string;
  subtitle: ReactNode;
  playAgainLabel: string;
}

function buildShareText(args: {
  date: string;
  elapsedSec: number | null;
  foundCount: number;
  hintsUsed: number;
}): string {
  const result =
    args.elapsedSec != null
      ? formatTime(args.elapsedSec)
      : `${args.foundCount}/${TOTAL_DIFFS_PER_GAME}`;
  // "Flawless" suffix is reserved for completed runs that didn't take a hint.
  // Timeouts and hint-assisted finishes don't get the badge — the LinkedIn
  // game-share style cue is meant to convey "no help, no shortcuts."
  const flawless = args.hintsUsed === 0 && args.elapsedSec != null ? " (Flawless ✨)" : "";
  return `Differ Daily ${args.date} — ${result}${flawless}\n${window.location.origin}`;
}

function DailyCompleteCard({
  modal,
  onMainMenu,
}: {
  modal: Extract<OverlayModal, { type: "complete-daily" }>;
  onMainMenu: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const completed = modal.elapsedSec != null;
  const flawless = completed && modal.hintsUsed === 0;

  const onCopy = async () => {
    const text = buildShareText({
      date: modal.date,
      elapsedSec: modal.elapsedSec,
      foundCount: modal.foundCount,
      hintsUsed: modal.hintsUsed,
    });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — leave the button silent */
    }
  };

  return (
    <div style={modalBackdropStyle(0.5)}>
      <div style={{ ...cardStyle, minWidth: 400, gap: 12 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 28,
            lineHeight: "36px",
            fontWeight: 500,
            color: completed ? CSS.success : CSS.textSecondary,
          }}
        >
          {completed ? "Daily Complete" : "Daily Finished"}
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: CSS.textSecondary }}>{modal.date}</p>

        <div style={{ marginTop: 12, fontSize: 12, color: CSS.textSecondary, letterSpacing: 0.5 }}>
          {completed ? "YOUR TIME" : "YOUR PROGRESS"}
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
          {completed
            ? formatTime(modal.elapsedSec ?? 0)
            : `${modal.foundCount}/${TOTAL_DIFFS_PER_GAME}`}
        </div>

        {flawless && (
          <div
            style={{
              marginTop: 4,
              padding: "4px 12px",
              borderRadius: 9999,
              fontSize: 14,
              fontWeight: 500,
              color: CSS.gold,
              backgroundColor: CSS.warningBg,
            }}
            title="No hints used — eligible for the daily leaderboard."
          >
            Flawless ✨
          </div>
        )}
        {completed && !flawless && (
          <div style={{ marginTop: 4, fontSize: 13, color: CSS.textSecondary }}>
            {modal.hintsUsed} hint{modal.hintsUsed === 1 ? "" : "s"} used · streak kept, not on
            leaderboard
          </div>
        )}

        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <Button label={copied ? "Copied!" : "Copy Result"} color={CSS.primary} onClick={onCopy} />
          <Button
            label="Main Menu"
            color={CSS.surface}
            onClick={onMainMenu}
            style={{ color: CSS.text, border: `1px solid ${CSS.border}` }}
          />
        </div>
      </div>
    </div>
  );
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
  const opponent = modal.opponentName ? (
    <OpponentName name={modal.opponentName} />
  ) : (
    "your opponent"
  );
  return {
    title: isWin ? "You Win" : "You Lost",
    titleColor: isWin ? CSS.success : CSS.error,
    subtitle: isWin ? <>You beat {opponent}.</> : <>{opponent} beat you.</>,
    playAgainLabel: "Rematch",
  };
}

export function GameCompleteModal() {
  const modal = useUIStore((s) => s.modal);
  const rematchPending = useUIStore((s) => s.rematchPending);
  const opponentRematch = useUIStore((s) => s.opponentRematch);
  const callbacks = useUIStore((s) => s.callbacks);

  if (modal.type === "complete-daily") {
    return <DailyCompleteCard modal={modal} onMainMenu={() => callbacks.onMainMenu?.()} />;
  }

  if (modal.type !== "complete-single" && modal.type !== "complete-1v1") return null;

  const copy = getCopy(modal);
  const rank = modal.type === "complete-single" ? modal.rank : undefined;

  const playAgainLabel = rematchPending ? "Waiting for opponent..." : copy.playAgainLabel;

  // For 1v1: winner sees their time; loser sees their progress so the
  // outcome doesn't feel like a stopwatch they didn't trigger.
  const is1v1 = modal.type === "complete-1v1";
  const isLoser = is1v1 && modal.result === "lose";
  const isWinner = is1v1 && modal.result === "win";

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

        {isWinner && modal.type === "complete-1v1" && (
          <div
            style={{
              marginTop: 8,
              fontSize: 13,
              color: CSS.textSecondary,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {modal.opponentName ? <OpponentName name={modal.opponentName} /> : "Opponent"} found{" "}
            {modal.opponentFoundCount}/{TOTAL_DIFFS_PER_GAME}
          </div>
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
            {modal.opponentName ? <OpponentName name={modal.opponentName} /> : "Opponent"} wants a
            rematch
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
