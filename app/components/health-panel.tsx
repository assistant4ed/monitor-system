"use client";

import { Activity, Clock, Server, Wifi } from "lucide-react";

import type { HealthReport } from "@/lib/monitor/types";

import StatusBadge from "./status-badge";

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function HealthPanel({ health }: { health: HealthReport | null }) {
  if (!health) {
    return (
      <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-6 animate-pulse">
        <div className="h-4 w-32 rounded bg-stone-800" />
        <div className="mt-4 h-8 w-24 rounded bg-stone-800" />
      </div>
    );
  }

  const statusColor = health.status === "healthy" ? "emerald" : health.status === "degraded" ? "amber" : "red";

  return (
    <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg bg-${statusColor}-500/10`}>
            <Activity className={`h-5 w-5 text-${statusColor}-400`} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-stone-100">System Health</h2>
            <p className="text-sm text-stone-500">v{health.version}</p>
          </div>
        </div>
        <StatusBadge status={health.status} pulse={health.status !== "healthy"} />
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-stone-500" />
          <div>
            <p className="text-xs text-stone-500">Uptime</p>
            <p className="text-sm font-medium text-stone-200">{formatUptime(health.uptime)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-stone-500" />
          <div>
            <p className="text-xs text-stone-500">Redis</p>
            <StatusBadge status={health.checks.redis} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Server className="h-4 w-4 text-stone-500" />
          <div>
            <p className="text-xs text-stone-500">Services</p>
            <p className="text-sm font-medium text-stone-200">
              {health.checks.services.filter((s) => s.status === "healthy").length}/{health.checks.services.length} up
            </p>
          </div>
        </div>
      </div>

      {health.checks.services.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">Service Checks</p>
          {health.checks.services.map((svc) => (
            <div key={svc.name} className="flex items-center justify-between rounded-md border border-stone-800/50 bg-stone-900/30 px-3 py-2">
              <div className="flex items-center gap-2">
                <StatusBadge status={svc.status} />
                <span className="text-sm text-stone-300">{svc.name}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-stone-500">
                {svc.responseTimeMs > 0 && <span>{svc.responseTimeMs}ms</span>}
                {svc.statusCode && <span className="font-mono">{svc.statusCode}</span>}
                {svc.error && <span className="text-red-400 truncate max-w-[150px]">{svc.error}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
