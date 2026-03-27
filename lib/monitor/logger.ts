import { getRedis } from "@/lib/redis";

import type { LogEntry } from "./types";

const LOG_KEY = "m:logs";
const MAX_LOGS = 500;
const RETENTION_SECONDS = parseInt(process.env.MONITOR_RETENTION_HOURS || "72", 10) * 3600;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function log(
  level: LogEntry["level"],
  message: string,
  service: string,
  meta?: Record<string, unknown>,
): Promise<LogEntry> {
  const redis = getRedis();
  const entry: LogEntry = {
    id: generateId(),
    level,
    message,
    service,
    timestamp: new Date().toISOString(),
    meta,
    requestId: meta?.requestId as string | undefined,
  };

  const pipe = redis.pipeline();
  pipe.lpush(LOG_KEY, JSON.stringify(entry));
  pipe.ltrim(LOG_KEY, 0, MAX_LOGS - 1);
  pipe.expire(LOG_KEY, RETENTION_SECONDS);
  await pipe.exec();

  return entry;
}

export async function getLogs(options?: {
  level?: LogEntry["level"];
  service?: string;
  limit?: number;
  search?: string;
}): Promise<LogEntry[]> {
  const redis = getRedis();
  const limit = options?.limit || 100;
  const raw: string[] = await redis.lrange(LOG_KEY, 0, Math.min(limit * 3, MAX_LOGS) - 1);

  const logs: LogEntry[] = [];
  for (const r of raw) {
    if (logs.length >= limit) break;
    try {
      const entry: LogEntry = typeof r === "string" ? JSON.parse(r) : r;
      if (options?.level && entry.level !== options.level) continue;
      if (options?.service && entry.service !== options.service) continue;
      if (options?.search && !entry.message.toLowerCase().includes(options.search.toLowerCase())) continue;
      logs.push(entry);
    } catch {
      // skip
    }
  }
  return logs;
}

export async function clearLogs(): Promise<void> {
  const redis = getRedis();
  await redis.del(LOG_KEY);
}

export async function getLogCount(): Promise<number> {
  const redis = getRedis();
  return await redis.llen(LOG_KEY);
}

export const monitor = {
  debug: (msg: string, svc: string, meta?: Record<string, unknown>) => log("debug", msg, svc, meta),
  info: (msg: string, svc: string, meta?: Record<string, unknown>) => log("info", msg, svc, meta),
  warn: (msg: string, svc: string, meta?: Record<string, unknown>) => log("warn", msg, svc, meta),
  error: (msg: string, svc: string, meta?: Record<string, unknown>) => log("error", msg, svc, meta),
};
