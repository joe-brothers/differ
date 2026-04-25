import { EventEmitter } from "pixi.js";
import type { PublicUser } from "@differ/shared";
import { authApi } from "../network/rest";

// Auth tokens live in an httpOnly cookie set by the server. The client
// only tracks the public user object so the UI knows who is signed in.
export class AuthStateManager extends EventEmitter {
  private user: PublicUser | null = null;
  private wins = 0;

  getUser(): PublicUser | null {
    return this.user;
  }

  getWins(): number {
    return this.wins;
  }

  isAuthenticated(): boolean {
    return this.user !== null;
  }

  // Called on app start. Asks the server who we are based on the cookie.
  async tryRestore(): Promise<boolean> {
    try {
      const { user, wins } = await authApi.me();
      this.user = user;
      this.wins = wins;
      this.emit("authStateChanged");
      return true;
    } catch {
      return false;
    }
  }

  // Re-fetches /auth/me. Used when returning to the menu after a game so
  // the wins counter reflects the latest result without a full reload.
  async refresh(): Promise<void> {
    if (!this.user) return;
    try {
      const { user, wins } = await authApi.me();
      this.user = user;
      this.wins = wins;
      this.emit("authStateChanged");
    } catch {
      // Network blip — keep cached values rather than logging out.
    }
  }

  async createGuest(): Promise<void> {
    const res = await authApi.guest();
    this.user = res.user;
    this.emit("authStateChanged");
  }

  // Login returns either the authenticated user (cookie set), or a TOTP
  // challenge ticket. The caller drives the second-factor UI based on the
  // tagged response.
  async login(
    username: string,
    password: string,
  ): Promise<{ kind: "ok"; user: PublicUser } | { kind: "totp"; ticket: string }> {
    const res = await authApi.login({ username, password });
    if ("totpRequired" in res) {
      return { kind: "totp", ticket: res.ticket };
    }
    this.user = res.user;
    this.emit("authStateChanged");
    return { kind: "ok", user: res.user };
  }

  async completeTotpLogin(ticket: string, code: string): Promise<void> {
    const res = await authApi.loginTotp(ticket, code);
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
    this.wins = 0;
    this.emit("authStateChanged");
  }
}

export const authState = new AuthStateManager();
