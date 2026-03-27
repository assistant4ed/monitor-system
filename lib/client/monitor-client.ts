/**
 * Monitor Client SDK
 *
 * Drop this file into ANY project to send data to your monitor dashboard.
 * Works in Node.js, Edge, Bun, Deno — anywhere fetch() exists.
 *
 * Usage:
 *   import { MonitorClient } from "./monitor-client";
 *   const monitor = new MonitorClient("https://monitor-system-one.vercel.app");
 *   await monitor.registerAgent({ id: "my-agent", name: "My Agent", model: "claude-opus-4-6" });
 *   await monitor.trackTokens("my-agent", { input: 1500, output: 300, thinking: 800 }, 0.012);
 *   await monitor.think("my-agent", "My Agent", "claude-opus-4-6", "thinking", "Analyzing the code...");
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

export class MonitorClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string, apiKey?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers["x-api-key"] = this.apiKey;

    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      return res.json();
    } catch (err) {
      console.error(`[Monitor] POST ${path} failed:`, err);
      return null;
    }
  }

  // ─── Agent lifecycle ────────────────────────────────

  async registerAgent(params: RegisterAgentParams) {
    return this.post("/api/monitor/agents", {
      action: "register",
      ...params,
      provider: params.provider || "anthropic",
      status: params.status || "idle",
    });
  }

  async setStatus(agentId: string, status: AgentStatus) {
    return this.post("/api/monitor/agents", {
      action: "status",
      agentId,
      status,
    });
  }

  async removeAgent(agentId: string) {
    return this.post("/api/monitor/agents", {
      action: "remove",
      agentId,
    });
  }

  // ─── Token tracking ────────────────────────────────

  async trackTokens(agentId: string, tokens: TokenDelta, costUsd: number = 0) {
    return this.post("/api/monitor/agents", {
      action: "tokens",
      agentId,
      tokens,
      cost: costUsd,
    });
  }

  // ─── Thinking flow ─────────────────────────────────

  async think(
    agentId: string,
    agentName: string,
    model: string,
    type: ThinkingType,
    content: string,
    opts?: { tokenCount?: number; durationMs?: number; metadata?: Record<string, unknown> },
  ) {
    return this.post("/api/monitor/thinking", {
      agentId,
      agentName,
      model,
      type,
      content,
      ...opts,
    });
  }

  // ─── Agent communication ───────────────────────────

  async comm(
    from: { id: string; name: string },
    to: { id: string; name: string },
    type: CommType,
    content: string,
    tokenCount?: number,
  ) {
    return this.post("/api/monitor/comms", {
      fromAgentId: from.id,
      fromAgentName: from.name,
      toAgentId: to.id,
      toAgentName: to.name,
      type,
      content,
      tokenCount,
    });
  }

  // ─── Custom metrics ────────────────────────────────

  async metric(name: string, value: number, opts?: { type?: string; unit?: string; tags?: Record<string, string> }) {
    return this.post("/api/monitor/ingest", {
      name,
      value,
      type: opts?.type || "gauge",
      unit: opts?.unit,
      tags: opts?.tags,
    });
  }

  // ─── Logging ───────────────────────────────────────

  async log(level: "debug" | "info" | "warn" | "error", message: string, service: string, meta?: Record<string, unknown>) {
    return this.post("/api/monitor/logs", { level, message, service, meta });
  }

  // ─── Alerts ────────────────────────────────────────

  async alert(severity: "critical" | "warning" | "info", title: string, message: string, source: string) {
    return this.post("/api/monitor/alerts", { severity, title, message, source });
  }
}
