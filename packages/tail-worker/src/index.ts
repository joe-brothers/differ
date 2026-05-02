interface Env {
  DISCORD_WEBHOOK_URL: string;
  ENV_LABEL: string;
}

// Discord limits: content 2000, embed description 4096, 10 embeds per message.
const DISCORD_DESC_LIMIT = 4000;
const STACK_LIMIT = 1500;

function summarizeEvent(event: TraceItem["event"]): string {
  if (!event) return "unknown";
  if ("request" in event && event.request) {
    const req = event.request as { method?: string; url?: string };
    return `${req.method ?? "GET"} ${req.url ?? ""}`;
  }
  if ("cron" in event) return `cron ${(event as { cron: string }).cron}`;
  if ("scheduledTime" in event) return "scheduled";
  if ("queue" in event) return `queue ${(event as { queue: string }).queue}`;
  return "event";
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function buildEmbed(item: TraceItem, envLabel: string) {
  const exceptions = item.exceptions ?? [];
  const errorLogs = (item.logs ?? []).filter((l) => l.level === "error");

  const lines: string[] = [];
  lines.push(`**Outcome:** \`${item.outcome}\``);
  lines.push(`**Event:** ${summarizeEvent(item.event)}`);
  if (item.scriptName) lines.push(`**Script:** \`${item.scriptName}\``);

  if (exceptions.length > 0) {
    lines.push("", "**Exceptions:**");
    for (const ex of exceptions) {
      const stack = ex.stack ? `\n\`\`\`\n${truncate(ex.stack, STACK_LIMIT)}\n\`\`\`` : "";
      lines.push(`• \`${ex.name}\`: ${ex.message}${stack}`);
    }
  }

  if (errorLogs.length > 0) {
    lines.push("", "**Error logs:**");
    for (const log of errorLogs) {
      const parts = (log.message as unknown[]) ?? [];
      const msg = parts.map((m) => (typeof m === "string" ? m : safeStringify(m))).join(" ");
      lines.push(`• ${truncate(msg, 500)}`);
    }
  }

  return {
    title: `[${envLabel}] Worker error`,
    description: truncate(lines.join("\n"), DISCORD_DESC_LIMIT),
    color: 0xff5555,
    timestamp: new Date(item.eventTimestamp ?? Date.now()).toISOString(),
  };
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// When the parent Worker proxies a WebSocket upgrade via `stub.fetch()` to a
// Durable Object, the parent invocation stays open for the WS lifetime and
// Cloudflare records its outcome as `canceled` once the socket closes — even
// on a clean 1000 close. The DO-side traces (acceptWebSocket fetch +
// hibernation callbacks) all remain `ok`, so these parent canceled traces are
// pure noise. Filter them out here, but keep any with real exceptions or
// error logs.
function isWsProxyNoise(item: TraceItem): boolean {
  if (item.outcome !== "canceled") return false;
  if (item.executionModel !== "stateless") return false;
  if ((item.exceptions ?? []).length > 0) return false;
  if ((item.logs ?? []).some((l) => l.level === "error")) return false;
  const event = item.event;
  if (!event || !("request" in event) || !event.request) return false;
  const url = (event.request as { url?: string }).url;
  if (!url) return false;
  try {
    return new URL(url).pathname.endsWith("/ws");
  } catch {
    return false;
  }
}

function isErrorTrace(item: TraceItem): boolean {
  if (isWsProxyNoise(item)) return false;
  if (item.outcome !== "ok") return true;
  if ((item.exceptions ?? []).length > 0) return true;
  if ((item.logs ?? []).some((l) => l.level === "error")) return true;
  return false;
}

async function postToDiscord(env: Env, embeds: ReturnType<typeof buildEmbed>[]) {
  // Discord caps at 10 embeds per request.
  for (let i = 0; i < embeds.length; i += 10) {
    const batch = embeds.slice(i, i + 10);
    const res = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: batch }),
    });
    if (!res.ok) {
      // Log but don't throw — failing here would just retry the whole trace
      // and amplify the problem during a Discord outage.
      console.error(`Discord webhook ${res.status}: ${await res.text()}`);
    }
  }
}

export default {
  async tail(events: TraceItem[], env: Env, ctx: ExecutionContext) {
    const errors = events.filter(isErrorTrace);
    if (errors.length === 0) return;
    const embeds = errors.map((e) => buildEmbed(e, env.ENV_LABEL));
    ctx.waitUntil(postToDiscord(env, embeds));
  },
} satisfies ExportedHandler<Env>;
