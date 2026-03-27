import { getRedis } from "@/lib/redis";

import type {
  AgentDashboardData,
  AgentInfo,
  AgentMessage,
  AgentStatus,
  ThinkingStep,
  TokenSnapshot,
  TokenUsage,
} from "./types";

const AGENT_PREFIX = "m:agent:";
const AGENT_INDEX = "m:agents";
const TOKEN_HISTORY = "m:token-history";
const THINKING_LOG = "m:thinking";
const COMMS_LOG = "m:comms";
const MAX_HISTORY = 2000;
const MAX_THINKING = 500;
const MAX_COMMS = 500;

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyTokens(): TokenUsage {
  return { input: 0, output: 0, thinking: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
}

// ─── Agent registry ──────────────────────────────────────

export async function registerAgent(agent: Omit<AgentInfo, "createdAt" | "lastActiveAt" | "tokens" | "costUsd" | "requestCount">): Promise<AgentInfo> {
  const redis = getRedis();
  const now = new Date().toISOString();

  const info: AgentInfo = {
    ...agent,
    createdAt: now,
    lastActiveAt: now,
    tokens: emptyTokens(),
    costUsd: 0,
    requestCount: 0,
  };

  const pipe = redis.pipeline();
  pipe.set(`${AGENT_PREFIX}${agent.id}`, JSON.stringify(info));
  pipe.sadd(AGENT_INDEX, agent.id);
  await pipe.exec();

  return info;
}

export async function updateAgentStatus(agentId: string, status: AgentStatus): Promise<void> {
  const redis = getRedis();
  const raw = await redis.get<string>(`${AGENT_PREFIX}${agentId}`);
  if (!raw) return;

  const agent: AgentInfo = typeof raw === "string" ? JSON.parse(raw) : raw;
  agent.status = status;
  agent.lastActiveAt = new Date().toISOString();
  await redis.set(`${AGENT_PREFIX}${agentId}`, JSON.stringify(agent));
}

export async function updateAgentTokens(
  agentId: string,
  tokenDelta: Partial<TokenUsage>,
  costDelta: number = 0,
): Promise<void> {
  const redis = getRedis();
  const raw = await redis.get<string>(`${AGENT_PREFIX}${agentId}`);
  if (!raw) return;

  const agent: AgentInfo = typeof raw === "string" ? JSON.parse(raw) : raw;
  const now = new Date().toISOString();

  const prevTotal = { ...agent.tokens };

  agent.tokens.input += tokenDelta.input || 0;
  agent.tokens.output += tokenDelta.output || 0;
  agent.tokens.thinking += tokenDelta.thinking || 0;
  agent.tokens.cacheRead += tokenDelta.cacheRead || 0;
  agent.tokens.cacheWrite += tokenDelta.cacheWrite || 0;
  agent.tokens.total = agent.tokens.input + agent.tokens.output + agent.tokens.thinking;
  agent.costUsd += costDelta;
  agent.requestCount += 1;
  agent.lastActiveAt = now;

  const snapshot: TokenSnapshot = {
    timestamp: now,
    agentId,
    tokens: { ...agent.tokens },
    costUsd: agent.costUsd,
    deltaInput: agent.tokens.input - prevTotal.input,
    deltaOutput: agent.tokens.output - prevTotal.output,
    deltaThinking: agent.tokens.thinking - prevTotal.thinking,
  };

  const pipe = redis.pipeline();
  pipe.set(`${AGENT_PREFIX}${agentId}`, JSON.stringify(agent));
  pipe.lpush(TOKEN_HISTORY, JSON.stringify(snapshot));
  pipe.ltrim(TOKEN_HISTORY, 0, MAX_HISTORY - 1);
  await pipe.exec();
}

export async function getAgent(agentId: string): Promise<AgentInfo | null> {
  const redis = getRedis();
  const raw = await redis.get<string>(`${AGENT_PREFIX}${agentId}`);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function getAllAgents(): Promise<AgentInfo[]> {
  const redis = getRedis();
  const ids: string[] = await redis.smembers(AGENT_INDEX);
  if (ids.length === 0) return [];

  const pipe = redis.pipeline();
  for (const id of ids) pipe.get(`${AGENT_PREFIX}${id}`);
  const results = await pipe.exec();

  const agents: AgentInfo[] = [];
  for (const raw of results) {
    if (!raw) continue;
    try {
      agents.push(typeof raw === "string" ? JSON.parse(raw) : raw as AgentInfo);
    } catch { /* skip */ }
  }

  return agents.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
}

export async function removeAgent(agentId: string): Promise<void> {
  const redis = getRedis();
  const pipe = redis.pipeline();
  pipe.del(`${AGENT_PREFIX}${agentId}`);
  pipe.srem(AGENT_INDEX, agentId);
  await pipe.exec();
}

// ─── Token history ───────────────────────────────────────

export async function getTokenHistory(limit: number = 200): Promise<TokenSnapshot[]> {
  const redis = getRedis();
  const raw: string[] = await redis.lrange(TOKEN_HISTORY, 0, limit - 1);

  return raw
    .map((r) => { try { return typeof r === "string" ? JSON.parse(r) : r; } catch { return null; } })
    .filter((s): s is TokenSnapshot => s !== null)
    .reverse();
}

// ─── Thinking flow ───────────────────────────────────────

export async function addThinkingStep(step: Omit<ThinkingStep, "id">): Promise<ThinkingStep> {
  const redis = getRedis();
  const entry: ThinkingStep = { id: genId(), ...step };

  const pipe = redis.pipeline();
  pipe.lpush(THINKING_LOG, JSON.stringify(entry));
  pipe.ltrim(THINKING_LOG, 0, MAX_THINKING - 1);
  await pipe.exec();

  return entry;
}

export async function getThinkingFlow(limit: number = 100): Promise<ThinkingStep[]> {
  const redis = getRedis();
  const raw: string[] = await redis.lrange(THINKING_LOG, 0, limit - 1);

  return raw
    .map((r) => { try { return typeof r === "string" ? JSON.parse(r) : r; } catch { return null; } })
    .filter((s): s is ThinkingStep => s !== null);
}

// ─── Agent communications ────────────────────────────────

export async function addAgentMessage(msg: Omit<AgentMessage, "id">): Promise<AgentMessage> {
  const redis = getRedis();
  const entry: AgentMessage = { id: genId(), ...msg };

  const pipe = redis.pipeline();
  pipe.lpush(COMMS_LOG, JSON.stringify(entry));
  pipe.ltrim(COMMS_LOG, 0, MAX_COMMS - 1);
  await pipe.exec();

  return entry;
}

export async function getAgentCommunications(limit: number = 100): Promise<AgentMessage[]> {
  const redis = getRedis();
  const raw: string[] = await redis.lrange(COMMS_LOG, 0, limit - 1);

  return raw
    .map((r) => { try { return typeof r === "string" ? JSON.parse(r) : r; } catch { return null; } })
    .filter((m): m is AgentMessage => m !== null);
}

// ─── Dashboard aggregate ─────────────────────────────────

export async function getAgentDashboard(): Promise<AgentDashboardData> {
  const [agents, tokenHistory, thinkingFlow, communications] = await Promise.all([
    getAllAgents(),
    getTokenHistory(200),
    getThinkingFlow(100),
    getAgentCommunications(100),
  ]);

  const totalTokens = emptyTokens();
  let totalCostUsd = 0;

  for (const agent of agents) {
    totalTokens.input += agent.tokens.input;
    totalTokens.output += agent.tokens.output;
    totalTokens.thinking += agent.tokens.thinking;
    totalTokens.cacheRead += agent.tokens.cacheRead;
    totalTokens.cacheWrite += agent.tokens.cacheWrite;
    totalTokens.total += agent.tokens.total;
    totalCostUsd += agent.costUsd;
  }

  // Calculate tokens/sec from last 10 seconds of history
  let tokensPerSecond = 0;
  if (tokenHistory.length >= 2) {
    const cutoff = Date.now() - 10000;
    const recent = tokenHistory.filter((s) => new Date(s.timestamp).getTime() > cutoff);
    const recentDelta = recent.reduce((sum, s) => sum + s.deltaInput + s.deltaOutput + s.deltaThinking, 0);
    const windowSec = recent.length > 0
      ? (Date.now() - new Date(recent[0].timestamp).getTime()) / 1000
      : 10;
    tokensPerSecond = windowSec > 0 ? Math.round(recentDelta / windowSec) : 0;
  }

  return {
    agents,
    totalTokens,
    totalCostUsd,
    tokenHistory,
    thinkingFlow,
    communications,
    tokensPerSecond,
  };
}
