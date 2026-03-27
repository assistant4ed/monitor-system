"use client";

import { Database, FileText, Gauge, Key } from "lucide-react";

import type { RedisStats } from "@/lib/monitor/types";

import StatusBadge from "./status-badge";

export default function RedisPanel({ stats }: { stats: RedisStats | null }) {
  if (!stats) {
    return (
      <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-6 animate-pulse">
        <div className="h-4 w-32 rounded bg-stone-800" />
        <div className="mt-4 h-8 w-24 rounded bg-stone-800" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stats.connected ? "bg-red-500/10" : "bg-stone-500/10"}`}>
            <Database className={`h-5 w-5 ${stats.connected ? "text-red-400" : "text-stone-400"}`} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-stone-100">Redis (Upstash)</h2>
            <p className="text-sm text-stone-500">Serverless Redis</p>
          </div>
        </div>
        <StatusBadge status={stats.connected ? "healthy" : "down"} label={stats.connected ? "Connected" : "Disconnected"} pulse={!stats.connected} />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="flex items-center gap-3 rounded-md border border-stone-800/50 bg-stone-900/30 px-3 py-2.5">
          <Key className="h-4 w-4 text-stone-500" />
          <div>
            <p className="text-xs text-stone-500">Total Keys</p>
            <p className="text-sm font-medium text-stone-200">{stats.keyCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-stone-800/50 bg-stone-900/30 px-3 py-2.5">
          <Gauge className="h-4 w-4 text-stone-500" />
          <div>
            <p className="text-xs text-stone-500">Tracked Metrics</p>
            <p className="text-sm font-medium text-stone-200">{stats.metricsCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-stone-800/50 bg-stone-900/30 px-3 py-2.5">
          <Database className="h-4 w-4 text-stone-500" />
          <div>
            <p className="text-xs text-stone-500">Alerts Stored</p>
            <p className="text-sm font-medium text-stone-200">{stats.alertsCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-stone-800/50 bg-stone-900/30 px-3 py-2.5">
          <FileText className="h-4 w-4 text-stone-500" />
          <div>
            <p className="text-xs text-stone-500">Log Entries</p>
            <p className="text-sm font-medium text-stone-200">{stats.logsCount}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
