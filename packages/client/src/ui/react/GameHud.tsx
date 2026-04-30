import { useEffect, useState } from "react";
import { useUIStore } from "../store";
import { game } from "../../core/Game";
import { gameState } from "../../managers/GameStateManager";
import { CSS, FONT_FAMILY, FONT_MONO, RADIUS, SHADOW } from "../styles";
import { DIFFS_PER_IMAGE, IMAGES_PER_GAME, TOTAL_DIFFS_PER_GAME } from "../../constants";

// HUD spacing tokens — clamp() so the HUD hugs the edges on phones but
// breathes on desktop, no media queries needed.
const HUD_INSET = "clamp(8px, 2vw, 20px)";

// Vertical breathing room between the image panels and the floating
// StageTracker / Hint above and below them.
const IMAGE_HUG_GAP = 36;

// Gap between an arrow button and the edge of the image pair. Mirror this
// in GameScene.setupLayout if you change it — the canvas reserves matching
// horizontal room so the arrows never crowd the panels.
const ARROW_GAP = 48;

const chipBase = {
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
  const gameType = useUIStore((s) => s.gameType);

  if (!hudVisible) return null;

  // Two layers, both inside `position: absolute; inset: 0`:
  //   1. A flex column for the always-on chrome that sits at the viewport
  //      edges — top bar (timer + opponent) and the middle row that floats
  //      the prev/next arrows alongside the image pair.
  //   2. Floating elements absolutely positioned against the image bounds
  //      published by GameScene — StageTracker hugs the top edge, Hint
  //      hugs the bottom edge.
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
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <TopBar gameType={gameType} />
        <MiddleRow />
      </div>

      <FloatingTracker />
      {gameType === "daily" && <FloatingHint />}
    </div>
  );
}

// ─── Top bar ────────────────────────────────────────────────────────────────

function TopBar({ gameType }: { gameType: ReturnType<typeof useUIStore.getState>["gameType"] }) {
  const timerSec = useUIStore((s) => s.timerSec);
  const total = Math.max(0, Math.floor(timerSec));
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        padding: HUD_INSET,
        flexWrap: "wrap",
      }}
    >
      {/* Left: timer */}
      <div
        style={{
          ...chipBase,
          fontFamily: FONT_MONO,
          fontSize: 18,
          fontWeight: 500,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {`${m}:${s}`}
      </div>

      {/* Right slot — opponent for 1v1, otherwise a spacer matching the Pixi
          MenuIcon's footprint (44px button + UI_PADDING) so we don't overlap
          it. The MenuIcon paints behind this layer; pointer-events:none on
          the spacer keeps clicks falling through. */}
      {gameType === "one_on_one" ? <OpponentChip /> : <div style={{ width: 64, height: 1 }} />}
    </div>
  );
}

