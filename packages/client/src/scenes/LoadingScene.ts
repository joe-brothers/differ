import { Application, Assets, Container, Sprite } from "pixi.js";
import type { IScene } from "../types";

const SPINNER_STEPS = 12;
const ROTATION_INTERVAL_MS = 1000 / SPINNER_STEPS; // ~83.33ms per step
const STEP_ANGLE = (Math.PI * 2) / SPINNER_STEPS; // 30 degrees in radians
const SPINNER_SCALE = 0.15;

export class LoadingScene extends Container implements IScene {
  private app: Application;
  private spinner: Sprite | null = null;
  private elapsedTime = 0;
  private currentStep = 0;

  constructor(app: Application) {
    super();
    this.app = app;
  }

  async init(): Promise<void> {
    const texture = await Assets.load("/assets/spinner.png");
    this.spinner = new Sprite(texture);
    this.spinner.anchor.set(0.5);
    this.spinner.scale.set(SPINNER_SCALE);
    this.spinner.position.set(
      this.app.screen.width / 2,
      this.app.screen.height / 2,
    );
    this.addChild(this.spinner);
  }

  update(deltaTime: number): void {
    if (!this.spinner) return;

    this.elapsedTime += deltaTime;

    // Check if it's time for the next step
    const newStep = Math.floor(this.elapsedTime / ROTATION_INTERVAL_MS);
    if (newStep !== this.currentStep) {
      this.currentStep = newStep;
      this.spinner.rotation = (this.currentStep % SPINNER_STEPS) * STEP_ANGLE;
    }
  }

  resize(width: number, height: number): void {
    if (this.spinner) {
      this.spinner.position.set(width / 2, height / 2);
    }
  }

  destroy(): void {
    this.removeAllListeners();
    super.destroy({ children: true });
  }
}
