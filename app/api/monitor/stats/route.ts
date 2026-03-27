import { NextResponse } from "next/server";

import { getRedis, isRedisConnected } from "@/lib/redis";
import { getLogCount } from "@/lib/monitor/logger";
import type { RedisStats } from "@/lib/monitor/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const connected = await isRedisConnected();

    if (!connected) {
      return NextResponse.json({
        connected: false,
        keyCount: 0,
        metricsCount: 0,
        alertsCount: 0,
        logsCount: 0,
      } satisfies RedisStats);
    }

    const redis = getRedis();
    const [keyCount, metricsRaw, alertsCount, logsCount] = await Promise.all([
      redis.dbsize(),
      redis.hlen("m:metric:latest"),
      redis.llen("m:alerts"),
      getLogCount(),
    ]);

    return NextResponse.json({
      connected: true,
      keyCount,
      metricsCount: metricsRaw,
      alertsCount,
      logsCount,
    } satisfies RedisStats);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
