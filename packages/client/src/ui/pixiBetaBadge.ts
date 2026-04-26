import { Container, Graphics, Text } from "pixi.js";
import { COLORS } from "../constants";

// Pill chip rendered next to the app title in AuthScene/MainMenuScene.
// The container's origin sits at the chip's vertical center / left edge,
// so callers can place it flush with the right edge of the title.
export function createBetaBadge(): Container {
  const container = new Container();

  const label = new Text({
    text: "beta",
    style: {
      fontFamily: "Arial, sans-serif",
      fontSize: 11,
      fontWeight: "600",
      fill: COLORS.primary,
      letterSpacing: 0.4,
    },
  });

  const paddingX = 8;
  const paddingY = 3;
  const width = label.width + paddingX * 2;
  const height = label.height + paddingY * 2;

  const bg = new Graphics();
  bg.roundRect(0, -height / 2, width, height, height / 2);
  bg.fill({ color: COLORS.primarySoft });
  bg.stroke({ color: COLORS.primary, width: 1 });

  label.anchor.set(0, 0.5);
  label.position.set(paddingX, 0);

  container.addChild(bg, label);
  return container;
}
