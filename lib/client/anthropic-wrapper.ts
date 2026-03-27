/**
 * Anthropic SDK Wrapper with Auto-Monitoring
 *
 * Wraps the Anthropic SDK to automatically report token usage,
 * thinking steps, and agent status to your monitor dashboard.
 *
 * Usage:
 *   import Anthropic from "@anthropic-ai/sdk";
 *   import { createMonitoredClient } from "./anthropic-wrapper";
 *
 *   const anthropic = new Anthropic();
 *   const monitored = createMonitoredClient(anthropic, {
 *     monitorUrl: "https://monitor-system-one.vercel.app",
 *     agentId: "my-agent",
 *     agentName: "My Agent",
 *   });
 *
 *   // Use exactly like normal Anthropic SDK — monitoring happens automatically
 *   const response = await monitored.messages.create({
 *     model: "claude-sonnet-4-6-20250514",
 *     max_tokens: 1024,
 *     messages: [{ role: "user", content: "Hello" }],
 *   });
 */

import { MonitorClient } from "./monitor-client";

// Cost per token (approximate, USD) — update as pricing changes
const PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-4-6-20250610":   { input: 15 / 1e6, output: 75 / 1e6, cacheRead: 1.5 / 1e6, cacheWrite: 18.75 / 1e6 },
  "claude-sonnet-4-6-20250514": { input: 3 / 1e6,  output: 15 / 1e6, cacheRead: 0.3 / 1e6, cacheWrite: 3.75 / 1e6 },
  "claude-haiku-4-5-20251001":  { input: 0.8 / 1e6, output: 4 / 1e6, cacheRead: 0.08 / 1e6, cacheWrite: 1 / 1e6 },
};

function estimateCost(model: string, usage: { input: number; output: number; cacheRead?: number; cacheWrite?: number }): number {
  // Match partial model names
  const key = Object.keys(PRICING).find((k) => model.startsWith(k.split("-2025")[0])) || "";
  const rates = PRICING[key];
  if (!rates) return 0;

  return (
    usage.input * rates.input +
    usage.output * rates.output +
    (usage.cacheRead || 0) * rates.cacheRead +
    (usage.cacheWrite || 0) * rates.cacheWrite
  );
}

interface MonitorConfig {
  monitorUrl: string;
  agentId: string;
  agentName: string;
  apiKey?: string;
  reportThinking?: boolean;
  reportToolUse?: boolean;
}

interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  name?: string;
  input?: unknown;
  content?: unknown;
  id?: string;
}

interface AnthropicResponse {
  id: string;
  model: string;
  role: string;
  content: ContentBlock[];
  usage: AnthropicUsage;
  stop_reason: string;
}

interface AnthropicClient {
  messages: {
    create: (params: Record<string, unknown>) => Promise<AnthropicResponse>;
  };
}

export function createMonitoredClient(
  anthropic: AnthropicClient,
  config: MonitorConfig,
) {
  const monitor = new MonitorClient(config.monitorUrl, config.apiKey);
  const reportThinking = config.reportThinking !== false;
  const reportToolUse = config.reportToolUse !== false;

  // Register agent on first use
  let registered = false;

  async function ensureRegistered(model: string) {
    if (registered) return;
    registered = true;
    await monitor.registerAgent({
      id: config.agentId,
      name: config.agentName,
      model,
      provider: "anthropic",
    });
  }

  const originalCreate = anthropic.messages.create.bind(anthropic.messages);

  const monitoredCreate = async (params: Record<string, unknown>): Promise<AnthropicResponse> => {
    const model = params.model as string;
    await ensureRegistered(model);

    // Set status to thinking
    await monitor.setStatus(config.agentId, "thinking");
    const startTime = Date.now();

    try {
      const response = await originalCreate(params);
      const durationMs = Date.now() - startTime;

      // Extract usage
      const usage = response.usage;
      const inputTokens = usage.input_tokens || 0;
      const outputTokens = usage.output_tokens || 0;
      const cacheRead = usage.cache_read_input_tokens || 0;
      const cacheWrite = usage.cache_creation_input_tokens || 0;

      // Count thinking tokens from content blocks
      let thinkingTokens = 0;
      let thinkingContent = "";
      let responseText = "";
      const toolCalls: string[] = [];

      for (const block of response.content) {
        if (block.type === "thinking" && block.thinking) {
          thinkingContent += block.thinking;
          // Estimate thinking tokens (~4 chars per token)
          thinkingTokens += Math.round(block.thinking.length / 4);
        } else if (block.type === "text" && block.text) {
          responseText += block.text;
        } else if (block.type === "tool_use" && block.name) {
          toolCalls.push(`${block.name}(${JSON.stringify(block.input).slice(0, 200)})`);
        }
      }

      // Report token usage
      const cost = estimateCost(model, { input: inputTokens, output: outputTokens, cacheRead, cacheWrite });
      await monitor.trackTokens(
        config.agentId,
        { input: inputTokens, output: outputTokens, thinking: thinkingTokens, cacheRead, cacheWrite },
        cost,
      );

      // Report thinking flow
      if (reportThinking && thinkingContent) {
        await monitor.think(
          config.agentId,
          config.agentName,
          model,
          "thinking",
          thinkingContent.slice(0, 2000),
          { tokenCount: thinkingTokens, durationMs },
        );
      }

      if (responseText) {
        await monitor.think(
          config.agentId,
          config.agentName,
          model,
          "response",
          responseText.slice(0, 2000),
          { tokenCount: outputTokens, durationMs },
        );
      }

      if (reportToolUse && toolCalls.length > 0) {
        await monitor.think(
          config.agentId,
          config.agentName,
          model,
          "tool_call",
          toolCalls.join("\n"),
          { tokenCount: outputTokens },
        );
        await monitor.setStatus(config.agentId, "tool_use");
      } else {
        await monitor.setStatus(config.agentId, "idle");
      }

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await monitor.setStatus(config.agentId, "error");
      await monitor.think(
        config.agentId,
        config.agentName,
        model,
        "error",
        message,
      );
      throw err;
    }
  };

  // Return a proxy that looks like the original client
  return {
    ...anthropic,
    messages: {
      ...anthropic.messages,
      create: monitoredCreate,
    },
    // Expose monitor for manual operations
    monitor,
  };
}
