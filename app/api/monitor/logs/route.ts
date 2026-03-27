import { NextRequest, NextResponse } from "next/server";

import { clearLogs, getLogs, monitor } from "@/lib/monitor/logger";
import type { LogEntry } from "@/lib/monitor/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const logs = await getLogs({
      level: (searchParams.get("level") as LogEntry["level"]) || undefined,
      service: searchParams.get("service") || undefined,
      search: searchParams.get("search") || undefined,
      limit: parseInt(searchParams.get("limit") || "100", 10),
    });
    return NextResponse.json({ logs, total: logs.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { level, message, service, meta } = await request.json();
    if (!level || !message || !service) {
      return NextResponse.json({ error: "Missing level, message, or service" }, { status: 400 });
    }
    const entry = await monitor[level as LogEntry["level"]](message, service, meta);
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await clearLogs();
    return NextResponse.json({ message: "Logs cleared" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
