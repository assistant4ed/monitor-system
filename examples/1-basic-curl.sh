#!/bin/bash
# ─── Basic integration via curl/fetch ──────────────────
# Works from any language, any system. Just HTTP POST.

BASE="https://monitor-system-one.vercel.app"

# 1. Register your agent
curl -X POST "$BASE/api/monitor/agents" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "register",
    "id": "my-agent-1",
    "name": "My AI Agent",
    "model": "claude-opus-4-6",
    "provider": "anthropic",
    "role": "Task automation",
    "status": "idle"
  }'

# 2. Before calling AI: set status to thinking
curl -X POST "$BASE/api/monitor/agents" \
  -H "Content-Type: application/json" \
  -d '{"action": "status", "agentId": "my-agent-1", "status": "thinking"}'

# 3. After AI responds: report tokens
curl -X POST "$BASE/api/monitor/agents" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "tokens",
    "agentId": "my-agent-1",
    "tokens": {
      "input": 1500,
      "output": 800,
      "thinking": 2400,
      "cacheRead": 500
    },
    "cost": 0.0234
  }'

# 4. Log thinking steps
curl -X POST "$BASE/api/monitor/thinking" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "my-agent-1",
    "agentName": "My AI Agent",
    "model": "claude-opus-4-6",
    "type": "thinking",
    "content": "Analyzing the users request. I need to...",
    "tokenCount": 2400,
    "durationMs": 1500
  }'

# 5. Log agent-to-agent communication
curl -X POST "$BASE/api/monitor/comms" \
  -H "Content-Type: application/json" \
  -d '{
    "fromAgentId": "my-agent-1",
    "fromAgentName": "My AI Agent",
    "toAgentId": "sub-agent-1",
    "toAgentName": "Code Writer",
    "type": "delegation",
    "content": "Write the authentication middleware",
    "tokenCount": 340
  }'

# 6. Set back to idle
curl -X POST "$BASE/api/monitor/agents" \
  -H "Content-Type: application/json" \
  -d '{"action": "status", "agentId": "my-agent-1", "status": "idle"}'
