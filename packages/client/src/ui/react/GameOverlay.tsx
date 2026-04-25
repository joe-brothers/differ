import { GameHud } from "./GameHud";
import { PauseModal } from "./PauseModal";
import { GameCompleteModal } from "./GameCompleteModal";

// Root of the React-driven UI layer. Rendered into #react-root, absolutely
// positioned above the Pixi canvas. Only the children that match the current
// store state will mount — this component itself is always present.
export function GameOverlay() {
  return (
    <>
      <GameHud />
      <PauseModal />
      <GameCompleteModal />
    </>
  );
}
