import { getRedis } from "@/lib/redis";

import type { Metric, MetricPoint, MetricSeries } from "./types";

const METRIC_PREFIX = "m:metric:";
const LATEST_KEY = "m:metric:latest";
const RETENTION_SECONDS = parseInt(process.env.MONITOR_RETENTION_HOURS || "72", 10) * 3600;
const MAX_POINTS = 500;

export async function recordMetric(metric: Metric): Promise<void> {
  const redis = getRedis();
  const key = `${METRIC_PREFIX}${metric.name}`;
  const point: MetricPoint = {
    timestamp: metric.timestamp || new Date().toISOString(),
    value: metric.value,
  };

  const pipe = redis.pipeline();
  pipe.lpush(key, JSON.stringify(point));
  pipe.ltrim(key, 0, MAX_POINTS - 1);
  pipe.expire(key, RETENTION_SECONDS);
  pipe.hset(LATEST_KEY, { [metric.name]: JSON.stringify(metric) });
  await pipe.exec();
}

export async function recordMetrics(metrics: Metric[]): Promise<void> {
  const redis = getRedis();
  const pipe = redis.pipeline();

  const latestMap: Record<string, string> = {};

  for (const metric of metrics) {
    const key = `${METRIC_PREFIX}${metric.name}`;
    const point: MetricPoint = {
      timestamp: metric.timestamp || new Date().toISOString(),
      value: metric.value,
    };

    pipe.lpush(key, JSON.stringify(point));
    pipe.ltrim(key, 0, MAX_POINTS - 1);
    pipe.expire(key, RETENTION_SECONDS);
    latestMap[metric.name] = JSON.stringify(metric);
  }

  pipe.hset(LATEST_KEY, latestMap);
  await pipe.exec();
}

export async function getMetricSeries(
  name: string,
  limit: number = 60,
): Promise<MetricSeries> {
  const redis = getRedis();
  const key = `${METRIC_PREFIX}${name}`;
  const raw: string[] = await redis.lrange(key, 0, limit - 1);

  const points: MetricPoint[] = raw
    .map((r) => {
      try {
        return typeof r === "string" ? JSON.parse(r) : r;
      } catch {
        return null;
      }
    })
    .filter((p): p is MetricPoint => p !== null)
    .reverse();

  const values = points.map((p) => p.value);
  const current = values.length > 0 ? values[values.length - 1] : 0;
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;
  const avg = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  return { name, points, current, min, max, avg };
}

export async function getAllMetricNames(): Promise<string[]> {
  const redis = getRedis();
  const latest = await redis.hgetall<Record<string, string>>(LATEST_KEY);
  return latest ? Object.keys(latest) : [];
}

export async function getLatestMetrics(): Promise<Record<string, Metric>> {
  const redis = getRedis();
  const latest = await redis.hgetall<Record<string, string>>(LATEST_KEY);
  if (!latest) return {};

  const result: Record<string, Metric> = {};
  for (const [name, raw] of Object.entries(latest)) {
    try {
      result[name] = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      // skip
    }
  }
  return result;
}

export async function recordSystemMetrics(): Promise<void> {
  const now = new Date().toISOString();
  const mem = process.memoryUsage();

  await recordMetrics([
    { name: "system.heap_used", type: "gauge", value: Math.round(mem.heapUsed / 1024 / 1024), unit: "MB", timestamp: now },
    { name: "system.heap_total", type: "gauge", value: Math.round(mem.heapTotal / 1024 / 1024), unit: "MB", timestamp: now },
    { name: "system.rss", type: "gauge", value: Math.round(mem.rss / 1024 / 1024), unit: "MB", timestamp: now },
    { name: "system.uptime", type: "gauge", value: Math.round(process.uptime()), unit: "sec", timestamp: now },
  ]);
}
