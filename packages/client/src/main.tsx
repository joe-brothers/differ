import { Application } from "pixi.js";
import { createRoot } from "react-dom/client";
import { Game, setGameInstance } from "./core/Game";
import { COLORS } from "./constants";
import { GameOverlay } from "./ui/react/GameOverlay";
import { themeManager } from "./managers/ThemeManager";

(async () => {
  // Resolve theme before Pixi init so the canvas paints with the right
  // background color from the very first frame.
  themeManager.init();

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

  // React/DOM follow CSS variables automatically. Pixi reads the numeric
  // COLORS palette at draw time, so menus/auth/lobby need a scene rebuild
  // to repaint. In-game scene rebuilds are skipped to preserve play state —
  // the bg flips immediately, the rest re-skins on the next scene swap.
  themeManager.subscribe(() => {
    app.renderer.background.color = COLORS.background;
    if (!gameInstance.isInGame()) {
      void gameInstance.refreshCurrentScene();
    }
  });

  await gameInstance.start();
})();
