import { EventEmitter } from "pixi.js";
import type { PublicUser } from "@differ/shared";
import { authApi } from "../network/rest";

// Auth tokens live in an httpOnly cookie set by the server. The client
// only tracks the public user object so the UI knows who is signed in.
export class AuthStateManager extends EventEmitter {
  private user: PublicUser | null = null;

  getUser(): PublicUser | null {
    return this.user;
  }

  isAuthenticated(): boolean {
    return this.user !== null;
  }

  // Called on app start. Asks the server who we are based on the cookie.
  async tryRestore(): Promise<boolean> {
    try {
      const { user } = await authApi.me();
      this.user = user;
      this.emit("authStateChanged");
      return true;
    } catch {
      return false;
    }
  }

  async createGuest(): Promise<void> {
    const res = await authApi.guest();
    this.user = res.user;
    this.emit("authStateChanged");
  }

  async login(username: string, password: string): Promise<void> {
    const res = await authApi.login({ username, password });
    this.user = res.user;
    this.emit("authStateChanged");
  }

  async upgrade(username: string, password: string): Promise<void> {
    const res = await authApi.upgrade({ username, password });
    this.user = res.user;
    this.emit("authStateChanged");
  }

  async logout(): Promise<void> {
    try {
      await authApi.logout();
    } catch {
      // Even if the network call fails, drop local state so the UI updates.
    }
    this.user = null;
    this.emit("authStateChanged");
  }
}

export const authState = new AuthStateManager();
