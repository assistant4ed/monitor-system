/**
 * Example: Anthropic SDK with auto-monitoring
 *
 * Install: npm install @anthropic-ai/sdk
 * Run:     ANTHROPIC_API_KEY=sk-... npx tsx examples/2-anthropic-sdk.ts
 */

import Anthropic from "@anthropic-ai/sdk";

import { createMonitoredClient } from "../lib/client/anthropic-wrapper";

const MONITOR_URL = "https://monitor-system-one.vercel.app";

async function main() {
  // Create normal Anthropic client
  const anthropic = new Anthropic();

  // Wrap it with monitoring — that's it!
  const client = createMonitoredClient(anthropic, {
    monitorUrl: MONITOR_URL,
    agentId: "demo-agent",
    agentName: "Demo Agent",
  });

  // Use exactly like normal SDK — tokens, thinking, status auto-reported
  const response = await client.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 1024,
    messages: [
      { role: "user", content: "Explain Redis pub/sub in 2 sentences." },
    ],
  });

  console.log("Response:", response.content);
  console.log("Tokens:", response.usage);

  // Extended thinking also auto-captured
  const thinkingResponse = await client.messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 8000,
    thinking: { type: "enabled", budget_tokens: 5000 },
    messages: [
      { role: "user", content: "What are the tradeoffs of Redis vs Memcached?" },
    ],
  });

  console.log("Thinking response:", thinkingResponse.content);

  // Manual operations via exposed monitor client
  await client.monitor.log("info", "Demo completed", "demo-agent");
  await client.monitor.metric("demo.requests", 2, { unit: "count" });
}

main().catch(console.error);
