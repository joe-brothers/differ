import { Text } from "pixi.js";
import { COLORS } from "../constants";

// GitHub repo link rendered at the bottom-center of AuthScene/MainMenuScene.
// Anchor is (0.5, 1) so callers can place it at (width / 2, height - 16).
export function createGithubFooter(): Text {
  const sha = __GIT_SHA__;
  const label = sha ? `github.com/joe-brothers/differ (${sha})` : "github.com/joe-brothers/differ";
  const text = new Text({
    text: label,
    style: {
      fontFamily: "Arial, sans-serif",
      fontSize: 12,
      fill: COLORS.textSecondary,
    },
  });
  text.anchor.set(0.5, 1);
  text.eventMode = "static";
  text.cursor = "pointer";
  text.on("pointerover", () => {
    text.style.fill = COLORS.text;
  });
  text.on("pointerout", () => {
    text.style.fill = COLORS.textSecondary;
  });
  text.on("pointerdown", () => {
    window.open("https://github.com/joe-brothers/differ", "_blank", "noopener,noreferrer");
  });
  return text;
}
