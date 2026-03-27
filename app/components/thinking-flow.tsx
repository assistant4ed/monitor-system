"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, Bot, Brain, Code, MessageSquare, Settings, Terminal } from "lucide-react";

import type { ThinkingStep } from "@/lib/monitor/types";

const TYPE_CONFIG: Record<ThinkingStep["type"], { icon: typeof Brain; color: string; bg: string; label: string }> = {
  thinking:    { icon: Brain,          color: "text-amber-400",  bg: "bg-amber-500/10 border-amber-800/30", label: "THINK" },
  response:    { icon: MessageSquare,  color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-800/30",   label: "REPLY" },
  tool_call:   { icon: Terminal,       color: "text-violet-400", bg: "bg-violet-500/10 border-violet-800/30", label: "TOOL" },
  tool_result: { icon: Code,           color: "text-emerald-400",bg: "bg-emerald-500/10 border-emerald-800/30", label: "RESULT" },
  error:       { icon: AlertTriangle,  color: "text-red-400",    bg: "bg-red-500/10 border-red-800/30",     label: "ERROR" },
  system:      { icon: Settings,       color: "text-stone-400",  bg: "bg-stone-500/10 border-stone-800/30", label: "SYSTEM" },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 1 } as Intl.DateTimeFormatOptions);
}

export default function ThinkingFlow({ steps }: { steps: ThinkingStep[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [steps.length]);

  return (
    <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-stone-100">Thinking Flow</h2>
        </div>
        <span className="text-xs text-stone-500">{steps.length} steps</span>
      </div>

      <div className="mt-4 max-h-[500px] overflow-y-auto space-y-1 pr-1">
        {steps.length === 0 ? (
          <div className="py-8 text-center text-stone-600">
            <Brain className="mx-auto h-8 w-8 opacity-50" />
            <p className="mt-2 text-sm">No thinking steps recorded</p>
          </div>
        ) : (
          // Render newest first
          [...steps].map((step) => {
            const config = TYPE_CONFIG[step.type] || TYPE_CONFIG.system;
            const Icon = config.icon;

            return (
              <div
                key={step.id}
                className={`rounded-md border px-3 py-2 ${config.bg} transition-opacity`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${config.color}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
                    {config.label}
                  </span>
                  <span className="text-[10px] text-stone-600">
                    <Bot className="inline h-2.5 w-2.5" /> {step.agentName}
                  </span>
                  <span className="text-[10px] font-mono text-stone-700">{step.model}</span>
                  <span className="ml-auto flex items-center gap-2 text-[10px] text-stone-600">
                    {step.tokenCount && (
                      <span className="tabular-nums">{step.tokenCount} tok</span>
                    )}
                    {step.durationMs && (
                      <span className="tabular-nums">{step.durationMs}ms</span>
                    )}
                    <span className="tabular-nums">{formatTime(step.timestamp)}</span>
                  </span>
                </div>
                <div className="mt-1.5 text-xs leading-relaxed text-stone-300 whitespace-pre-wrap break-words font-mono">
                  {step.content.length > 500 ? (
                    <>
                      {step.content.slice(0, 500)}
                      <span className="text-stone-600">... ({step.content.length} chars)</span>
                    </>
                  ) : (
                    step.content
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
