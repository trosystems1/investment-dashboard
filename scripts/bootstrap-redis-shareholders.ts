import "dotenv/config";
import * as fs from "fs";
import { saveShareholderRecord } from "../lib/edinet-shareholders-store";

async function main() {
  const data = JSON.parse(fs.readFileSync("watchlist-shareholders.json", "utf-8"));

  for (const item of data) {
    if (!item.docID) {
      console.log("スキップ(docIDなし):", item.secCode, item.name);
      continue;
    }
    await saveShareholderRecord({
      secCode: item.secCode,
      name: item.name,
      filerName: item.filerName,
      docID: item.docID,
      submitDateTime: item.submitDateTime,
      shareholders: item.shareholders || [],
      updatedAt: new Date().toISOString(),
    });
    console.log("Redisに保存:", item.secCode, item.filerName);
  }

  console.log("完了");
}

main();
