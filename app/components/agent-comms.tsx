"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, Bot, MessageCircle } from "lucide-react";

import type { AgentMessage } from "@/lib/monitor/types";

const TYPE_COLORS: Record<AgentMessage["type"], { line: string; label: string; bg: string }> = {
  request:    { line: "border-blue-800/50",    label: "text-blue-400",    bg: "bg-blue-950/20" },
  response:   { line: "border-emerald-800/50", label: "text-emerald-400", bg: "bg-emerald-950/20" },
  delegation: { line: "border-violet-800/50",  label: "text-violet-400",  bg: "bg-violet-950/20" },
  result:     { line: "border-amber-800/50",   label: "text-amber-400",   bg: "bg-amber-950/20" },
  error:      { line: "border-red-800/50",     label: "text-red-400",     bg: "bg-red-950/20" },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export default function AgentComms({ messages }: { messages: AgentMessage[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-stone-100">Agent Communications</h2>
        </div>
        <span className="text-xs text-stone-500">{messages.length} messages</span>
      </div>

      <div className="mt-4 max-h-[400px] overflow-y-auto space-y-1.5 pr-1">
        {messages.length === 0 ? (
          <div className="py-8 text-center text-stone-600">
            <MessageCircle className="mx-auto h-8 w-8 opacity-50" />
            <p className="mt-2 text-sm">No agent communications</p>
          </div>
        ) : (
          [...messages].map((msg) => {
            const tc = TYPE_COLORS[msg.type] || TYPE_COLORS.request;

            return (
              <div key={msg.id} className={`rounded-md border ${tc.line} ${tc.bg} px-3 py-2`}>
                <div className="flex items-center gap-2 text-xs">
                  <div className="flex items-center gap-1">
                    <Bot className="h-3 w-3 text-stone-500" />
                    <span className="font-medium text-stone-300">{msg.fromAgentName}</span>
                  </div>
                  <ArrowRight className={`h-3 w-3 ${tc.label}`} />
                  <div className="flex items-center gap-1">
                    <Bot className="h-3 w-3 text-stone-500" />
                    <span className="font-medium text-stone-300">{msg.toAgentName}</span>
                  </div>
                  <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${tc.label}`}>
                    {msg.type}
                  </span>
                  <span className="ml-auto text-[10px] text-stone-600 tabular-nums">
                    {msg.tokenCount && <span className="mr-2">{msg.tokenCount} tok</span>}
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-stone-400 whitespace-pre-wrap break-words">
                  {msg.content.length > 300 ? `${msg.content.slice(0, 300)}...` : msg.content}
                </p>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
