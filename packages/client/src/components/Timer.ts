import { Container, Text } from "pixi.js";
import { COLORS } from "../constants";

export class Timer extends Container {
  private text: Text;
  private elapsedMs: number = 0;
  private running: boolean = false;

  constructor() {
    super();

    this.text = new Text({
      text: "00:00",
      style: {
        fontFamily: "Arial, sans-serif",
        fontSize: 28,
        fontWeight: "bold",
        fill: COLORS.text,
      },
    });
    this.addChild(this.text);
  }

  start(): void {
    this.running = true;
  }

  pause(): void {
    this.running = false;
  }

  reset(): void {
    this.elapsedMs = 0;
    this.running = false;
    this.updateDisplay();
  }

  update(deltaMs: number): void {
    if (this.running) {
      this.elapsedMs += deltaMs;
      this.updateDisplay();
    }
  }

  setTime(seconds: number): void {
    this.elapsedMs = seconds * 1000;
    this.updateDisplay();
  }

  private updateDisplay(): void {
    const totalSeconds = Math.floor(this.elapsedMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    this.text.text = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  getElapsedSeconds(): number {
    return this.elapsedMs / 1000;
  }
}
