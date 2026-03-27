"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, DollarSign, TrendingUp, Zap } from "lucide-react";

import type { TokenSnapshot, TokenUsage } from "@/lib/monitor/types";

import Sparkline from "./sparkline";

function formatTokens(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

interface TokenCounterProps {
  tokens: TokenUsage;
  costUsd: number;
  tokensPerSecond: number;
  history: TokenSnapshot[];
}

function AnimatedNumber({ value, className }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef(value);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = value;
    if (prev === value) return;

    const diff = value - prev;
    const steps = 20;
    const stepSize = diff / steps;
    let step = 0;

    const interval = setInterval(() => {
      step++;
      if (step >= steps) {
        setDisplay(value);
        clearInterval(interval);
      } else {
        setDisplay(Math.round(prev + stepSize * step));
      }
    }, 50);

    return () => clearInterval(interval);
  }, [value]);

  return <span className={className}>{formatTokens(display)}</span>;
}

export default function TokenCounter({ tokens, costUsd, tokensPerSecond, history }: TokenCounterProps) {
  const inputHistory = history.map((h) => h.tokens.input);
  const outputHistory = history.map((h) => h.tokens.output);
  const totalHistory = history.map((h) => h.tokens.total);

  return (
    <div className="rounded-lg border border-stone-800 bg-stone-900/50 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-stone-100">Token Usage</h2>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
            tokensPerSecond > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-stone-500/10 text-stone-500"
          }`}>
            <TrendingUp className="h-3 w-3" />
            <span className="tabular-nums">{tokensPerSecond}</span>
            <span>tok/s</span>
          </div>
        </div>
      </div>

      {/* Main counter */}
      <div className="mt-4 flex items-end gap-3">
        <AnimatedNumber
          value={tokens.total}
          className="text-4xl font-bold tabular-nums text-stone-100"
        />
        <span className="mb-1 text-sm text-stone-500">total tokens</span>
      </div>

      {/* Breakdown */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-md border border-stone-800/50 bg-stone-900/30 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <ArrowDown className="h-3 w-3 text-blue-400" />
            <span className="text-[10px] uppercase text-stone-600">Input</span>
          </div>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-blue-400">
            <AnimatedNumber value={tokens.input} />
          </p>
          {inputHistory.length > 1 && (
            <div className="mt-1">
              <Sparkline data={inputHistory.slice(-30)} width={80} height={16} color="#3b82f6" />
            </div>
          )}
        </div>

        <div className="rounded-md border border-stone-800/50 bg-stone-900/30 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <ArrowUp className="h-3 w-3 text-emerald-400" />
            <span className="text-[10px] uppercase text-stone-600">Output</span>
          </div>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-400">
            <AnimatedNumber value={tokens.output} />
          </p>
          {outputHistory.length > 1 && (
            <div className="mt-1">
              <Sparkline data={outputHistory.slice(-30)} width={80} height={16} color="#22c55e" />
            </div>
          )}
        </div>

        <div className="rounded-md border border-amber-800/30 bg-amber-950/10 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-amber-400" />
            <span className="text-[10px] uppercase text-stone-600">Thinking</span>
          </div>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-amber-400">
            <AnimatedNumber value={tokens.thinking} />
          </p>
        </div>

        <div className="rounded-md border border-stone-800/50 bg-stone-900/30 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase text-stone-600">Cache R/W</span>
          </div>
          <p className="mt-0.5 text-xs tabular-nums text-stone-400">
            {formatTokens(tokens.cacheRead)} / {formatTokens(tokens.cacheWrite)}
          </p>
        </div>

        <div className="rounded-md border border-emerald-800/30 bg-emerald-950/10 px-3 py-2">
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3 w-3 text-emerald-400" />
            <span className="text-[10px] uppercase text-stone-600">Cost</span>
          </div>
          <p className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-400">
            ${costUsd.toFixed(4)}
          </p>
        </div>
      </div>

      {/* Total sparkline */}
      {totalHistory.length > 1 && (
        <div className="mt-3 rounded-md border border-stone-800/50 bg-stone-950 p-2">
          <Sparkline data={totalHistory.slice(-60)} width={600} height={40} color="#a78bfa" />
        </div>
      )}
    </div>
  );
}
