import { Application, Container } from "pixi.js";
import type { IScene } from "../types";

type SceneCtor = new (app: Application) => IScene;

export class SceneManager {
  private app: Application;
  private currentScene: IScene | null = null;
  private currentSceneClass: SceneCtor | null = null;
  private sceneContainer: Container;

  constructor(app: Application) {
    this.app = app;
    this.sceneContainer = new Container();
    this.app.stage.addChild(this.sceneContainer);
  }

  async switchTo(SceneClass: SceneCtor): Promise<void> {
    // Destroy current scene
    if (this.currentScene) {
      this.currentScene.destroy();
      this.sceneContainer.removeChildren();
    }

    // Create and initialize new scene
    const newScene = new SceneClass(this.app);
    this.currentScene = newScene;
    this.currentSceneClass = SceneClass;

    if (newScene instanceof Container) {
      this.sceneContainer.addChild(newScene);
    }

    await newScene.init();
  }

  // Re-instantiate the current scene from scratch. Used for theme switches
  // on stateless menu/auth scenes — caller must guard against active gameplay.
  async refresh(): Promise<void> {
    if (!this.currentSceneClass) return;
    await this.switchTo(this.currentSceneClass);
  }

  getCurrentSceneClass(): SceneCtor | null {
    return this.currentSceneClass;
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
