// lib/edinet-fetch.ts
// EDINET API (v2) から有価証券報告書の「大株主の状況」を取得・構造化する。
//
// 必要パッケージ:
//   npm install jszip cheerio
//
// 必要な環境変数:
//   EDINET_API_KEY  ... https://api.edinet-fsa.go.jp で発行するAPIキー
//                       （J-Quantsとは別のキー。会員登録が必要）

import JSZip from "jszip";
import * as cheerio from "cheerio";

const EDINET_BASE = "https://api.edinet-fsa.go.jp/api/v2";
const DOC_TYPE_YUHO = "120"; // 有価証券報告書のdocTypeCode

export interface EdinetDocMeta {
  docID: string;
  edinetCode: string;
  secCode: string | null; // 5桁・末尾0付き（例: "44780"）。J-Quantsと同じ表記。
  filerName: string;
  docTypeCode: string;
  docDescription: string;
  submitDateTime: string;
}

export interface MajorShareholder {
  rank: number;
  name: string;
  address: string | null;
  sharesHeldRaw: string; // 原文ママ（株/千株が会社によって混在するため生値を保持）
  sharesHeld: number | null;
  ratioPct: number | null; // 発行済株式に対する割合（%）
}

function getApiKey(): string {
  const key = process.env.EDINET_API_KEY;
  if (!key) throw new Error("EDINET_API_KEY is not set");
  return key;
}

/**
 * 指定日に提出された書類の一覧を取得する。
 * type=2 は「提出書類一覧及びメタデータ」。
 *
 * EDINETには「会社名で書類を検索するAPI」は無いため、
 * 日付ごとに全件取得してsecCodeでフィルタする方式になる。
 */
export async function fetchDocumentList(date: string): Promise<EdinetDocMeta[]> {
  const url = `${EDINET_BASE}/documents.json?date=${date}&type=2&Subscription-Key=${getApiKey()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`EDINET documents.json failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return (json.results ?? []) as EdinetDocMeta[];
}

/**
 * 指定したsecCode群に該当する有価証券報告書(docTypeCode=120)を
 * 書類一覧から絞り込む。
 */
export function findYuhoForSecCodes(
  docs: EdinetDocMeta[],
  secCodes: string[]
): EdinetDocMeta[] {
  return docs.filter(
    (d) => d.docTypeCode === DOC_TYPE_YUHO && d.secCode && secCodes.includes(d.secCode)
  );
}

/**
 * docIDからXBRL本体のZIPをダウンロードして展開する。
 * type=1 はXBRL本体。
 */
async function downloadXbrlZip(docID: string): Promise<JSZip> {
  const url = `${EDINET_BASE}/documents/${docID}?type=1&Subscription-Key=${getApiKey()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`EDINET document download failed: ${res.status} ${res.statusText}`);
  }
  const buf = await res.arrayBuffer();
  return JSZip.loadAsync(buf);
}

/**
 * ZIP内のXBRLインスタンスファイル（XBRL/PublicDoc/*.xbrl）を読み込む。
 */
async function readXbrlInstanceText(zip: JSZip): Promise<string> {
  const entry = Object.values(zip.files).find(
    (f) => f.name.includes("/PublicDoc/") && f.name.endsWith(".xbrl")
  );
  if (!entry) {
    throw new Error("XBRL instance file not found in ZIP (expected under PublicDoc/*.xbrl)");
  }
  return entry.async("string");
}

/**
 * XBRLインスタンス文字列から「大株主の状況」(jpcrp_cor:MajorShareholdersTextBlock)
 * のHTMLテーブルを抜き出してパースする。
 *
 * ★重要: このTextBlockはHTMLエスケープされたテーブルがそのままXML要素内に
 * 入っている形式で、列構成・列順は会社によって微妙に異なることがある
 * （住所列の有無、所有株式数の単位が「株」か「千株」かなど）。
 * 本番投入前に実データを確認し、必要なら下記の列マッピングを調整すること。
 */
export function parseMajorShareholders(xbrlText: string): MajorShareholder[] {
  const match = xbrlText.match(
    /<jpcrp_cor:MajorShareholdersTextBlock[^>]*>([\s\S]*?)<\/jpcrp_cor:MajorShareholdersTextBlock>/
  );
  if (!match) return [];

  const decoded = match[1]
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const $ = cheerio.load(decoded);
  const rows = $("table tr").toArray();
  const shareholders: MajorShareholder[] = [];

  // ヘッダー行を探して、列名→列インデックスのマッピングを作る
  let nameIdx = -1;
  let addressIdx = -1;
  let sharesIdx = -1;
  let ratioIdx = -1;
  let headerFound = false;

  for (const row of rows) {
    const cells = $(row)
      .find("td,th")
      .toArray()
      .map((c) => $(c).text().trim().replace(/\s+/g, " "));

    if (!headerFound) {
      const nIdx = cells.findIndex((c) => c.includes("氏名") || c.includes("名称"));
      const aIdx = cells.findIndex((c) => c.includes("住所"));
      const sIdx = cells.findIndex((c) => c.includes("株式数") && !c.includes("割合"));
      const rIdx = cells.findIndex((c) => c.includes("割合") || c.includes("比率"));

      if (nIdx >= 0 && sIdx >= 0) {
        nameIdx = nIdx;
        addressIdx = aIdx;
        sharesIdx = sIdx;
        ratioIdx = rIdx;
        headerFound = true;
        continue; // ヘッダー行自体はデータとして使わない
      }
      continue; // ヘッダーが見つかるまではスキップ
    }

    if (cells.length <= sharesIdx) continue; // 列が足りない行はスキップ
    const name = cells[nameIdx];
    if (!name || name === "計" || name.includes("合計")) continue;

    const sharesRaw = cells[sharesIdx] ?? "";
    const ratioRaw = ratioIdx >= 0 ? cells[ratioIdx] ?? "" : "";

    shareholders.push({
      rank: shareholders.length + 1,
      name,
      address: addressIdx >= 0 ? cells[addressIdx] || null : null,
      sharesHeldRaw: sharesRaw,
      sharesHeld: sharesRaw ? Number(sharesRaw.replace(/[^\d]/g, "")) : null,
      ratioPct: ratioRaw ? Number(ratioRaw.replace(/[^\d.]/g, "")) : null,
    });
  }

  return shareholders;
}

/**
 * docIDから大株主データまでを一気に取得するユーティリティ。
 */
export async function fetchMajorShareholders(docID: string): Promise<MajorShareholder[]> {
  const zip = await downloadXbrlZip(docID);
  const xbrlText = await readXbrlInstanceText(zip);
  return parseMajorShareholders(xbrlText);
}
