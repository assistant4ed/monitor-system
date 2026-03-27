import { isRedisConnected } from "@/lib/redis";

import { recordMetric } from "./collector";
import type { HealthReport, ServiceCheck, ServiceResult, ServiceStatus } from "./types";

const START_TIME = Date.now();

export function getMonitoredServices(): ServiceCheck[] {
  const raw = process.env.MONITOR_SERVICES || "";
  if (!raw.trim()) return [];

  return raw
    .split(",")
    .filter((u) => u.trim())
    .map((url, i) => {
      const trimmed = url.trim();
      const hostname = new URL(trimmed).hostname;
      return {
        name: hostname,
        url: trimmed,
        expectedStatus: 200,
        timeoutMs: 8000,
      };
    });
}

export async function checkService(service: ServiceCheck): Promise<ServiceResult> {
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), service.timeoutMs || 8000);

    const res = await fetch(service.url, {
      method: service.method || "GET",
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);
    const responseTimeMs = Date.now() - start;
    const expected = service.expectedStatus || 200;

    const result: ServiceResult = {
      name: service.name,
      url: service.url,
      status: res.status === expected ? "healthy" : res.status >= 500 ? "down" : "degraded",
      responseTimeMs,
      statusCode: res.status,
      lastChecked: new Date().toISOString(),
    };

    await recordMetric({
      name: `svc.${service.name}.latency`,
      type: "gauge",
      value: responseTimeMs,
      unit: "ms",
      timestamp: result.lastChecked,
    }).catch(() => {});

    return result;
  } catch (err) {
    return {
      name: service.name,
      url: service.url,
      status: "down",
      responseTimeMs: Date.now() - start,
      statusCode: null,
      lastChecked: new Date().toISOString(),
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function checkAllServices(): Promise<ServiceResult[]> {
  const services = getMonitoredServices();
  if (services.length === 0) return [];

  const results = await Promise.allSettled(services.map(checkService));

  return results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { name: "unknown", url: "", status: "down" as ServiceStatus, responseTimeMs: 0, statusCode: null, lastChecked: new Date().toISOString(), error: "Check failed" },
  );
}

function aggregateStatus(statuses: ServiceStatus[]): ServiceStatus {
  if (statuses.length === 0) return "healthy";
  if (statuses.some((s) => s === "down")) return "down";
  if (statuses.some((s) => s === "degraded")) return "degraded";
  return "healthy";
}

export async function getHealthReport(): Promise<HealthReport> {
  const [redisOk, serviceResults] = await Promise.all([
    isRedisConnected(),
    checkAllServices(),
  ]);

  const redisStatus: ServiceStatus = redisOk ? "healthy" : "down";
  const allStatuses = [redisStatus, ...serviceResults.map((s) => s.status)];

  return {
    status: aggregateStatus(allStatuses),
    uptime: Math.round((Date.now() - START_TIME) / 1000),
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    checks: {
      redis: redisStatus,
      services: serviceResults,
    },
  };
}
