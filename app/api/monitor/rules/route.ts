import { NextRequest, NextResponse } from "next/server";

import { createAlertRule, deleteAlertRule, getAlertRules } from "@/lib/monitor/alerts";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rules = await getAlertRules();
    return NextResponse.json({ rules });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, metric, condition, threshold, severity, windowSeconds, isEnabled } = body;
    if (!name || !metric || !condition || threshold === undefined || !severity) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const rule = await createAlertRule({ name, metric, condition, threshold, severity, windowSeconds: windowSeconds || 300, isEnabled: isEnabled !== false });
    return NextResponse.json(rule, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const deleted = await deleteAlertRule(id);
    if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ message: "Deleted" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
