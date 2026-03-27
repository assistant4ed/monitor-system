"""
Python client for the monitor system.
Works with any Python AI framework (anthropic, openai, langchain, etc.)

Install: pip install requests anthropic
Run:     python examples/4-python-client.py
"""

import json
import time
import requests

MONITOR_URL = "https://monitor-system-one.vercel.app"


class MonitorClient:
    def __init__(self, base_url: str, api_key: str | None = None):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key

    def _post(self, path: str, data: dict) -> dict:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["x-api-key"] = self.api_key
        try:
            res = requests.post(f"{self.base_url}{path}", json=data, headers=headers, timeout=5)
            return res.json()
        except Exception as e:
            print(f"[Monitor] {path} failed: {e}")
            return {}

    def register_agent(self, agent_id: str, name: str, model: str, **kwargs):
        return self._post("/api/monitor/agents", {
            "action": "register", "id": agent_id, "name": name, "model": model,
            "provider": kwargs.get("provider", "anthropic"),
            "role": kwargs.get("role"), "parentId": kwargs.get("parent_id"),
            "status": kwargs.get("status", "idle"),
        })

    def set_status(self, agent_id: str, status: str):
        return self._post("/api/monitor/agents", {"action": "status", "agentId": agent_id, "status": status})

    def track_tokens(self, agent_id: str, input_t: int = 0, output_t: int = 0, thinking_t: int = 0, cost: float = 0):
        return self._post("/api/monitor/agents", {
            "action": "tokens", "agentId": agent_id,
            "tokens": {"input": input_t, "output": output_t, "thinking": thinking_t},
            "cost": cost,
        })

    def think(self, agent_id: str, agent_name: str, model: str, step_type: str, content: str, **kwargs):
        return self._post("/api/monitor/thinking", {
            "agentId": agent_id, "agentName": agent_name, "model": model,
            "type": step_type, "content": content,
            "tokenCount": kwargs.get("token_count"), "durationMs": kwargs.get("duration_ms"),
        })

    def comm(self, from_id: str, from_name: str, to_id: str, to_name: str, msg_type: str, content: str):
        return self._post("/api/monitor/comms", {
            "fromAgentId": from_id, "fromAgentName": from_name,
            "toAgentId": to_id, "toAgentName": to_name,
            "type": msg_type, "content": content,
        })


def example_with_anthropic():
    """Example wrapping the Anthropic Python SDK."""
    import anthropic

    monitor = MonitorClient(MONITOR_URL)
    client = anthropic.Anthropic()

    agent_id = "python-agent"
    agent_name = "Python Agent"

    monitor.register_agent(agent_id, agent_name, "claude-sonnet-4-6", role="Python automation")
    monitor.set_status(agent_id, "thinking")

    start = time.time()
    response = client.messages.create(
        model="claude-sonnet-4-6-20250514",
        max_tokens=1024,
        messages=[{"role": "user", "content": "What is Redis?"}],
    )
    duration_ms = int((time.time() - start) * 1000)

    # Report tokens
    usage = response.usage
    monitor.track_tokens(
        agent_id,
        input_t=usage.input_tokens,
        output_t=usage.output_tokens,
        cost=usage.input_tokens * 3e-6 + usage.output_tokens * 15e-6,
    )

    # Report thinking/response
    for block in response.content:
        if block.type == "text":
            monitor.think(agent_id, agent_name, "claude-sonnet-4-6", "response",
                         block.text[:2000], duration_ms=duration_ms)

    monitor.set_status(agent_id, "idle")
    print(f"Done! Check {MONITOR_URL}")


if __name__ == "__main__":
    example_with_anthropic()
