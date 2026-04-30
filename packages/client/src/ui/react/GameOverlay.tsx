import { GameHud } from "./GameHud";
import { PauseModal } from "./PauseModal";
import { GameCompleteModal } from "./GameCompleteModal";
import { DebugConsole } from "../../debug/DebugConsole";

// Root of the React-driven UI layer. Rendered into #react-root, absolutely
// positioned above the Pixi canvas. Only the children that match the current
// store state will mount — this component itself is always present.
export function GameOverlay() {
  return (
    <>
      <GameHud />
      <PauseModal />
      <GameCompleteModal />
      {/* Vite replaces import.meta.env.DEV with a literal boolean, so the
          debug bundle (and its localStorage access) is dropped from prod. */}
      {import.meta.env.DEV && <DebugConsole />}
    </>
  );
}
