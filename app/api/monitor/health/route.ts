import { NextResponse } from "next/server";

import { getHealthReport } from "@/lib/monitor/health";
import { monitor } from "@/lib/monitor/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const report = await getHealthReport();
    await monitor.info(`Health: ${report.status}`, "health").catch(() => {});
    return NextResponse.json(report, { status: report.status === "healthy" ? 200 : 503 });
  } catch (err) {
    return NextResponse.json(
      { status: "down", uptime: 0, timestamp: new Date().toISOString(), version: "1.0.0", checks: { redis: "down", services: [] }, error: String(err) },
      { status: 503 },
    );
  }
}
