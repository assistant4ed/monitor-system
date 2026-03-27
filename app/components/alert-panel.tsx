"use client";

import { AlertTriangle, Bell, CheckCircle, XCircle } from "lucide-react";

import type { Alert } from "@/lib/monitor/types";

import StatusBadge from "./status-badge";

const ICON = { critical: XCircle, warning: AlertTriangle, info: Bell };

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AlertPanel({
  alerts,
  onAcknowledge,
  onResolve,
}: {
  alerts: Alert[];
  onAcknowledge?: (id: string) => void;
  onResolve?: (id: string) => void;
}) {
  const active = alerts.filter((a) => a.status === "active");
  const acked = alerts.filter((a) => a.status === "acknowledged");
  const resolved = alerts.filter((a) => a.status === "resolved").slice(0, 5);

  return (
    <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-100">Alerts</h2>
        <div className="flex items-center gap-2">
          {active.length > 0 && (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-400">{active.length} active</span>
          )}
          {acked.length > 0 && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-400">{acked.length} ack</span>
          )}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="mt-6 flex flex-col items-center py-8 text-stone-600">
          <CheckCircle className="h-8 w-8" />
          <p className="mt-2 text-sm">No alerts</p>
        </div>
      ) : (
        <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
          {[...active, ...acked, ...resolved].map((alert) => {
            const Icon = ICON[alert.severity];
            const colorClass = alert.severity === "critical" ? "text-red-400" : alert.severity === "warning" ? "text-amber-400" : "text-blue-400";
            const borderClass = alert.status === "active" ? "border-red-800/50 bg-red-950/20" : alert.status === "acknowledged" ? "border-amber-800/50 bg-amber-950/20" : "border-stone-800/50 bg-stone-900/30";

            return (
              <div key={alert.id} className={`rounded-md border px-3 py-2.5 ${borderClass}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${colorClass}`} />
                    <div>
                      <p className="text-sm font-medium text-stone-200">{alert.title}</p>
                      <p className="mt-0.5 text-xs text-stone-500">{alert.message}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <StatusBadge status={alert.status} />
                        <span className="text-xs text-stone-600">{timeAgo(alert.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {alert.status === "active" && (
                      <>
                        <button onClick={() => onAcknowledge?.(alert.id)} className="rounded px-2 py-1 text-xs text-amber-400 hover:bg-amber-500/10">ACK</button>
                        <button onClick={() => onResolve?.(alert.id)} className="rounded px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-500/10">Resolve</button>
                      </>
                    )}
                    {alert.status === "acknowledged" && (
                      <button onClick={() => onResolve?.(alert.id)} className="rounded px-2 py-1 text-xs text-emerald-400 hover:bg-emerald-500/10">Resolve</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
