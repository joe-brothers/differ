import { EventEmitter } from "pixi.js";
import type { PublicUser } from "@differ/shared";
import { authApi, ApiError } from "../network/rest";

const TOKEN_KEY = "differ_auth_token";

export class AuthStateManager extends EventEmitter {
  private user: PublicUser | null = null;
  private token: string | null = null;

  getUser(): PublicUser | null {
    return this.user;
  }

  getToken(): string | null {
    return this.token;
  }

  isAuthenticated(): boolean {
    return this.user !== null && this.token !== null;
  }

  // Called on app start. Restores an existing session if the stored token
  // still validates. Never auto-creates a guest — the caller decides how to
  // handle the unauthenticated case (typically: show AuthScene).
  async tryRestore(): Promise<boolean> {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return false;
    try {
      const { user } = await authApi.me(stored);
      this.token = stored;
      this.user = user;
      this.emit("authStateChanged");
      return true;
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      return false;
    }
  }

  async createGuest(): Promise<void> {
    const res = await authApi.guest();
    this.token = res.token;
    this.user = res.user;
    localStorage.setItem(TOKEN_KEY, res.token);
    this.emit("authStateChanged");
  }

  async login(username: string, password: string): Promise<void> {
    const res = await authApi.login({ username, password });
    this.token = res.token;
    this.user = res.user;
    localStorage.setItem(TOKEN_KEY, res.token);
    this.emit("authStateChanged");
  }

  async upgrade(username: string, password: string): Promise<void> {
    if (!this.token) throw new ApiError(401, "unauthenticated", "Not signed in");
    const res = await authApi.upgrade({ username, password }, this.token);
    this.token = res.token;
    this.user = res.user;
    localStorage.setItem(TOKEN_KEY, res.token);
    this.emit("authStateChanged");
  }

  logout(): void {
    this.token = null;
    this.user = null;
    localStorage.removeItem(TOKEN_KEY);
    this.emit("authStateChanged");
  }
}

export const authState = new AuthStateManager();
