import { getRedis } from "@/lib/redis";

import type { Alert, AlertRule, AlertSeverity, AlertStatus } from "./types";

const ALERT_PREFIX = "m:alert:";
const ALERT_RULE_PREFIX = "m:rule:";
const ALERT_INDEX = "m:alerts";
const RULE_INDEX = "m:rules";

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createAlert(params: {
  severity: AlertSeverity;
  title: string;
  message: string;
  source: string;
}): Promise<Alert> {
  const redis = getRedis();
  const id = generateId();
  const now = new Date().toISOString();

  const alert: Alert = {
    id,
    severity: params.severity,
    status: "active",
    title: params.title,
    message: params.message,
    source: params.source,
    createdAt: now,
    updatedAt: now,
  };

  const pipe = redis.pipeline();
  pipe.set(`${ALERT_PREFIX}${id}`, JSON.stringify(alert));
  pipe.lpush(ALERT_INDEX, id);
  pipe.ltrim(ALERT_INDEX, 0, 499);
  await pipe.exec();

  return alert;
}

export async function getAlerts(options?: {
  status?: AlertStatus;
  severity?: AlertSeverity;
  limit?: number;
}): Promise<Alert[]> {
  const redis = getRedis();
  const limit = options?.limit || 50;
  const ids: string[] = await redis.lrange(ALERT_INDEX, 0, limit * 2);

  if (ids.length === 0) return [];

  const pipe = redis.pipeline();
  for (const id of ids) {
    pipe.get(`${ALERT_PREFIX}${id}`);
  }
  const results = await pipe.exec();

  const alerts: Alert[] = [];
  for (const raw of results) {
    if (!raw) continue;
    try {
      const alert: Alert = typeof raw === "string" ? JSON.parse(raw) : raw as Alert;
      if (options?.status && alert.status !== options.status) continue;
      if (options?.severity && alert.severity !== options.severity) continue;
      alerts.push(alert);
      if (alerts.length >= limit) break;
    } catch {
      // skip
    }
  }

  return alerts;
}

export async function updateAlert(
  id: string,
  update: Partial<Pick<Alert, "status" | "acknowledgedAt" | "resolvedAt">>,
): Promise<Alert | null> {
  const redis = getRedis();
  const raw = await redis.get<string>(`${ALERT_PREFIX}${id}`);
  if (!raw) return null;

  const alert: Alert = typeof raw === "string" ? JSON.parse(raw) : raw as Alert;
  const updated: Alert = { ...alert, ...update, updatedAt: new Date().toISOString() };

  await redis.set(`${ALERT_PREFIX}${id}`, JSON.stringify(updated));
  return updated;
}

export async function acknowledgeAlert(id: string): Promise<Alert | null> {
  return updateAlert(id, { status: "acknowledged", acknowledgedAt: new Date().toISOString() });
}

export async function resolveAlert(id: string): Promise<Alert | null> {
  return updateAlert(id, { status: "resolved", resolvedAt: new Date().toISOString() });
}

export async function createAlertRule(rule: Omit<AlertRule, "id">): Promise<AlertRule> {
  const redis = getRedis();
  const id = generateId();
  const alertRule: AlertRule = { id, ...rule };

  const pipe = redis.pipeline();
  pipe.set(`${ALERT_RULE_PREFIX}${id}`, JSON.stringify(alertRule));
  pipe.sadd(RULE_INDEX, id);
  await pipe.exec();

  return alertRule;
}

export async function getAlertRules(): Promise<AlertRule[]> {
  const redis = getRedis();
  const ids: string[] = await redis.smembers(RULE_INDEX);
  if (ids.length === 0) return [];

  const pipe = redis.pipeline();
  for (const id of ids) {
    pipe.get(`${ALERT_RULE_PREFIX}${id}`);
  }
  const results = await pipe.exec();

  const rules: AlertRule[] = [];
  for (const raw of results) {
    if (!raw) continue;
    try {
      rules.push(typeof raw === "string" ? JSON.parse(raw) : raw as AlertRule);
    } catch {
      // skip
    }
  }
  return rules;
}

export async function deleteAlertRule(id: string): Promise<boolean> {
  const redis = getRedis();
  const pipe = redis.pipeline();
  pipe.del(`${ALERT_RULE_PREFIX}${id}`);
  pipe.srem(RULE_INDEX, id);
  const results = await pipe.exec();
  return (results[0] as number) > 0;
}

export async function evaluateAlertRules(
  currentMetrics: Record<string, number>,
): Promise<Alert[]> {
  const rules = await getAlertRules();
  const triggered: Alert[] = [];

  for (const rule of rules) {
    if (!rule.isEnabled) continue;
    const value = currentMetrics[rule.metric];
    if (value === undefined) continue;

    let fire = false;
    switch (rule.condition) {
      case "gt": fire = value > rule.threshold; break;
      case "lt": fire = value < rule.threshold; break;
      case "eq": fire = value === rule.threshold; break;
      case "gte": fire = value >= rule.threshold; break;
      case "lte": fire = value <= rule.threshold; break;
    }

    if (fire) {
      const alert = await createAlert({
        severity: rule.severity,
        title: `Alert: ${rule.name}`,
        message: `${rule.metric} = ${value} (${rule.condition} ${rule.threshold})`,
        source: rule.metric,
      });
      triggered.push(alert);
    }
  }

  return triggered;
}
