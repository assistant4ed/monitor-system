"use client";

import { Bot, Brain, Cpu, Zap } from "lucide-react";

import type { AgentInfo, AgentStatus } from "@/lib/monitor/types";

const STATUS_STYLE: Record<AgentStatus, { dot: string; bg: string; label: string }> = {
  thinking:   { dot: "bg-amber-400 animate-pulse", bg: "border-amber-800/50 bg-amber-950/10", label: "Thinking" },
  responding: { dot: "bg-blue-400 animate-pulse",  bg: "border-blue-800/50 bg-blue-950/10",   label: "Responding" },
  tool_use:   { dot: "bg-violet-400 animate-pulse", bg: "border-violet-800/50 bg-violet-950/10", label: "Tool Use" },
  idle:       { dot: "bg-emerald-400",             bg: "border-stone-800 bg-stone-900/50",     label: "Idle" },
  error:      { dot: "bg-red-400",                 bg: "border-red-800/50 bg-red-950/10",      label: "Error" },
  offline:    { dot: "bg-stone-600",               bg: "border-stone-800 bg-stone-900/30",     label: "Offline" },
};

const MODEL_COLORS: Record<string, string> = {
  "claude-opus-4-6": "text-violet-400",
  "claude-sonnet-4-6": "text-blue-400",
  "claude-haiku-4-5": "text-emerald-400",
  "gpt-4o": "text-green-400",
  "gpt-4-turbo": "text-green-300",
  "gpt-3.5-turbo": "text-green-200",
};

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${(usd * 100).toFixed(2)}c`;
  return `$${usd.toFixed(4)}`;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function AgentGrid({ agents }: { agents: AgentInfo[] }) {
  if (agents.length === 0) {
    return (
      <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-8 text-center">
        <Bot className="mx-auto h-8 w-8 text-stone-600" />
        <p className="mt-2 text-sm text-stone-500">No agents registered</p>
        <p className="mt-1 text-xs text-stone-600">POST to /api/monitor/agents to register agents</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {agents.map((agent) => {
        const st = STATUS_STYLE[agent.status] || STATUS_STYLE.offline;
        const modelColor = MODEL_COLORS[agent.model] || "text-stone-400";

        return (
          <div key={agent.id} className={`rounded-lg border p-4 transition-all ${st.bg}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-800">
                    {agent.status === "thinking" ? (
                      <Brain className="h-4.5 w-4.5 text-amber-400" />
                    ) : agent.status === "tool_use" ? (
                      <Cpu className="h-4.5 w-4.5 text-violet-400" />
                    ) : (
                      <Bot className="h-4.5 w-4.5 text-stone-400" />
                    )}
                  </div>
                  <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-stone-900 ${st.dot}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-stone-200">{agent.name}</p>
                  <p className={`text-xs font-mono ${modelColor}`}>{agent.model}</p>
                </div>
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-stone-600">
                {st.label}
              </span>
            </div>

            {agent.role && (
              <p className="mt-2 text-xs text-stone-500 truncate">{agent.role}</p>
            )}

            <div className="mt-3 grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] uppercase text-stone-600">Input</p>
                <p className="text-xs font-medium tabular-nums text-stone-300">{formatTokens(agent.tokens.input)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-stone-600">Output</p>
                <p className="text-xs font-medium tabular-nums text-stone-300">{formatTokens(agent.tokens.output)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-stone-600">Thinking</p>
                <p className="text-xs font-medium tabular-nums text-amber-400/80">{formatTokens(agent.tokens.thinking)}</p>
              </div>
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-stone-800/50 pt-2">
              <div className="flex items-center gap-1 text-[10px] text-stone-600">
                <Zap className="h-3 w-3" />
                <span className="tabular-nums">{formatTokens(agent.tokens.total)} total</span>
                <span className="mx-1 text-stone-700">|</span>
                <span className="tabular-nums">{formatCost(agent.costUsd)}</span>
              </div>
              <span className="text-[10px] text-stone-600">{timeAgo(agent.lastActiveAt)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
