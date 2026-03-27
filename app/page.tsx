"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity, Database, RefreshCw, Timer } from "lucide-react";

import type { Alert, HealthReport, LogEntry, Metric, MetricSeries, RedisStats } from "@/lib/monitor/types";

import AlertPanel from "./components/alert-panel";
import HealthPanel from "./components/health-panel";
import LogViewer from "./components/log-viewer";
import MetricCard from "./components/metric-card";
import RedisPanel from "./components/redis-panel";

const REFRESH_MS = 10000;

export default function Dashboard() {
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [metrics, setMetrics] = useState<{ names: string[]; latest: Record<string, Metric> } | null>(null);
  const [series, setSeries] = useState<Record<string, MetricSeries>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [redis, setRedis] = useState<RedisStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [logLevel, setLogLevel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
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

      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch failed");
    } finally {
      setLoading(false);
    }
  }, [logLevel]);

  const fetchSeries = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/monitor/metrics?name=${encodeURIComponent(name)}&limit=50`);
      if (res.ok) {
        const s = await res.json();
        setSeries((prev) => ({ ...prev, [name]: s }));
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchData]);

  useEffect(() => {
    for (const name of ["system.heap_used", "system.rss", "system.uptime"]) {
      fetchSeries(name);
    }
  }, [fetchSeries, metrics]);

  const handleAck = async (id: string) => {
    await fetch("/api/monitor/alerts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "acknowledge" }) });
    fetchData();
  };

  const handleResolve = async (id: string) => {
    await fetch("/api/monitor/alerts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: "resolve" }) });
    fetchData();
  };

  const val = (name: string) => metrics?.latest[name]?.value ?? 0;
  const spark = (name: string) => series[name]?.points.map((p) => p.value) || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-stone-100">Monitor</h1>
          <p className="text-sm text-stone-500">Real-time system monitoring with Redis-backed metrics</p>
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-xs text-red-400">{error}</span>}
          <span className="text-xs text-stone-600">Updated {lastRefresh.toLocaleTimeString()}</span>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md border border-stone-700 bg-stone-800 px-3 py-1.5 text-xs font-medium text-stone-300 hover:bg-stone-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Heap Memory" value={val("system.heap_used")} unit="MB" sparkData={spark("system.heap_used")} color="#3b82f6" />
        <MetricCard title="RSS Memory" value={val("system.rss")} unit="MB" sparkData={spark("system.rss")} color="#8b5cf6" />
        <MetricCard title="Process Uptime" value={val("system.uptime")} unit="sec" sparkData={spark("system.uptime")} color="#22c55e" />
        <MetricCard title="Active Alerts" value={alerts.filter((a) => a.status === "active").length} color={alerts.some((a) => a.status === "active") ? "#ef4444" : "#22c55e"} />
      </div>

      {/* Health + Redis */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <HealthPanel health={health} />
        <RedisPanel stats={redis} />
      </div>

      {/* Custom Metrics */}
      {metrics && metrics.names.filter((n) => !n.startsWith("system.")).length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-stone-500">Custom Metrics</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {metrics.names.filter((n) => !n.startsWith("system.")).slice(0, 8).map((name) => {
              const m = metrics.latest[name];
              if (!m) return null;
              return <MetricCard key={name} title={name.split(".").pop() || name} value={Math.round(m.value * 100) / 100} unit={m.unit} sparkData={spark(name)} color="#f59e0b" />;
            })}
          </div>
        </div>
      )}

      {/* Alerts + Logs */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AlertPanel alerts={alerts} onAcknowledge={handleAck} onResolve={handleResolve} />
        <LogViewer logs={logs} onFilterChange={setLogLevel} />
      </div>

      {/* Metrics Table */}
      {metrics && Object.keys(metrics.latest).length > 0 && (
        <div className="mt-6 rounded-lg border border-stone-800 bg-stone-900/50 p-6">
          <h2 className="text-lg font-semibold text-stone-100">All Metrics</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-800 text-stone-500">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium text-right">Value</th>
                  <th className="pb-2 pr-4 font-medium">Unit</th>
                  <th className="pb-2 font-medium">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(metrics.latest).sort(([a], [b]) => a.localeCompare(b)).map(([name, m]) => (
                  <tr key={name} className="border-b border-stone-800/50 text-stone-300">
                    <td className="py-2 pr-4 font-mono">{name}</td>
                    <td className="py-2 pr-4"><span className="rounded bg-stone-800 px-1.5 py-0.5 text-stone-400">{m.type}</span></td>
                    <td className="py-2 pr-4 text-right tabular-nums font-medium">{Math.round(m.value * 100) / 100}</td>
                    <td className="py-2 pr-4 text-stone-500">{m.unit || "-"}</td>
                    <td className="py-2 text-stone-500">{new Date(m.timestamp).toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 border-t border-stone-800 pt-4 text-center text-xs text-stone-600">
        <div className="flex items-center justify-center gap-4">
          <span className="flex items-center gap-1"><Activity className="h-3 w-3" /> Auto-refresh: {REFRESH_MS / 1000}s</span>
          <span className="flex items-center gap-1"><Database className="h-3 w-3" /> Redis-backed</span>
          <span className="flex items-center gap-1"><Timer className="h-3 w-3" /> 72h retention</span>
        </div>
      </div>
    </div>
  );
}
