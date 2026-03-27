"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Bot,
  Brain,
  Database,
  Eye,
  EyeOff,
  MessageCircle,
  RefreshCw,
  Zap,
} from "lucide-react";

import type {
  AgentDashboardData,
  Alert,
  HealthReport,
  LogEntry,
  Metric,
  MetricSeries,
  RedisStats,
  TokenUsage,
} from "@/lib/monitor/types";

import AgentComms from "./components/agent-comms";
import AgentGrid from "./components/agent-grid";
import AlertPanel from "./components/alert-panel";
import HealthPanel from "./components/health-panel";
import LogViewer from "./components/log-viewer";
import MetricCard from "./components/metric-card";
import RedisPanel from "./components/redis-panel";
import ThinkingFlow from "./components/thinking-flow";
import TokenCounter from "./components/token-counter";

const LIVE_INTERVAL_MS = 1000;
const IDLE_INTERVAL_MS = 10000;

function emptyTokens(): TokenUsage {
  return { input: 0, output: 0, thinking: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
}

export default function Dashboard() {
  // Agent data
  const [agentData, setAgentData] = useState<AgentDashboardData | null>(null);

  // System data
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [metrics, setMetrics] = useState<{ names: string[]; latest: Record<string, Metric> } | null>(null);
  const [series, setSeries] = useState<Record<string, MetricSeries>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [redis, setRedis] = useState<RedisStats | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [logLevel, setLogLevel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [isUserWatching, setIsUserWatching] = useState(true);
  const [tab, setTab] = useState<"agents" | "system">("agents");

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const fetchCountRef = useRef(0);

  // ─── Visibility detection ──────────────────────────────

  useEffect(() => {
    const handleVisibility = () => {
      setIsUserWatching(document.visibilityState === "visible");
    };

    const handleFocus = () => setIsUserWatching(true);
    const handleBlur = () => setIsUserWatching(false);

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  // ─── Data fetching ─────────────────────────────────────

  const fetchAgentData = useCallback(async () => {
    try {
      const res = await fetch("/api/monitor/agents?full=1");
      if (res.ok) {
        setAgentData(await res.json());
      }
    } catch { /* silent */ }
  }, []);

  const fetchSystemData = useCallback(async () => {
    try {
      const [hRes, mRes, aRes, lRes, rRes] = await Promise.allSettled([
        fetch("/api/monitor/health"),
        fetch("/api/monitor/metrics"),
        fetch("/api/monitor/alerts"),
        fetch(`/api/monitor/logs${logLevel ? `?level=${logLevel}` : ""}`),
        fetch("/api/monitor/stats"),
      ]);

      if (hRes.status === "fulfilled") setHealth(await hRes.value.json());
      if (mRes.status === "fulfilled") setMetrics(await mRes.value.json());
      if (aRes.status === "fulfilled") { const d = await aRes.value.json(); setAlerts(d.alerts || []); }
      if (lRes.status === "fulfilled") { const d = await lRes.value.json(); setLogs(d.logs || []); }
      if (rRes.status === "fulfilled") setRedis(await rRes.value.json());
    } catch { /* silent */ }
  }, [logLevel]);

  const fetchAll = useCallback(async () => {
    fetchCountRef.current++;
    try {
      // Always fetch agent data (fast, lightweight)
      await fetchAgentData();

      // Fetch system data less frequently (every 5th call in live mode)
      if (tab === "system" || fetchCountRef.current % 5 === 0) {
        await fetchSystemData();
      }

      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setLoading(false);
    }
  }, [fetchAgentData, fetchSystemData, tab]);

  // ─── Interval management with live mode ────────────────

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    fetchAll();

    if (isLive) {
      const interval = isUserWatching ? LIVE_INTERVAL_MS : IDLE_INTERVAL_MS;
      intervalRef.current = setInterval(fetchAll, interval);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchAll, isLive, isUserWatching]);

  const fetchSeries = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/monitor/metrics?name=${encodeURIComponent(name)}&limit=50`);
      if (res.ok) setSeries((prev) => ({ ...prev, [name]: res.json() as unknown as MetricSeries }));
    } catch { /* silent */ }
  }, []);

  const handleAck = async (id: string) => {
    await fetch("/api/monitor/alerts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "acknowledge" }) });
    fetchAll();
  };

  const handleResolve = async (id: string) => {
    await fetch("/api/monitor/alerts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "resolve" }) });
    fetchAll();
  };

  const val = (name: string) => metrics?.latest[name]?.value ?? 0;

  const activeInterval = isLive ? (isUserWatching ? LIVE_INTERVAL_MS : IDLE_INTERVAL_MS) : 0;
  const agents = agentData?.agents || [];
  const totalTokens = agentData?.totalTokens || emptyTokens();
  const totalCost = agentData?.totalCostUsd || 0;
  const tokPerSec = agentData?.tokensPerSecond || 0;
  const tokenHistory = agentData?.tokenHistory || [];
  const thinkingSteps = agentData?.thinkingFlow || [];
  const comms = agentData?.communications || [];

  const activeAgents = agents.filter((a) => a.status !== "offline" && a.status !== "idle").length;
  const thinkingAgents = agents.filter((a) => a.status === "thinking").length;

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-4 sm:px-6 lg:px-8">
      {/* ─── Header ───────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-xl font-bold text-stone-100">Agent Monitor</h1>
            <p className="text-xs text-stone-500">AI agent observability & token tracking</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live indicator */}
          <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            isLive && isUserWatching
              ? "bg-emerald-500/10 text-emerald-400"
              : isLive
                ? "bg-amber-500/10 text-amber-400"
                : "bg-stone-500/10 text-stone-500"
          }`}>
            {isLive && isUserWatching ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                LIVE 1s
              </>
            ) : isLive ? (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                IDLE 10s
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-stone-500" />
                PAUSED
              </>
            )}
          </div>

          <button
            onClick={() => setIsLive(!isLive)}
            className="flex items-center gap-1 rounded-md border border-stone-700 bg-stone-800 px-2.5 py-1.5 text-xs text-stone-300 hover:bg-stone-700"
            title={isLive ? "Pause updates" : "Resume live updates"}
          >
            {isLive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>

          <button
            onClick={fetchAll}
            disabled={loading}
            className="flex items-center gap-1 rounded-md border border-stone-700 bg-stone-800 px-2.5 py-1.5 text-xs text-stone-300 hover:bg-stone-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          <span className="text-[10px] tabular-nums text-stone-600">
            {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* ─── Tab bar ──────────────────────────────────── */}
      <div className="mt-4 flex items-center gap-1 border-b border-stone-800">
        <button
          onClick={() => setTab("agents")}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "agents"
              ? "border-violet-400 text-violet-400"
              : "border-transparent text-stone-500 hover:text-stone-300"
          }`}
        >
          <Bot className="h-4 w-4" /> Agents
          {activeAgents > 0 && (
            <span className="rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] tabular-nums text-violet-400">{activeAgents}</span>
          )}
        </button>
        <button
          onClick={() => setTab("system")}
          className={`flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            tab === "system"
              ? "border-blue-400 text-blue-400"
              : "border-transparent text-stone-500 hover:text-stone-300"
          }`}
        >
          <Activity className="h-4 w-4" /> System
        </button>

        {/* Quick stats in tab bar */}
        <div className="ml-auto flex items-center gap-4 pb-1 text-xs text-stone-600">
          <span className="flex items-center gap-1 tabular-nums">
            <Bot className="h-3 w-3" /> {agents.length} agents
          </span>
          <span className="flex items-center gap-1 tabular-nums">
            <Zap className="h-3 w-3" /> {totalTokens.total.toLocaleString()} tokens
          </span>
          <span className="flex items-center gap-1 tabular-nums">
            <Brain className="h-3 w-3" /> {thinkingAgents} thinking
          </span>
          <span className="flex items-center gap-1 tabular-nums">
            <MessageCircle className="h-3 w-3" /> {comms.length} msgs
          </span>
        </div>
      </div>

      {error && (
        <div className="mt-2 rounded-md bg-red-950/20 border border-red-800/50 px-3 py-1.5 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* ─── Agents Tab ───────────────────────────────── */}
      {tab === "agents" && (
        <div className="mt-4 space-y-6">
          {/* Token Counter */}
          <TokenCounter
            tokens={totalTokens}
            costUsd={totalCost}
            tokensPerSecond={tokPerSec}
            history={tokenHistory}
          />

          {/* Agent Grid */}
          <div>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-stone-500">
              <Bot className="h-4 w-4" /> Registered Agents
            </h2>
            <AgentGrid agents={agents} />
          </div>

          {/* Thinking Flow + Comms side by side */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ThinkingFlow steps={thinkingSteps} />
            <AgentComms messages={comms} />
          </div>
        </div>
      )}

      {/* ─── System Tab ───────────────────────────────── */}
      {tab === "system" && (
        <div className="mt-4 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Heap Memory" value={val("system.heap_used")} unit="MB" color="#3b82f6" />
            <MetricCard title="RSS Memory" value={val("system.rss")} unit="MB" color="#8b5cf6" />
            <MetricCard title="Uptime" value={val("system.uptime")} unit="sec" color="#22c55e" />
            <MetricCard title="Active Alerts" value={alerts.filter((a) => a.status === "active").length} color={alerts.some((a) => a.status === "active") ? "#ef4444" : "#22c55e"} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <HealthPanel health={health} />
            <RedisPanel stats={redis} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <AlertPanel alerts={alerts} onAcknowledge={handleAck} onResolve={handleResolve} />
            <LogViewer logs={logs} onFilterChange={setLogLevel} />
          </div>
        </div>
      )}

      {/* ─── Footer ───────────────────────────────────── */}
      <div className="mt-6 border-t border-stone-800 pt-3 text-center text-[10px] text-stone-700">
        <div className="flex items-center justify-center gap-4">
          <span>Refresh: {activeInterval ? `${activeInterval / 1000}s` : "paused"}</span>
          <span>|</span>
          <span className="flex items-center gap-1"><Database className="h-2.5 w-2.5" /> Upstash Redis</span>
          <span>|</span>
          <span>POST /api/monitor/agents to register agents</span>
        </div>
      </div>
    </div>
  );
}
