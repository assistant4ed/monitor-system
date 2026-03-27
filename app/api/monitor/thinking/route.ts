import { NextRequest, NextResponse } from "next/server";

import { addThinkingStep, getThinkingFlow } from "@/lib/monitor/agents";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "100", 10);
    const steps = await getThinkingFlow(limit);
    return NextResponse.json({ steps, total: steps.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, agentName, model, type, content, tokenCount, durationMs, metadata } = body;

    if (!agentId || !agentName || !type || !content) {
      return NextResponse.json({ error: "Missing agentId, agentName, type, or content" }, { status: 400 });
    }

    const step = await addThinkingStep({
      agentId,
      agentName,
      model: model || "unknown",
      type,
      content,
      tokenCount,
      durationMs,
      timestamp: new Date().toISOString(),
      metadata,
    });

    return NextResponse.json(step, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
