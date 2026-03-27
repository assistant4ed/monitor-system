import { NextRequest, NextResponse } from "next/server";

import { getAllMetricNames, getLatestMetrics, getMetricSeries, recordSystemMetrics } from "@/lib/monitor/collector";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const name = searchParams.get("name");
    const limit = parseInt(searchParams.get("limit") || "60", 10);

    await recordSystemMetrics();

    if (name) {
      const series = await getMetricSeries(name, limit);
      return NextResponse.json(series);
    }

    const [names, latest] = await Promise.all([getAllMetricNames(), getLatestMetrics()]);
    return NextResponse.json({ names, latest });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
