"use client";
import { useState } from "react";
import type { MajorShareholder } from "@/lib/edinet-fetch";

interface MajorShareholdersTableProps {
  companyName: string;
  asOfDate: string; // 提出日時 (例: "2026-02-25 10:30")
  shareholders: MajorShareholder[];
}

export default function MajorShareholdersTable({
  companyName,
  asOfDate,
  shareholders,
}: MajorShareholdersTableProps) {
  const [expanded, setExpanded] = useState(false);
  const asOfDisplay = asOfDate ? asOfDate.split(" ")[0] : "—";

  return (
    <div className="rounded-xl border border-amber-900/30 bg-zinc-950 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-baseline justify-between border-b border-amber-900/30 bg-zinc-900/60 px-5 py-3 text-left cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <span
            className="text-xs text-amber-200 transition-transform duration-200"
            style={{ display: "inline-block", transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            ▸
          </span>
          <h3 className="text-sm font-semibold tracking-wide text-amber-200">
            大株主の状況
          </h3>
        </span>
        <span className="text-xs text-zinc-500">
          {companyName}・{asOfDisplay}時点
        </span>
      </button>
      {expanded && (
        shareholders.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-zinc-500">
            大株主データがありません
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-500">
                <th className="w-10 px-4 py-2 text-left font-medium">順位</th>
                <th className="px-4 py-2 text-left font-medium">株主名</th>
                <th className="px-4 py-2 text-right font-medium">所有株式数</th>
                <th className="px-4 py-2 text-right font-medium">比率</th>
              </tr>
            </thead>
            <tbody>
              {shareholders.map((sh) => (
                <tr
                  key={sh.rank}
                  className="border-b border-zinc-900 last:border-0 hover:bg-zinc-900/40"
                >
                  <td className="px-4 py-2.5 tabular-nums text-zinc-500">{sh.rank}</td>
                  <td className="px-4 py-2.5">
                    <div className="text-zinc-100">{sh.name}</div>
                    {sh.address && (
                      <div className="mt-0.5 text-xs text-zinc-600">{sh.address}</div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-zinc-200">
                    {sh.sharesHeld != null
                      ? `${sh.sharesHeld.toLocaleString("ja-JP")}株`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium text-amber-300">
                    {sh.ratioPct != null ? `${sh.ratioPct.toFixed(2)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </div>
  );
}
