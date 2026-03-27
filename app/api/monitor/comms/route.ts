import { NextRequest, NextResponse } from "next/server";

import { addAgentMessage, getAgentCommunications } from "@/lib/monitor/agents";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get("limit") || "100", 10);
    const messages = await getAgentCommunications(limit);
    return NextResponse.json({ messages, total: messages.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fromAgentId, fromAgentName, toAgentId, toAgentName, type, content, tokenCount } = body;

    if (!fromAgentId || !fromAgentName || !toAgentId || !toAgentName || !type || !content) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const msg = await addAgentMessage({
      fromAgentId,
      fromAgentName,
      toAgentId,
      toAgentName,
      type,
      content,
      tokenCount,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(msg, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
