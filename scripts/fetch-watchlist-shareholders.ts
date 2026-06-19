import "dotenv/config";
import * as fs from "fs";
import {
  fetchDocumentList,
  findYuhoForSecCodes,
  fetchMajorShareholders,
  EdinetDocMeta,
} from "../lib/edinet-fetch";

const WATCHLIST = [
  { secCode: "228A0", name: "オプロ" },
  { secCode: "43970", name: "チームスピリット" },
  { secCode: "43740", name: "ROBOT PAYMENT" },
  { secCode: "431A0", name: "uSonar" },
  { secCode: "44430", name: "Sansan" },
  { secCode: "44780", name: "freee" },
  { secCode: "39940", name: "マネーフォワード" },
  { secCode: "47760", name: "サイボウズ" },
  { secCode: "40580", name: "トヨクモ" },
  { secCode: "48110", name: "ドリーム・アーツ" },
];

function formatDateJST(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

async function main() {
  const remaining = new Set(WATCHLIST.map((w) => w.secCode));
  const found: Record<string, EdinetDocMeta> = {};
  const SCAN_DAYS = 400; // 決算期のズレをカバーするため1年強スキャン

  for (let i = 0; i < SCAN_DAYS && remaining.size > 0; i++) {
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
          console.log("見つかりました:", doc.filerName, doc.secCode, dateStr, doc.docID);
        }
      }
    } catch (e) {
      console.error("date=" + dateStr + " error:", e);
    }

    if (i % 30 === 0) {
      console.log("..." + i + "日分スキャン済み。残り" + remaining.size + "社");
    }
    await sleep(150);
  }

  if (remaining.size > 0) {
    console.log("見つからなかった銘柄:", Array.from(remaining).join(", "));
  }

  const results: any[] = [];
  for (const w of WATCHLIST) {
    const doc = found[w.secCode];
    if (!doc) {
      results.push({ secCode: w.secCode, name: w.name, status: "not_found" });
      continue;
    }
    try {
      const shareholders = await fetchMajorShareholders(doc.docID);
      results.push({
        secCode: w.secCode,
        name: w.name,
        filerName: doc.filerName,
        docID: doc.docID,
        submitDateTime: doc.submitDateTime,
        shareholders,
      });
      console.log("大株主取得完了:", doc.filerName);
    } catch (e) {
      results.push({ secCode: w.secCode, name: w.name, status: "parse_error", error: String(e) });
    }
    await sleep(300);
  }

  fs.writeFileSync("watchlist-shareholders.json", JSON.stringify(results, null, 2));
  console.log("完了: watchlist-shareholders.json に保存しました");
}

main();
