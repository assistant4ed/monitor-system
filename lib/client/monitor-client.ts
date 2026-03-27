/**
 * Monitor Client SDK — Zero-overhead edition
 *
 * All calls are fire-and-forget by default. Your code never waits for
 * the monitor. One HTTP call per AI response via batching.
 *
 * Usage:
 *   import { MonitorClient } from "./monitor-client";
 *   const monitor = new MonitorClient("https://monitor-system-one.vercel.app");
 *   monitor.registerAgent({ id: "a1", name: "Agent", model: "claude-opus-4-6" });
 *   monitor.trackTokens("a1", { input: 1500, output: 300 }, 0.012);
 */

interface TokenDelta {
  input?: number;
  output?: number;
  thinking?: number;
  cacheRead?: number;
  cacheWrite?: number;
}

interface RegisterAgentParams {
  id: string;
  name: string;
  model: string;
  provider?: string;
  role?: string;
  parentId?: string;
  status?: string;
}

type AgentStatus = "idle" | "thinking" | "responding" | "tool_use" | "error" | "offline";
type ThinkingType = "thinking" | "response" | "tool_call" | "tool_result" | "error" | "system";
type CommType = "request" | "response" | "delegation" | "result" | "error";

interface BatchOp {
  op: string;
  data: Record<string, unknown>;
}

export class MonitorClient {
  private baseUrl: string;
  private apiKey?: string;
  private queue: BatchOp[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private flushIntervalMs: number;

  constructor(baseUrl: string, opts?: { apiKey?: string; flushIntervalMs?: number }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = opts?.apiKey;
    this.flushIntervalMs = opts?.flushIntervalMs ?? 100;
  }

  // ─── Core: fire-and-forget with auto-batching ──────

  private enqueue(op: string, data: Record<string, unknown>): void {
    this.queue.push({ op, data });
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flush(), this.flushIntervalMs);
    }
  }

  /** Send all queued ops in one HTTP call. Non-blocking. */
  flush(): void {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    this.flushTimer = null;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers["x-api-key"] = this.apiKey;

    // Fire and forget — no await, no .json() read
    fetch(`${this.baseUrl}/api/monitor/batch`, {
      method: "POST",
      headers,
      body: JSON.stringify(batch),
    }).catch(() => {});
  }

  /** Flush and wait (only use at shutdown or in tests). */
  async flushAsync(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0);
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers["x-api-key"] = this.apiKey;

    await fetch(`${this.baseUrl}/api/monitor/batch`, {
      method: "POST",
      headers,
      body: JSON.stringify(batch),
    }).catch(() => {});
  }

  // ─── Agent lifecycle (all fire-and-forget) ─────────

  registerAgent(params: RegisterAgentParams): void {
    this.enqueue("register", {
      ...params,
      provider: params.provider || "anthropic",
      status: params.status || "idle",
    });
  }

  setStatus(agentId: string, status: AgentStatus): void {
    this.enqueue("status", { agentId, status });
  }

  removeAgent(agentId: string): void {
    // This one goes direct since it's rare and needs to be reliable
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    fetch(`${this.baseUrl}/api/monitor/agents`, {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "remove", agentId }),
    }).catch(() => {});
  }

  // ─── Token tracking ────────────────────────────────

  trackTokens(agentId: string, tokens: TokenDelta, costUsd: number = 0): void {
    this.enqueue("tokens", { agentId, tokens, cost: costUsd });
  }

  // ─── Thinking flow ─────────────────────────────────

  think(
    agentId: string,
    agentName: string,
    model: string,
    type: ThinkingType,
    content: string,
    opts?: { tokenCount?: number; durationMs?: number },
  ): void {
    this.enqueue("thinking", {
      agentId,
      agentName,
      model,
      type,
      content: content.slice(0, 800),
      ...opts,
    });
  }

  // ─── Agent communication ───────────────────────────

  comm(
    from: { id: string; name: string },
    to: { id: string; name: string },
    type: CommType,
    content: string,
    tokenCount?: number,
  ): void {
    this.enqueue("comm", {
      fromAgentId: from.id,
      fromAgentName: from.name,
      toAgentId: to.id,
      toAgentName: to.name,
      type,
      content: content.slice(0, 500),
      tokenCount,
    });
  }

  // ─── Convenience: send immediately (for one-offs) ──

  async sendNow(op: string, data: Record<string, unknown>): Promise<void> {
    this.enqueue(op, data);
    await this.flushAsync();
  }
}
