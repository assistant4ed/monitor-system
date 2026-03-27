/**
 * OpenAI SDK Wrapper with Auto-Monitoring
 *
 * Usage:
 *   import OpenAI from "openai";
 *   import { createMonitoredOpenAI } from "./openai-wrapper";
 *
 *   const openai = new OpenAI();
 *   const monitored = createMonitoredOpenAI(openai, {
 *     monitorUrl: "https://monitor-system-one.vercel.app",
 *     agentId: "gpt-agent",
 *     agentName: "GPT Agent",
 *   });
 *
 *   const response = await monitored.chat.completions.create({
 *     model: "gpt-4o",
 *     messages: [{ role: "user", content: "Hello" }],
 *   });
 */

import { MonitorClient } from "./monitor-client";

const PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o":         { input: 2.5 / 1e6, output: 10 / 1e6 },
  "gpt-4o-mini":    { input: 0.15 / 1e6, output: 0.6 / 1e6 },
  "gpt-4-turbo":    { input: 10 / 1e6, output: 30 / 1e6 },
  "gpt-3.5-turbo":  { input: 0.5 / 1e6, output: 1.5 / 1e6 },
  "o1":             { input: 15 / 1e6, output: 60 / 1e6 },
  "o1-mini":        { input: 3 / 1e6, output: 12 / 1e6 },
};

function estimateCost(model: string, input: number, output: number): number {
  const key = Object.keys(PRICING).find((k) => model.startsWith(k)) || "";
  const rates = PRICING[key];
  if (!rates) return 0;
  return input * rates.input + output * rates.output;
}

interface MonitorConfig {
  monitorUrl: string;
  agentId: string;
  agentName: string;
  apiKey?: string;
}

interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
}

interface OpenAIChoice {
  message: {
    role: string;
    content: string | null;
    tool_calls?: Array<{ function: { name: string; arguments: string } }>;
  };
  finish_reason: string;
}

interface OpenAIResponse {
  id: string;
  model: string;
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

interface OpenAIClient {
  chat: {
    completions: {
      create: (params: Record<string, unknown>) => Promise<OpenAIResponse>;
    };
  };
}

export function createMonitoredOpenAI(openai: OpenAIClient, config: MonitorConfig) {
  const monitor = new MonitorClient(config.monitorUrl, { apiKey: config.apiKey });
  let registered = false;

  const originalCreate = openai.chat.completions.create.bind(openai.chat.completions);

  const monitoredCreate = async (params: Record<string, unknown>): Promise<OpenAIResponse> => {
    const model = params.model as string;

    if (!registered) {
      registered = true;
      monitor.registerAgent({ id: config.agentId, name: config.agentName, model, provider: "openai" });
    }

    monitor.setStatus(config.agentId, "thinking");
    monitor.flush();

    const startTime = Date.now();

    try {
      const response = await originalCreate(params);
      const durationMs = Date.now() - startTime;
      const usage = response.usage;

      const inp = usage.prompt_tokens || 0;
      const out = usage.completion_tokens || 0;
      const think = usage.completion_tokens_details?.reasoning_tokens || 0;
      const cost = estimateCost(model, inp, out);

      monitor.trackTokens(config.agentId, { input: inp, output: out, thinking: think }, cost);

      const choice = response.choices[0];
      if (choice?.message?.content) {
        monitor.think(config.agentId, config.agentName, model, "response", choice.message.content.slice(0, 800), { tokenCount: out, durationMs });
      }

      if (choice?.message?.tool_calls?.length) {
        const calls = choice.message.tool_calls.map((tc) => `${tc.function.name}(${tc.function.arguments.slice(0, 150)})`).join("\n");
        monitor.think(config.agentId, config.agentName, model, "tool_call", calls.slice(0, 800));
        monitor.setStatus(config.agentId, "tool_use");
      } else {
        monitor.setStatus(config.agentId, "idle");
      }

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
    ...openai,
    chat: {
      ...openai.chat,
      completions: {
        ...openai.chat.completions,
        create: monitoredCreate,
      },
    },
    monitor,
  };
}
