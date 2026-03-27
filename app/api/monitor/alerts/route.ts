import { NextRequest, NextResponse } from "next/server";

import { acknowledgeAlert, createAlert, getAlerts, resolveAlert } from "@/lib/monitor/alerts";
import type { AlertSeverity, AlertStatus } from "@/lib/monitor/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const alerts = await getAlerts({
      status: (searchParams.get("status") as AlertStatus) || undefined,
      severity: (searchParams.get("severity") as AlertSeverity) || undefined,
      limit: parseInt(searchParams.get("limit") || "50", 10),
    });
    return NextResponse.json({ alerts, total: alerts.length });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { severity, title, message, source } = body;
    if (!severity || !title || !message || !source) {
      return NextResponse.json({ error: "Missing required fields: severity, title, message, source" }, { status: 400 });
    }
    const alert = await createAlert({ severity, title, message, source });
    return NextResponse.json(alert, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id, action } = await request.json();
    if (!id || !action) {
      return NextResponse.json({ error: "Missing id or action" }, { status: 400 });
    }

    const alert = action === "acknowledge"
      ? await acknowledgeAlert(id)
      : action === "resolve"
        ? await resolveAlert(id)
        : null;

    if (!alert) {
      return NextResponse.json({ error: "Alert not found or invalid action" }, { status: 404 });
    }
    return NextResponse.json(alert);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
