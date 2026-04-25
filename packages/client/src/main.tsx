import { Application } from "pixi.js";
import { createRoot } from "react-dom/client";
import { Game, setGameInstance } from "./core/Game";
import { COLORS } from "./constants";
import { GameOverlay } from "./ui/react/GameOverlay";

(async () => {
  const app = new Application();

  await app.init({
    background: COLORS.background,
    resizeTo: window,
    antialias: true,
    // Render at the device pixel ratio so Text rasterizes at native density
    // (otherwise small labels look blurry on retina displays).
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
  });

  document.getElementById("pixi-container")!.appendChild(app.canvas);

  const reactRoot = document.getElementById("react-root");
  if (reactRoot) {
    createRoot(reactRoot).render(<GameOverlay />);
  }

  const gameInstance = new Game(app);
  setGameInstance(gameInstance);

  await gameInstance.start();
})();
