import { Container, Text } from "pixi.js";
import { COLORS, TOTAL_DIFFS_PER_GAME, IMAGES_PER_GAME } from "../constants";

export class ProgressDisplay extends Container {
  private foundText: Text;
  private imageIndexText: Text;

  constructor() {
    super();

    // Found count display (e.g., "0/25")
    this.foundText = new Text({
      text: `0/${TOTAL_DIFFS_PER_GAME}`,
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 24,
        fontWeight: "bold",
        fill: COLORS.text,
      },
    });

    // Image index display (e.g., "Image 1/5")
    this.imageIndexText = new Text({
      text: `Image 1/${IMAGES_PER_GAME}`,
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 20,
        fill: COLORS.textSecondary,
      },
    });

    // Position texts
    this.imageIndexText.position.set(0, 30);

    this.addChild(this.foundText, this.imageIndexText);
  }

  updateFoundCount(found: number): void {
    this.foundText.text = `${found}/${TOTAL_DIFFS_PER_GAME}`;
  }

  updateImageIndex(current: number): void {
    this.imageIndexText.text = `Image ${current + 1}/${IMAGES_PER_GAME}`;
  }
}
