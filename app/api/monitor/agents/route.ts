import { NextRequest, NextResponse } from "next/server";

import {
  getAllAgents,
  getAgentDashboard,
  registerAgent,
  removeAgent,
  updateAgentStatus,
  updateAgentTokens,
} from "@/lib/monitor/agents";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const full = request.nextUrl.searchParams.get("full") === "1";

    if (full) {
      const dashboard = await getAgentDashboard();
      return NextResponse.json(dashboard);
    }

    const agents = await getAllAgents();
    return NextResponse.json({ agents });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "register": {
        const { id, name, model, provider, role, parentId, status } = body;
        if (!id || !name || !model) {
          return NextResponse.json({ error: "Missing id, name, or model" }, { status: 400 });
        }
        const agent = await registerAgent({
          id,
          name,
          model,
          provider: provider || "anthropic",
          status: status || "idle",
          role,
          parentId,
        });
        return NextResponse.json(agent, { status: 201 });
      }

      case "status": {
        const { agentId, status } = body;
        if (!agentId || !status) {
          return NextResponse.json({ error: "Missing agentId or status" }, { status: 400 });
        }
        await updateAgentStatus(agentId, status);
        return NextResponse.json({ ok: true });
      }

      case "tokens": {
        const { agentId, tokens, cost } = body;
        if (!agentId || !tokens) {
          return NextResponse.json({ error: "Missing agentId or tokens" }, { status: 400 });
        }
        await updateAgentTokens(agentId, tokens, cost || 0);
        return NextResponse.json({ ok: true });
      }

      case "remove": {
        const { agentId } = body;
        if (!agentId) {
          return NextResponse.json({ error: "Missing agentId" }, { status: 400 });
        }
        await removeAgent(agentId);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
