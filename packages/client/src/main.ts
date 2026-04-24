import { Application } from "pixi.js";
import { Game, setGameInstance } from "./core/Game";
import { COLORS } from "./constants";

(async () => {
  // Create a new application
  const app = new Application();

  // Initialize the application
  await app.init({
    background: COLORS.background,
    resizeTo: window,
    antialias: true,
  });

  // Append the application canvas to the document body
  document.getElementById("pixi-container")!.appendChild(app.canvas);

  // Create and start the game
  const gameInstance = new Game(app);
  setGameInstance(gameInstance);

  await gameInstance.start();
})();
