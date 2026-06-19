// lib/edinet-shareholders-store.ts
// 大株主データのRedis読み書き。既存のlib/jquants-fetch.ts等と同じ
// @upstash/redis クライアントパターンを使用。

import { Redis } from '@upstash/redis';
import type { MajorShareholder } from './edinet-fetch';

const redis = Redis.fromEnv();

export interface ShareholderRecord {
  secCode: string;
  name: string;
  filerName: string;
  docID: string;
  submitDateTime: string;
  shareholders: MajorShareholder[];
  updatedAt: string;
}

function key(secCode: string): string {
  return `shareholders:${secCode}`;
}

export async function getShareholderRecord(secCode: string): Promise<ShareholderRecord | null> {
  return redis.get<ShareholderRecord>(key(secCode));
}

export async function getAllShareholderRecords(
  secCodes: string[]
): Promise<Record<string, ShareholderRecord | null>> {
  const results = await Promise.all(secCodes.map((sc) => getShareholderRecord(sc)));
  const out: Record<string, ShareholderRecord | null> = {};
  secCodes.forEach((sc, i) => {
    out[sc] = results[i];
  });
  return out;
}

export async function saveShareholderRecord(record: ShareholderRecord): Promise<void> {
  await redis.set(key(record.secCode), record);
}
