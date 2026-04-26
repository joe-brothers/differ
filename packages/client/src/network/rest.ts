import type {
  AuthRes,
  CreateRoomReq,
  CreateRoomRes,
  LeaderboardRes,
  LoginReq,
  LoginTotpRequiredRes,
  MeRes,
  RecentGamesRes,
  TotpSetupRes,
  TotpStatusRes,
  UpgradeReq,
} from "@differ/shared";
import { API_BASE_URL } from "../constants";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOpts {
  method?: string;
  body?: unknown;
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    // The auth token is in an httpOnly cookie set by the server. `include`
    // makes the browser attach it on every request, including cross-origin
    // ones (with proper CORS). Same-origin same-domain just keeps the cookie.
    credentials: "include",
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "unknown", err?.message ?? res.statusText);
  }
  return json as T;
}

export type LoginResponse = AuthRes | LoginTotpRequiredRes;

export const authApi = {
  guest(turnstileToken?: string): Promise<AuthRes> {
    return request<AuthRes>("/auth/guest", { method: "POST", body: { turnstileToken } });
  },
  login(req: LoginReq, turnstileToken?: string): Promise<LoginResponse> {
    return request<LoginResponse>("/auth/login", {
      method: "POST",
      body: { ...req, turnstileToken },
    });
  },
  loginTotp(ticket: string, code: string): Promise<AuthRes> {
    return request<AuthRes>("/auth/login/totp", {
      method: "POST",
      body: { ticket, code },
    });
  },
  upgrade(req: UpgradeReq, turnstileToken?: string): Promise<AuthRes> {
    return request<AuthRes>("/auth/upgrade", {
      method: "POST",
      body: { ...req, turnstileToken },
    });
  },
  me(): Promise<MeRes> {
    return request<MeRes>("/auth/me");
  },
  recent(limit = 20): Promise<RecentGamesRes> {
    return request<RecentGamesRes>(`/auth/me/recent?limit=${limit}`);
  },
  logout(): Promise<{ ok: true }> {
    return request<{ ok: true }>("/auth/logout", { method: "POST" });
  },
  forgotPassword(payload: { username?: string; email?: string }): Promise<{ ok: true }> {
    return request<{ ok: true }>("/auth/forgot-password", {
      method: "POST",
      body: payload,
    });
  },
  totpStatus(): Promise<TotpStatusRes> {
    return request<TotpStatusRes>("/auth/totp/status");
  },
  totpSetup(): Promise<TotpSetupRes> {
    return request<TotpSetupRes>("/auth/totp/setup", { method: "POST" });
  },
  totpVerify(code: string): Promise<{ ok: true; enabled: boolean }> {
    return request<{ ok: true; enabled: boolean }>("/auth/totp/verify", {
      method: "POST",
      body: { code },
    });
  },
  totpDisable(password: string): Promise<{ ok: true; enabled: boolean }> {
    return request<{ ok: true; enabled: boolean }>("/auth/totp/disable", {
      method: "POST",
      body: { password },
    });
  },
  getEmail(): Promise<{ email: string | null }> {
    return request<{ email: string | null }>("/auth/email");
  },
  setEmail(email: string): Promise<{ ok: true; email: string; mocked: boolean }> {
    return request<{ ok: true; email: string; mocked: boolean }>("/auth/email", {
      method: "POST",
      body: { email },
    });
  },
};

export const roomApi = {
  create(req: CreateRoomReq): Promise<CreateRoomRes> {
    return request<CreateRoomRes>("/rooms", { method: "POST", body: req });
  },
  wsUrl(code: string): string {
    // API_BASE_URL is "" by default (same-origin via vite proxy or prod
    // co-deploy). Synthesize an absolute ws(s):// URL from window.location.
    if (API_BASE_URL) return `${API_BASE_URL.replace(/^http/, "ws")}/rooms/${code}/ws`;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    return `${proto}://${window.location.host}/rooms/${code}/ws`;
  },
};

export const leaderboardApi = {
  list(mode: "single" | "1v1", limit = 20, offset = 0): Promise<LeaderboardRes> {
    const qs = new URLSearchParams({
      mode,
      limit: String(limit),
      offset: String(offset),
    });
    return request<LeaderboardRes>(`/leaderboard?${qs.toString()}`);
  },
};
