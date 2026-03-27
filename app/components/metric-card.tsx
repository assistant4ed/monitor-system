"use client";

import Sparkline from "./sparkline";

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  sparkData?: number[];
  color?: string;
}

export default function MetricCard({ title, value, unit, sparkData, color = "#22c55e" }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-stone-500">{title}</p>
          <div className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums text-stone-100">{value}</span>
            {unit && <span className="text-sm text-stone-500">{unit}</span>}
          </div>
        </div>
        {sparkData && sparkData.length > 1 && (
          <div className="ml-3 flex-shrink-0">
            <Sparkline data={sparkData} color={color} />
          </div>
        )}
      </div>
    </div>
  );
}
