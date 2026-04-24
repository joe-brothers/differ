import type {
  AuthRes,
  CreateRoomReq,
  CreateRoomRes,
  LeaderboardRes,
  LoginReq,
  PublicUser,
  UpgradeReq,
} from "@differ/shared";
import { API_BASE_URL } from "../constants";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOpts {
  method?: string;
  body?: unknown;
  token?: string | null;
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "unknown",
      err?.message ?? res.statusText,
    );
  }
  return json as T;
}

export const authApi = {
  guest(): Promise<AuthRes> {
    return request<AuthRes>("/auth/guest", { method: "POST" });
  },
  login(req: LoginReq): Promise<AuthRes> {
    return request<AuthRes>("/auth/login", { method: "POST", body: req });
  },
  upgrade(req: UpgradeReq, token: string): Promise<AuthRes> {
    return request<AuthRes>("/auth/upgrade", { method: "POST", body: req, token });
  },
  me(token: string): Promise<{ user: PublicUser }> {
    return request<{ user: PublicUser }>("/auth/me", { token });
  },
};

export const roomApi = {
  create(req: CreateRoomReq, token: string): Promise<CreateRoomRes> {
    return request<CreateRoomRes>("/rooms", { method: "POST", body: req, token });
  },
  wsUrl(code: string): string {
    const base = API_BASE_URL.replace(/^http/, "ws");
    return `${base}/rooms/${code}/ws`;
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
