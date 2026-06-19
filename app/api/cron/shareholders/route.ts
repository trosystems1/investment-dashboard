import { NextResponse } from 'next/server';
import {
  fetchDocumentList,
  findYuhoForSecCodes,
  fetchMajorShareholders,
  EdinetDocMeta,
} from '@/lib/edinet-fetch';
import { getShareholderRecord, saveShareholderRecord } from '@/lib/edinet-shareholders-store';

export const maxDuration = 60;

// signal-check/route.ts の DEFAULT_TICKERS と同じ10銘柄
const WATCHLIST = [
  { secCode: '228A0', name: 'オプロ' },
  { secCode: '43970', name: 'チームスピリット' },
  { secCode: '43740', name: 'ROBOT PAYMENT' },
  { secCode: '431A0', name: 'uSonar' },
  { secCode: '44430', name: 'Sansan' },
  { secCode: '44780', name: 'freee' },
  { secCode: '39940', name: 'マネーフォワード' },
  { secCode: '47760', name: 'サイボウズ' },
  { secCode: '40580', name: 'トヨクモ' },
  { secCode: '48110', name: 'ドリーム・アーツ' },
];

const RECENT_SCAN_DAYS = 14;

function formatDateJST(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function scanRecent(secCodes: string[]): Promise<Record<string, EdinetDocMeta>> {
  const remaining = new Set(secCodes);
  const found: Record<string, EdinetDocMeta> = {};

  for (let i = 0; i < RECENT_SCAN_DAYS && remaining.size > 0; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = formatDateJST(d);
    try {
      const docs = await fetchDocumentList(dateStr);
      const matches = findYuhoForSecCodes(docs, Array.from(remaining));
      for (const doc of matches) {
        if (doc.secCode && remaining.has(doc.secCode)) {
          found[doc.secCode] = doc;
          remaining.delete(doc.secCode);
        }
      }
    } catch (e) {
      console.error('[shareholders-cron] date=' + dateStr + ' error:', e);
    }
    await sleep(150);
  }

  return found;
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  const cronHeader = req.headers.get('x-vercel-cron');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && cronHeader !== '1') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const secCodes = WATCHLIST.map((w) => w.secCode);

  const prevRecords = await Promise.all(secCodes.map((sc) => getShareholderRecord(sc)));
  const prevDocIds: Record<string, string | undefined> = {};
  secCodes.forEach((sc, i) => {
    prevDocIds[sc] = prevRecords[i]?.docID;
  });

  const found = await scanRecent(secCodes);

  const updated: string[] = [];
  const errors: string[] = [];

  for (const secCode of Object.keys(found)) {
    const doc = found[secCode];
    if (prevDocIds[secCode] === doc.docID) continue; // 変化なし

    try {
      const shareholders = await fetchMajorShareholders(doc.docID);
      const watchlistItem = WATCHLIST.find((w) => w.secCode === secCode)!;
      await saveShareholderRecord({
        secCode,
        name: watchlistItem.name,
        filerName: doc.filerName,
        docID: doc.docID,
        submitDateTime: doc.submitDateTime,
        shareholders,
        updatedAt: new Date().toISOString(),
      });
      updated.push(secCode);
    } catch (e) {
      console.error('[shareholders-cron] 大株主取得失敗:', secCode, e);
      errors.push(secCode);
    }
    await sleep(300);
  }

  // Redisに記録が無い銘柄(新規追加銘柄など)は、ローカルでブートストラップが必要
  const neverFound = secCodes.filter((sc) => !prevDocIds[sc] && !found[sc]);

  return NextResponse.json({ checked: secCodes.length, updated, errors, neverFound });
}
