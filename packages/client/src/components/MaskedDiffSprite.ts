import { Container, Sprite, Graphics, Texture } from "pixi.js";
import type { SelectedDifference } from "../types";

export class MaskedDiffSprite extends Container {
  private sprite: Sprite;
  private maskGraphics: Graphics;
  private differences: SelectedDifference[] = [];

  constructor(texture: Texture) {
    super();

    // Create mask graphics (will be updated when differences are set)
    this.maskGraphics = new Graphics();
    this.addChild(this.maskGraphics);

    // Create the difference sprite
    this.sprite = new Sprite(texture);
    this.sprite.mask = this.maskGraphics;
    this.addChild(this.sprite);
  }

  setDifferences(differences: SelectedDifference[]): void {
    this.differences = differences;
    this.updateMask();
  }

  updateTexture(texture: Texture): void {
    this.sprite.texture = texture;
  }

  private updateMask(): void {
    this.maskGraphics.clear();

    // Draw all selected diff areas as filled rectangles for the mask
    for (const diff of this.differences) {
      this.maskGraphics.rect(
        diff.rect.start_point.x,
        diff.rect.start_point.y,
        diff.rect.width,
        diff.rect.height,
      );
    }
    this.maskGraphics.fill(0xffffff);
  }

  setTint(tint: number): void {
    this.sprite.tint = tint;
  }
}
