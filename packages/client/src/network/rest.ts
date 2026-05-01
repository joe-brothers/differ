import type {
  AuthRes,
  CreateRoomReq,
  CreateRoomRes,
  DailySummaryRes,
  EmailStatusRes,
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
  forgotPassword(email: string): Promise<{ ok: true }> {
    return request<{ ok: true }>("/auth/forgot-password", {
      method: "POST",
      body: { email },
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
  getEmail(): Promise<EmailStatusRes> {
    return request<EmailStatusRes>("/auth/email");
  },
  setEmail(email: string): Promise<{ ok: true; email: string; verified: false }> {
    return request<{ ok: true; email: string; verified: false }>("/auth/email", {
      method: "POST",
      body: { email },
    });
  },
  resendVerification(): Promise<{ ok: true; verified?: boolean }> {
    return request<{ ok: true; verified?: boolean }>("/auth/email/resend", { method: "POST" });
  },
  verifyEmail(token: string): Promise<{ ok: true; verified: true }> {
    return request<{ ok: true; verified: true }>("/auth/email/verify", {
      method: "POST",
      body: { token },
    });
  },
  resetPassword(token: string, password: string): Promise<{ ok: true }> {
    return request<{ ok: true }>("/auth/reset-password", {
      method: "POST",
      body: { token, password },
    });
  },
};

function wsBase(): string {
  if (API_BASE_URL) return API_BASE_URL.replace(/^http/, "ws");
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}`;
}

export const roomApi = {
  create(req: CreateRoomReq): Promise<CreateRoomRes> {
    return request<CreateRoomRes>("/rooms", { method: "POST", body: req });
  },
  wsUrl(code: string): string {
    // API_BASE_URL is "" by default (same-origin via vite proxy or prod
    // co-deploy). Synthesize an absolute ws(s):// URL from window.location.
    return `${wsBase()}/rooms/${code}/ws`;
  },
};

export const matchmakingApi = {
  wsUrl(): string {
    return `${wsBase()}/matchmaking/ws`;
  },
};

export const leaderboardApi = {
  list(
    mode: "single" | "1v1" | "daily",
    opts: { date?: string; limit?: number; offset?: number } = {},
  ): Promise<LeaderboardRes> {
    const qs = new URLSearchParams({
      mode,
      limit: String(opts.limit ?? 20),
      offset: String(opts.offset ?? 0),
    });
    if (opts.date) qs.set("date", opts.date);
    return request<LeaderboardRes>(`/leaderboard?${qs.toString()}`);
  },
};

export interface DailyStartRes {
  roomCode: string;
  wsUrl: string;
  date: string;
}

export const dailyApi = {
  start(): Promise<DailyStartRes> {
    return request<DailyStartRes>("/daily/start", { method: "POST" });
  },
  summary(date: string): Promise<DailySummaryRes> {
    return request<DailySummaryRes>(`/daily/summary?date=${encodeURIComponent(date)}`);
  },
};
