/**
 * Example: Multi-agent system with inter-agent communication tracking
 *
 * Shows how to monitor an orchestrator + sub-agent setup
 * where agents delegate work and report results.
 */

import { MonitorClient } from "../lib/client/monitor-client";

const monitor = new MonitorClient("https://monitor-system-one.vercel.app");

// Define your agents
const ORCHESTRATOR = { id: "orch-1", name: "Orchestrator" };
const RESEARCHER  = { id: "research-1", name: "Researcher" };
const CODER       = { id: "coder-1", name: "Coder" };

async function main() {
  // Register all agents
  await monitor.registerAgent({ ...ORCHESTRATOR, model: "claude-opus-4-6", role: "Task coordination" });
  await monitor.registerAgent({ ...RESEARCHER, model: "claude-sonnet-4-6", role: "Research & analysis", parentId: ORCHESTRATOR.id });
  await monitor.registerAgent({ ...CODER, model: "claude-sonnet-4-6", role: "Code implementation", parentId: ORCHESTRATOR.id });

  // Orchestrator starts thinking
  await monitor.setStatus(ORCHESTRATOR.id, "thinking");
  await monitor.think(ORCHESTRATOR.id, ORCHESTRATOR.name, "claude-opus-4-6", "thinking",
    "User wants a Redis caching layer. I need to:\n1. Research best patterns\n2. Delegate implementation\nLet me assign the researcher first.",
    { tokenCount: 150, durationMs: 800 },
  );

  // Orchestrator delegates to researcher
  await monitor.comm(ORCHESTRATOR, RESEARCHER, "delegation",
    "Research Redis caching patterns for a Next.js API. Focus on cache invalidation strategies.",
    120,
  );

  // Researcher works
  await monitor.setStatus(RESEARCHER.id, "thinking");
  await monitor.trackTokens(RESEARCHER.id, { input: 3000, output: 1500, thinking: 2000 }, 0.012);
  await monitor.think(RESEARCHER.id, RESEARCHER.name, "claude-sonnet-4-6", "thinking",
    "Looking at Redis caching patterns:\n- Cache-aside (lazy loading)\n- Write-through\n- Write-behind\nFor Next.js API routes, cache-aside with TTL is most practical.",
    { tokenCount: 2000, durationMs: 3200 },
  );

  // Researcher reports back
  await monitor.setStatus(RESEARCHER.id, "idle");
  await monitor.comm(RESEARCHER, ORCHESTRATOR, "result",
    "Recommend cache-aside pattern with 60s TTL. Use Redis SETEX for automatic expiry. Invalidate on write operations.",
    95,
  );

  // Orchestrator delegates to coder
  await monitor.trackTokens(ORCHESTRATOR.id, { input: 500, output: 200, thinking: 300 }, 0.008);
  await monitor.comm(ORCHESTRATOR, CODER, "delegation",
    "Implement Redis cache-aside in lib/cache.ts. Use SETEX with 60s TTL. Add cache invalidation helper.",
    200,
  );

  // Coder implements
  await monitor.setStatus(CODER.id, "thinking");
  await monitor.think(CODER.id, CODER.name, "claude-sonnet-4-6", "thinking",
    "I'll create a cache wrapper with get/set/invalidate methods using ioredis.",
    { tokenCount: 800, durationMs: 1200 },
  );

  await monitor.setStatus(CODER.id, "tool_use");
  await monitor.think(CODER.id, CODER.name, "claude-sonnet-4-6", "tool_call",
    'Write("lib/cache.ts", content="import Redis from ioredis...")',
    { tokenCount: 500 },
  );

  await monitor.trackTokens(CODER.id, { input: 4000, output: 6000, thinking: 800 }, 0.025);
  await monitor.setStatus(CODER.id, "idle");

  // Coder reports back
  await monitor.comm(CODER, ORCHESTRATOR, "response",
    "Created lib/cache.ts with cacheGet(), cacheSet(), cacheInvalidate(). All methods have TTL support and error handling.",
    150,
  );

  // Orchestrator wraps up
  await monitor.think(ORCHESTRATOR.id, ORCHESTRATOR.name, "claude-opus-4-6", "response",
    "Cache layer implemented. Research confirmed cache-aside with TTL is optimal for this use case.",
    { tokenCount: 200, durationMs: 500 },
  );
  await monitor.setStatus(ORCHESTRATOR.id, "idle");

  console.log("Multi-agent workflow complete. Check your dashboard!");
}

main().catch(console.error);
