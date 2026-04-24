import { Application, Container } from "pixi.js";
import type { IScene } from "../types";

export class SceneManager {
  private app: Application;
  private currentScene: IScene | null = null;
  private sceneContainer: Container;

  constructor(app: Application) {
    this.app = app;
    this.sceneContainer = new Container();
    this.app.stage.addChild(this.sceneContainer);
  }

  async switchTo(SceneClass: new (app: Application) => IScene): Promise<void> {
    // Destroy current scene
    if (this.currentScene) {
      this.currentScene.destroy();
      this.sceneContainer.removeChildren();
    }

    // Create and initialize new scene
    const newScene = new SceneClass(this.app);
    this.currentScene = newScene;

    if (newScene instanceof Container) {
      this.sceneContainer.addChild(newScene);
    }

    await newScene.init();
  }

  update(deltaTime: number): void {
    if (this.currentScene) {
      this.currentScene.update(deltaTime);
    }
  }

  resize(width: number, height: number): void {
    if (this.currentScene?.resize) {
      this.currentScene.resize(width, height);
    }
  }

  getCurrentScene(): IScene | null {
    return this.currentScene;
  }
}