function OpponentChip() {
  const opponentFoundCount = useUIStore((s) => s.opponentFoundCount);
  const opponentOnline = useUIStore((s) => s.opponentOnline);
  const opponentName = useUIStore((s) => s.opponentName);
  const opponentWins = useUIStore((s) => s.opponentWins);

  return (
    <div
      style={{
        ...chipBase,
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
          {opponentFoundCount}
          <span style={{ color: CSS.textSecondary }}>/{TOTAL_DIFFS_PER_GAME}</span>
        </span>
        {opponentName && (
          <span style={{ color: CSS.textSecondary, fontSize: 11, fontWeight: 400 }}>
            {opponentWins} win{opponentWins === 1 ? "" : "s"}
          </span>
        )}
      </span>
      {!opponentOnline && <span style={{ color: CSS.error }}>(Disconnected)</span>}
    </div>
  );
}

// ─── Floating StageTracker (anchored to top edge of image pair) ────────────

// "X / 25 found" header sits directly above the per-pair pills; both float
// just above the image pair (anchored via imagePairTop). Replaces the
// top-bar center column so the tracker reads as part of the image area
// rather than viewport chrome.
function FloatingTracker() {
  const foundCount = useUIStore((s) => s.foundCount);
  const imagePairTop = useUIStore((s) => s.imagePairTop);

  return (
    <div
      style={{
        position: "absolute",
        // Bottom edge of the tracker sits IMAGE_HUG_GAP above the image top.
        // translateY(-100%) bottoms-out the box at the requested coord; the
        // HUG_GAP subtraction lifts it the rest of the way.
        top: Math.max(0, imagePairTop - IMAGE_HUG_GAP),
        left: "50%",
        transform: "translate(-50%, -100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 6,
          fontSize: 13,
          fontWeight: 500,
          color: CSS.text,
        }}
      >
        <span
          style={{
            fontVariantNumeric: "tabular-nums",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {foundCount}
          <span style={{ color: CSS.textSecondary, fontWeight: 400 }}>
            {" / "}
            {TOTAL_DIFFS_PER_GAME}
          </span>
        </span>
        <span style={{ color: CSS.textSecondary, fontWeight: 400 }}>found</span>
      </div>
      <StageTracker />
    </div>
  );
}

function StageTracker() {
  const currentImageIndex = useUIStore((s) => s.currentImageIndex);
  const foundPerImage = useUIStore((s) => s.foundPerImage);
  const hintActive = useUIStore((s) => s.hintActive);

  const navDisabled = hintActive;
  const goTo = (i: number) => {
    if (navDisabled) return;
    gameState.navigateToImage(i);
  };

  return (
    <div
      style={{
        ...chipBase,
        padding: "6px 10px",
        gap: 6,
        pointerEvents: "auto",
        flexWrap: "wrap",
        justifyContent: "center",
      }}
    >
      {Array.from({ length: IMAGES_PER_GAME }).map((_, i) => (
        <PairPill
          key={i}
          index={i}
          found={foundPerImage[i] ?? 0}
          active={i === currentImageIndex}
          disabled={navDisabled}
          onClick={() => goTo(i)}
        />
      ))}
    </div>
  );
}

function PairPill({
  index,
  found,
  active,
  disabled,
  onClick,
}: {
  index: number;
  found: number;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const complete = found >= DIFFS_PER_IMAGE;
  const baseBg = complete ? CSS.successBg : active ? CSS.primarySoft : CSS.surfaceMuted;
  const baseBorder = active ? CSS.primary : CSS.border;
  const fg = complete ? CSS.success : active ? CSS.primary : CSS.textSecondary;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Pair ${index + 1}, ${found} of ${DIFFS_PER_IMAGE} found${complete ? " (complete)" : ""}`}
      aria-current={active ? "step" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: RADIUS.pill,
        background: baseBg,
        border: `1px solid ${baseBorder}`,
        boxShadow: active ? "0 0 0 2px var(--primary-focus)" : "none",
        color: fg,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        font: "inherit",
        fontWeight: 600,
        fontSize: 13,
        transition: "background-color 80ms ease-out, box-shadow 80ms ease-out",
      }}
    >
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{index + 1}</span>
      <span style={{ display: "inline-flex", gap: 3 }} aria-hidden>
        {Array.from({ length: DIFFS_PER_IMAGE }).map((_, i) => (
          <span
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: i < found ? fg : "transparent",
              border: `1.5px solid ${fg}`,
              opacity: i < found ? 1 : 0.45,
            }}
          />
        ))}
      </span>
    </button>
  );
}

// ─── Middle row (prev/next arrows flanking the image pair) ─────────────────

function MiddleRow() {
  const currentImageIndex = useUIStore((s) => s.currentImageIndex);
  const hintActive = useUIStore((s) => s.hintActive);
  const imagePairWidth = useUIStore((s) => s.imagePairWidth);
  const navDisabled = hintActive;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        // Don't intercept clicks on the canvas behind us — only the arrow
        // buttons opt back in via pointer-events:auto.
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: ARROW_GAP,
          maxWidth: `calc(100vw - 2 * ${HUD_INSET})`,
        }}
      >
        <ArrowButton
          label="‹"
          keyHint="A"
          ariaLabel="Previous pair"
          disabled={navDisabled || currentImageIndex === 0}
          onClick={() => {
            if (!navDisabled) gameState.prevImage();
          }}
        />
        {/* Spacer matches the rendered image-pair width so the two arrows
            sit immediately outside the panels. Width is updated by GameScene
            on every layout pass; falls back to the unscaled max pre-mount. */}
        <div
          aria-hidden
          style={{
            width: imagePairWidth || 640,
            height: 1,
            flexShrink: 1,
            minWidth: 0,
          }}
        />
        <ArrowButton
          label="›"
          keyHint="D"
          ariaLabel="Next pair"
          disabled={navDisabled || currentImageIndex === IMAGES_PER_GAME - 1}
          onClick={() => {
            if (!navDisabled) gameState.nextImage();
          }}
        />
      </div>
    </div>
  );
}

function ArrowButton({
  label,
  keyHint,
  ariaLabel,
  disabled,
  onClick,
}: {
  label: string;
  keyHint: string;
  ariaLabel: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      style={{
        // Round button — bigger touch target than the old square Pixi nav,
        // floats over the canvas so it never crowds the image content.
        width: 48,
        height: 48,
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        background: disabled ? CSS.surfaceMuted : CSS.primary,
        color: disabled ? CSS.textSecondary : CSS.primaryOn,
        border: `1px solid ${disabled ? CSS.border : CSS.primary}`,
        borderRadius: "50%",
        cursor: disabled ? "not-allowed" : "pointer",
        font: "inherit",
        lineHeight: 1,
        opacity: disabled ? 0.5 : 1,
        boxShadow: disabled ? "none" : SHADOW.s2,
        pointerEvents: "auto",
      }}
    >
      <span style={{ fontSize: 24, fontWeight: 600, marginBottom: 2 }}>{label}</span>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5, opacity: 0.85 }}>
        {keyHint}
      </span>
    </button>
  );
}

// ─── Floating Hint (anchored to bottom edge of image pair) ─────────────────

function FloatingHint() {
  const imagePairBottom = useUIStore((s) => s.imagePairBottom);
  return (
    <div
      style={{
        position: "absolute",
        top: imagePairBottom + IMAGE_HUG_GAP,
        left: "50%",
        transform: "translateX(-50%)",
      }}
    >
      <HintButton />
    </div>
  );
}

// Daily-only Hint affordance. Floats just below the image pair so it lives
// directly in the player's eyeline — the original top-left placement was
// easy to miss entirely.
function HintButton() {
  const hintsUsed = useUIStore((s) => s.hintsUsed);
  const cooldownUntil = useUIStore((s) => s.hintCooldownUntilMs);
  const hintActive = useUIStore((s) => s.hintActive);
  const currentImageIndex = useUIStore((s) => s.currentImageIndex);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, cooldownUntil - now);
  const onCooldown = remainingMs > 0;
  const remainingSec = Math.ceil(remainingMs / 1000);
  const disabled = onCooldown || hintActive;

  const onClick = () => {
    if (disabled) return;
    game.getSocket()?.send({ kind: "hint", puzzleIdx: currentImageIndex });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        pointerEvents: "auto",
        background: disabled ? CSS.surfaceMuted : CSS.primary,
        color: disabled ? CSS.textSecondary : CSS.primaryOn,
        border: `1px solid ${disabled ? CSS.border : CSS.primary}`,
        borderRadius: RADIUS.pill,
        padding: "10px 18px",
        boxShadow: disabled ? "none" : SHADOW.s1,
        fontFamily: FONT_FAMILY,
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 1,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
      title={
        hintActive
          ? "Click the highlighted area to reveal it"
          : onCooldown
            ? `Available in ${remainingSec}s`
            : "Reveal one difference. Hint runs are excluded from the daily leaderboard."
      }
    >
      <span aria-hidden style={{ fontSize: 16 }}>
        💡
      </span>
      <span>{onCooldown ? `Hint (${remainingSec}s)` : "Hint"}</span>
      {hintsUsed > 0 && (
        <span
          style={{
            color: disabled ? CSS.textSecondary : CSS.primaryOn,
            opacity: 0.75,
            fontSize: 12,
            fontWeight: 400,
          }}
        >
          · used {hintsUsed}
        </span>
      )}
    </button>
  );
}
