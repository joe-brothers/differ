import { useRef, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { useDebugStore, type DebugToggles } from "./store";

// Visible only when `import.meta.env.DEV` is true (gated by the caller in
// GameOverlay). The panel itself is purely cosmetic — the source of truth
// lives in `useDebugStore` so other code can read flags without going through
// React.

const PANEL_WIDTH = 180;
// Pixel threshold below which a header press is treated as a click (toggles
// collapse) rather than a drag. Keeps a clean tap from accidentally moving
// the panel a few pixels.
const DRAG_THRESHOLD = 4;

// Panel inverts the app theme (light app → dark panel, dark app → light)
// so it always stands out from the canvas. Tokens live in style.css.
const panelStyle: CSSProperties = {
  position: "fixed",
  zIndex: 10000,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "SF Mono", Menlo, Consolas, "Courier New", monospace',
  fontSize: 12,
  color: "var(--debug-text)",
  background: "var(--debug-bg)",
  border: "1px solid var(--debug-border)",
  borderRadius: 6,
  boxShadow: "var(--debug-shadow)",
  width: PANEL_WIDTH,
  userSelect: "none",
  // #react-root sets pointer-events: none so canvas clicks pass through;
  // re-enable here so the checkbox + drag handle actually receive input.
  pointerEvents: "auto",
};

const headerStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "6px 10px",
  cursor: "grab",
  borderBottom: "1px solid var(--debug-border)",
  fontWeight: 600,
  letterSpacing: 0.5,
};

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  cursor: "pointer",
};

interface ToggleRow {
  key: keyof DebugToggles;
  label: string;
  hint?: string;
}

// Add new rows here.
const ROWS: ToggleRow[] = [
  { key: "showDiffs", label: "Show diffs", hint: "Overlay diff rects on the canvas" },
];

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

export function DebugConsole() {
  const state = useDebugStore();
  // Track whether the current header press has crossed the drag threshold.
  // A ref (not state) so the mousemove handler reads the live value without
  // capturing stale closure state.
  const draggingRef = useRef(false);

  const onHeaderMouseDown = (e: ReactMouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = state.x;
    const origY = state.y;
    draggingRef.current = false;

    const onMove = (ev: globalThis.MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!draggingRef.current && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
      draggingRef.current = true;
      // Clamp so the panel can't be parked entirely off-screen. We only need
      // a sliver visible to grab it back — header height ≈ 28px is enough.
      const maxX = window.innerWidth - 40;
      const maxY = window.innerHeight - 28;
      useDebugStore.getState().movePanel(clamp(origX + dx, 0, maxX), clamp(origY + dy, 0, maxY));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (draggingRef.current) {
        // Drag ended — commit the new position to localStorage.
        useDebugStore.getState().persist();
      } else {
        // Genuine click on the header — toggle collapse.
        useDebugStore.getState().toggle("collapsed");
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <div style={{ ...panelStyle, left: state.x, top: state.y }}>
      <div style={headerStyle} onMouseDown={onHeaderMouseDown}>
        <span>DEBUG</span>
        <span style={{ opacity: 0.6 }}>{state.collapsed ? "▸" : "▾"}</span>
      </div>
      {!state.collapsed && (
        <div>
          {ROWS.map((row) => (
            <label key={row.key} style={rowStyle} title={row.hint}>
              <input
                type="checkbox"
                checked={state[row.key]}
                onChange={() => state.toggle(row.key)}
                style={{ margin: 0 }}
              />
              <span>{row.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
