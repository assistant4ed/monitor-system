"use client";

type Status = "healthy" | "degraded" | "down" | "unknown" | "active" | "acknowledged" | "resolved" | "critical" | "warning" | "info";

const STYLES: Record<Status, { bg: string; text: string; dot: string }> = {
  healthy:      { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  degraded:     { bg: "bg-amber-500/10",   text: "text-amber-400",   dot: "bg-amber-400" },
  down:         { bg: "bg-red-500/10",     text: "text-red-400",     dot: "bg-red-400" },
  unknown:      { bg: "bg-stone-500/10",   text: "text-stone-400",   dot: "bg-stone-400" },
  active:       { bg: "bg-red-500/10",     text: "text-red-400",     dot: "bg-red-400" },
  acknowledged: { bg: "bg-amber-500/10",   text: "text-amber-400",   dot: "bg-amber-400" },
  resolved:     { bg: "bg-emerald-500/10", text: "text-emerald-400", dot: "bg-emerald-400" },
  critical:     { bg: "bg-red-500/10",     text: "text-red-400",     dot: "bg-red-400" },
  warning:      { bg: "bg-amber-500/10",   text: "text-amber-400",   dot: "bg-amber-400" },
  info:         { bg: "bg-blue-500/10",    text: "text-blue-400",    dot: "bg-blue-400" },
};

export default function StatusBadge({ status, label, pulse }: { status: Status; label?: string; pulse?: boolean }) {
  const s = STYLES[status] || STYLES.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot} ${pulse ? "animate-pulse" : ""}`} />
      {label || status}
    </span>
  );
}
