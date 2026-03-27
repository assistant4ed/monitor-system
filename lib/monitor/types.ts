export type ServiceStatus = "healthy" | "degraded" | "down" | "unknown";
export type AlertSeverity = "critical" | "warning" | "info";
export type AlertStatus = "active" | "acknowledged" | "resolved";
export type MetricType = "counter" | "gauge" | "histogram";

// ─── Agent types ──────────────────────────────────────────

export type AgentStatus = "idle" | "thinking" | "responding" | "tool_use" | "error" | "offline";

export interface AgentInfo {
  id: string;
  name: string;
  model: string;
  provider: string;
  status: AgentStatus;
  role?: string;
  parentId?: string;
  createdAt: string;
  lastActiveAt: string;
  tokens: TokenUsage;
  costUsd: number;
  requestCount: number;
}

export interface TokenUsage {
  input: number;
  output: number;
  thinking: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
}

export interface TokenSnapshot {
  timestamp: string;
  agentId: string;
  tokens: TokenUsage;
  costUsd: number;
  deltaInput: number;
  deltaOutput: number;
  deltaThinking: number;
}

export interface ThinkingStep {
  id: string;
  agentId: string;
  agentName: string;
  model: string;
  type: "thinking" | "response" | "tool_call" | "tool_result" | "error" | "system";
  content: string;
  tokenCount?: number;
  durationMs?: number;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AgentMessage {
  id: string;
  fromAgentId: string;
  fromAgentName: string;
  toAgentId: string;
  toAgentName: string;
  type: "request" | "response" | "delegation" | "result" | "error";
  content: string;
  tokenCount?: number;
  timestamp: string;
}

export interface AgentDashboardData {
  agents: AgentInfo[];
  totalTokens: TokenUsage;
  totalCostUsd: number;
  tokenHistory: TokenSnapshot[];
  thinkingFlow: ThinkingStep[];
  communications: AgentMessage[];
  tokensPerSecond: number;
}

// ─── Existing types ───────────────────────────────────────

export interface ServiceCheck {
  name: string;
  url: string;
  method?: "GET" | "POST" | "HEAD";
  expectedStatus?: number;
  timeoutMs?: number;
}

export interface ServiceResult {
  name: string;
  url: string;
  status: ServiceStatus;
  responseTimeMs: number;
  statusCode: number | null;
  lastChecked: string;
  error?: string;
}

export interface MetricPoint {
  timestamp: string;
  value: number;
}

export interface Metric {
  name: string;
  type: MetricType;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
  timestamp: string;
}

export interface MetricSeries {
  name: string;
  points: MetricPoint[];
  current: number;
  min: number;
  max: number;
  avg: number;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  message: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface LogEntry {
  id: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  service: string;
  timestamp: string;
  meta?: Record<string, unknown>;
  requestId?: string;
}

export interface HealthReport {
  status: ServiceStatus;
  uptime: number;
  timestamp: string;
  version: string;
  checks: {
    redis: ServiceStatus;
    services: ServiceResult[];
  };
}

export interface RedisStats {
  connected: boolean;
  keyCount: number;
  metricsCount: number;
  alertsCount: number;
  logsCount: number;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: "gt" | "lt" | "eq" | "gte" | "lte";
  threshold: number;
  severity: AlertSeverity;
  windowSeconds: number;
  isEnabled: boolean;
}
