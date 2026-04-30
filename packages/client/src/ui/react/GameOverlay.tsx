import { GameHud } from "./GameHud";
import { PauseModal } from "./PauseModal";
import { GameCompleteModal } from "./GameCompleteModal";
import { ThemeToggle } from "./ThemeToggle";
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
      <ThemeToggle />
      {/* Vite replaces import.meta.env.DEV with a literal boolean, so the
          debug bundle (and its localStorage access) is dropped from prod. */}
      {import.meta.env.DEV && <DebugConsole />}
    </>
  );
}
