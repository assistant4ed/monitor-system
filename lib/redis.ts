import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

export function getRedis(): Redis {
  if (redis) return redis;

  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  return redis;
}

export async function isRedisConnected(): Promise<boolean> {
  try {
    const client = getRedis();
    await client.ping();
    return true;
  } catch {
    return false;
  }
}

export async function getRedisInfo(): Promise<Record<string, string>> {
  const client = getRedis();
  const dbsize = await client.dbsize();
  const connected = await isRedisConnected();

  return {
    connected: String(connected),
    dbsize: String(dbsize),
  };
}
