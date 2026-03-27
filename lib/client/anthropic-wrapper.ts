/**
 * Anthropic SDK Wrapper — Zero-overhead monitoring
 *
 * Wraps the Anthropic SDK. Monitoring is fire-and-forget:
 * - Your code gets the AI response instantly (zero latency added)
 * - All monitoring batched into 1 background HTTP call
 * - Thinking content truncated to 800 chars to save bandwidth
 *
 * Usage:
 *   import Anthropic from "@anthropic-ai/sdk";
 *   import { monitorAnthropicSDK } from "./anthropic-wrapper";
 *
 *   const client = monitorAnthropicSDK(new Anthropic(), {
 *     monitorUrl: "https://monitor-system-one.vercel.app",
 *     agentId: "my-agent",
 *     agentName: "My Agent",
 *   });
 *
 *   // Use normally — zero overhead
 *   const res = await client.messages.create({ model: "claude-sonnet-4-6-20250514", ... });
 */

import { MonitorClient } from "./monitor-client";

// ─── Pricing (USD per token) ─────────────────────────

const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-4-6":   { input: 15 / 1e6, output: 75 / 1e6, cacheRead: 1.5 / 1e6, cacheWrite: 18.75 / 1e6 },
  "claude-sonnet-4-6": { input: 3 / 1e6,  output: 15 / 1e6, cacheRead: 0.3 / 1e6, cacheWrite: 3.75 / 1e6 },
  "claude-haiku-4-5":  { input: 0.8 / 1e6, output: 4 / 1e6, cacheRead: 0.08 / 1e6, cacheWrite: 1 / 1e6 },
};

function estimateCost(model: string, inp: number, out: number, cr: number, cw: number): number {
  const key = Object.keys(PRICING).find((k) => model.includes(k)) || "";
  const r = PRICING[key];
  if (!r) return 0;
  return inp * r.input + out * r.output + cr * r.cacheRead + cw * r.cacheWrite;
}

// ─── Types (minimal, no SDK dependency needed) ───────

interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  input?: unknown;
}

interface AnthropicResponse {
  id: string;
  model: string;
  content: ContentBlock[];
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  stop_reason: string;
  [key: string]: unknown;
}

interface AnthropicClient {
  messages: {
    create: (params: Record<string, unknown>) => Promise<AnthropicResponse>;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// ─── Config ──────────────────────────────────────────

interface MonitorConfig {
  monitorUrl: string;
  agentId: string;
  agentName: string;
  apiKey?: string;
  /** Log thinking content to dashboard (default: true, truncated to 800 chars) */
  reportThinking?: boolean;
  /** Log tool calls to dashboard (default: true) */
  reportToolUse?: boolean;
  /** Max chars to send for thinking/response content (default: 800) */
  maxContentChars?: number;
}

// ─── Main function ───────────────────────────────────

export function monitorAnthropicSDK(anthropic: AnthropicClient, config: MonitorConfig) {
  const monitor = new MonitorClient(config.monitorUrl, { apiKey: config.apiKey });
  const reportThinking = config.reportThinking !== false;
  const reportToolUse = config.reportToolUse !== false;
  const maxChars = config.maxContentChars ?? 800;

  let registered = false;

  const originalCreate = anthropic.messages.create.bind(anthropic.messages);

  const monitoredCreate = async (params: Record<string, unknown>): Promise<AnthropicResponse> => {
    const model = params.model as string;

    // Register on first call (fire-and-forget)
    if (!registered) {
      registered = true;
      monitor.registerAgent({
        id: config.agentId,
        name: config.agentName,
        model,
        provider: "anthropic",
      });
    }

    // Mark thinking (batched, not sent yet)
    monitor.setStatus(config.agentId, "thinking");
    monitor.flush();

    const startTime = Date.now();

    try {
      // ── Call the actual API ──────────────────────
      const response = await originalCreate(params);
      // ── Response received — your code continues ──

      // Everything below is fire-and-forget background work
      const durationMs = Date.now() - startTime;
      const u = response.usage;
      const inp = u.input_tokens || 0;
      const out = u.output_tokens || 0;
      const cr = u.cache_read_input_tokens || 0;
      const cw = u.cache_creation_input_tokens || 0;

      // Parse content blocks
      let thinkingText = "";
      let responseText = "";
      const toolCalls: string[] = [];

      for (const block of response.content) {
        if (block.type === "thinking" && block.thinking) {
          thinkingText += block.thinking;
        } else if (block.type === "text" && block.text) {
          responseText += block.text;
        } else if (block.type === "tool_use" && block.name) {
          toolCalls.push(`${block.name}(${JSON.stringify(block.input).slice(0, 150)})`);
        }
      }

      const thinkingTokens = thinkingText ? Math.round(thinkingText.length / 4) : 0;
      const cost = estimateCost(model, inp, out, cr, cw);

      // Queue all monitoring ops (will batch into 1 HTTP call)
      monitor.trackTokens(config.agentId, { input: inp, output: out, thinking: thinkingTokens, cacheRead: cr, cacheWrite: cw }, cost);

      if (reportThinking && thinkingText) {
        monitor.think(config.agentId, config.agentName, model, "thinking", thinkingText.slice(0, maxChars), { tokenCount: thinkingTokens, durationMs });
      }

      if (responseText) {
        monitor.think(config.agentId, config.agentName, model, "response", responseText.slice(0, maxChars), { tokenCount: out, durationMs });
      }

      if (reportToolUse && toolCalls.length > 0) {
        monitor.think(config.agentId, config.agentName, model, "tool_call", toolCalls.join("\n").slice(0, maxChars));
        monitor.setStatus(config.agentId, "tool_use");
      } else {
        monitor.setStatus(config.agentId, "idle");
      }

      // Flush everything in one background HTTP call
      monitor.flush();

      return response;
    } catch (err) {
      monitor.setStatus(config.agentId, "error");
      monitor.think(config.agentId, config.agentName, model, "error", String(err).slice(0, 300));
      monitor.flush();
      throw err;
    }
  };

  return {
    ...anthropic,
    messages: {
      ...anthropic.messages,
      create: monitoredCreate,
    },
    monitor,
  };
}
