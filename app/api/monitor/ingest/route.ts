import { NextRequest, NextResponse } from "next/server";

import { recordMetric, recordMetrics } from "@/lib/monitor/collector";
import type { Metric } from "@/lib/monitor/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");
    const expectedKey = process.env.MONITOR_API_KEY;
    if (expectedKey && apiKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    if (Array.isArray(body)) {
      const metrics: Metric[] = body.map((m: Partial<Metric>) => ({
        ...m,
        timestamp: m.timestamp || new Date().toISOString(),
      })) as Metric[];
      await recordMetrics(metrics);
      return NextResponse.json({ ingested: metrics.length }, { status: 201 });
    }

    await recordMetric({ ...body, timestamp: body.timestamp || new Date().toISOString() });
    return NextResponse.json({ ingested: 1 }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
