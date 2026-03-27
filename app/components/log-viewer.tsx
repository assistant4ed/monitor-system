"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import type { LogEntry } from "@/lib/monitor/types";

const LEVEL_COLORS: Record<string, string> = { debug: "text-stone-500", info: "text-blue-400", warn: "text-amber-400", error: "text-red-400" };
const LEVEL_BG: Record<string, string> = { debug: "bg-stone-500/10", info: "bg-blue-500/10", warn: "bg-amber-500/10", error: "bg-red-500/10" };

function ts(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function LogViewer({ logs, onFilterChange }: { logs: LogEntry[]; onFilterChange?: (level: string) => void }) {
  const [active, setActive] = useState("all");
  const [search, setSearch] = useState("");

  const handleFilter = (level: string) => {
    setActive(level);
    onFilterChange?.(level === "all" ? "" : level);
  };

  const filtered = logs.filter((l) => !search || l.message.toLowerCase().includes(search.toLowerCase()));
  const counts = logs.reduce((a, l) => { a[l.level] = (a[l.level] || 0) + 1; return a; }, {} as Record<string, number>);

  return (
    <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-100">Logs</h2>
        <span className="text-xs text-stone-500">{filtered.length} entries</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-500" />
          <input
            type="text"
            placeholder="Search logs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-stone-800 bg-stone-900 py-1.5 pl-8 pr-3 text-xs text-stone-300 placeholder-stone-600 focus:border-stone-600 focus:outline-none"
          />
        </div>
        <div className="flex gap-1">
          {["all", "error", "warn", "info", "debug"].map((level) => (
            <button
              key={level}
              onClick={() => handleFilter(level)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${active === level ? "bg-stone-700 text-stone-200" : "text-stone-500 hover:text-stone-300"}`}
            >
              {level}{level !== "all" && counts[level] ? <span className="ml-1 text-stone-600">{counts[level]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 max-h-80 space-y-0.5 overflow-y-auto rounded-md border border-stone-800 bg-stone-950 p-2 font-mono text-xs">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-stone-600">No log entries</p>
        ) : (
          filtered.map((log) => (
            <div key={log.id} className="flex items-start gap-2 rounded px-2 py-1 hover:bg-stone-900/50">
              <span className="flex-shrink-0 tabular-nums text-stone-600">{ts(log.timestamp)}</span>
              <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${LEVEL_BG[log.level]} ${LEVEL_COLORS[log.level]}`}>{log.level}</span>
              <span className="flex-shrink-0 text-stone-500">[{log.service}]</span>
              <span className="text-stone-300">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
