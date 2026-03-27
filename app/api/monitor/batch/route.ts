import { NextRequest, NextResponse } from "next/server";

import {
  addAgentMessage,
  addThinkingStep,
  registerAgent,
  updateAgentStatus,
  updateAgentTokens,
} from "@/lib/monitor/agents";

export const dynamic = "force-dynamic";

interface BatchOp {
  op: "register" | "status" | "tokens" | "thinking" | "comm";
  data: Record<string, unknown>;
}

/**
 * Batch endpoint — accept multiple operations in a single HTTP call.
 * This is the fast path: one round-trip instead of N.
 */
export async function POST(request: NextRequest) {
  try {
    const body: BatchOp[] = await request.json();

    if (!Array.isArray(body)) {
      return NextResponse.json({ error: "Body must be an array of operations" }, { status: 400 });
    }

    const results = await Promise.allSettled(
      body.map((op) => {
        switch (op.op) {
          case "register":
            return registerAgent({
              id: op.data.id as string,
              name: op.data.name as string,
              model: op.data.model as string,
              provider: (op.data.provider as string) || "anthropic",
              status: (op.data.status as "idle") || "idle",
              role: op.data.role as string | undefined,
              parentId: op.data.parentId as string | undefined,
            });

          case "status":
            return updateAgentStatus(
              op.data.agentId as string,
              op.data.status as "idle",
            );

          case "tokens":
            return updateAgentTokens(
              op.data.agentId as string,
              op.data.tokens as Record<string, number>,
              (op.data.cost as number) || 0,
            );

          case "thinking":
            return addThinkingStep({
              agentId: op.data.agentId as string,
              agentName: op.data.agentName as string,
              model: op.data.model as string,
              type: op.data.type as "thinking",
              content: op.data.content as string,
              tokenCount: op.data.tokenCount as number | undefined,
              durationMs: op.data.durationMs as number | undefined,
              timestamp: new Date().toISOString(),
              metadata: op.data.metadata as Record<string, unknown> | undefined,
            });

          case "comm":
            return addAgentMessage({
              fromAgentId: op.data.fromAgentId as string,
              fromAgentName: op.data.fromAgentName as string,
              toAgentId: op.data.toAgentId as string,
              toAgentName: op.data.toAgentName as string,
              type: op.data.type as "request",
              content: op.data.content as string,
              tokenCount: op.data.tokenCount as number | undefined,
              timestamp: new Date().toISOString(),
            });

          default:
            return Promise.reject(new Error(`Unknown op: ${op.op}`));
        }
      }),
    );

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({ ok, failed, total: body.length }, { status: 200 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
