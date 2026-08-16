'use client';

import { useMemo, useState } from 'react';

const GOLD = '#C8A96A';
const INK = '#E8E4D9';
const MUTED = 'rgba(232,228,217,0.55)';
const FAINT = 'rgba(232,228,217,0.32)';
const CARD = 'rgba(255,255,255,0.03)';
const LINE = 'rgba(255,255,255,0.08)';

// 区の識別色（ダーク面で検証済みの配色）
const CITY_COLOR: Record<string, string> = {
  品川区: '#3987E5',
  目黒区: '#199E70',
  大田区: '#D95926',
  世田谷区: '#9085E9',
};

export type Area = {
  level?: string;
  city: string;
  district: string;
  trade_count: number;
  n_towns?: number | null;
  unit_price_man: number | null;
  price_med_man: number | null;
  price_p25_man: number | null;
  price_p75_man: number | null;
  area_avg: number | null;
  trend_3y: number | null;
  trend_10y: number | null;
  built_year_med: number | null;
  zoning_top: string | null;
  n_recent: number;
  n_mid: number;
  n_old: number;
};

type SortKey = 'unit_price_man' | 'trend_3y' | 'trend_10y' | 'price_med_man' | 'trade_count';
type Axis = 'trend_3y' | 'trend_10y';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'trend_10y', label: '10年上昇率' },
  { key: 'trend_3y', label: '直近3年' },
  { key: 'unit_price_man', label: '㎡単価' },
  { key: 'price_med_man', label: '中央価格' },
  { key: 'trade_count', label: '成約件数' },
];

const AXES: { key: Axis; label: string; note: string }[] = [
  { key: 'trend_10y', label: '10年上昇率', note: '直近3年（2024–26）÷ 約10年前（2014–17）' },
  { key: 'trend_3y', label: '直近3年', note: '直近3年（2024–26）÷ その前3年（2021–23）' },
];

export default function AreaExplorer({ areas }: { areas: Area[] }) {
  const [cities, setCities] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>('trend_10y');
  const [axis, setAxis] = useState<Axis>('trend_10y');
  const [budget, setBudget] = useState<number>(0); // 万円。0 = 制限なし
  const [minN, setMinN] = useState<number>(50);
  const [hover, setHover] = useState<Area | null>(null);

  const rows = useMemo(() => {
    return areas
      .filter(a => (cities.length ? cities.includes(a.city) : true))
      .filter(a => a.trade_count >= minN)
      .filter(a => (budget ? (a.price_med_man ?? 1e9) <= budget : true))
      .sort((x, y) => (y[sort] ?? -1e9) - (x[sort] ?? -1e9));
  }, [areas, cities, sort, budget, minN]);

  // 散布図に載せるのは、選んだ軸のトレンドが計算できたものだけ
  const pts = rows.filter(a => a[axis] != null && a.unit_price_man != null);
  const axisMeta = AXES.find(a => a.key === axis)!;

  const toggleCity = (c: string) =>
    setCities(prev => (prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]));

  return (
    <div>
      {/* フィルタ */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'flex-end', marginBottom: 22 }}>
        <div>
          <div style={labelStyle}>区</div>
          <div style={{ display: 'flex', gap: 7 }}>
            {Object.keys(CITY_COLOR).map(c => {
              const on = cities.includes(c);
              return (
                <button key={c} type="button" onClick={() => toggleCity(c)} style={{
                  padding: '6px 13px', fontSize: 12.5, cursor: 'pointer', borderRadius: 999,
                  border: `1px solid ${on ? CITY_COLOR[c] : LINE}`,
                  background: on ? `${CITY_COLOR[c]}22` : 'transparent',
                  color: on ? CITY_COLOR[c] : MUTED,
                }}>{c}</button>
              );
            })}
          </div>
        </div>

        <div>
          <div style={labelStyle}>並び替え</div>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {SORTS.map(s => (
              <button key={s.key} type="button" onClick={() => setSort(s.key)} style={{
                padding: '6px 13px', fontSize: 12.5, cursor: 'pointer', borderRadius: 999,
                border: `1px solid ${sort === s.key ? GOLD : LINE}`,
                background: sort === s.key ? 'rgba(200,169,106,0.15)' : 'transparent',
                color: sort === s.key ? GOLD : MUTED,
              }}>{s.label}</button>
            ))}
          </div>
        </div>

        <div>
          <div style={labelStyle}>予算上限（中央価格）</div>
          <select value={budget} onChange={e => setBudget(Number(e.target.value))} style={selectStyle}>
            <option value={0}>制限なし</option>
            <option value={2500}>2,500万円以下</option>
            <option value={3000}>3,000万円以下</option>
            <option value={3500}>3,500万円以下</option>
            <option value={4000}>4,000万円以下</option>
          </select>
        </div>

        <div>
          <div style={labelStyle}>最低成約件数</div>
          <select value={minN} onChange={e => setMinN(Number(e.target.value))} style={selectStyle}>
            <option value={15}>15件以上</option>
            <option value={30}>30件以上</option>
            <option value={50}>50件以上</option>
            <option value={100}>100件以上</option>
            <option value={300}>300件以上</option>
          </select>
        </div>

        <div style={{ marginLeft: 'auto', fontSize: 12.5, color: MUTED }}>
          {rows.length}エリア
        </div>
      </div>

      {/* 散布図 */}
      <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: '18px 20px 10px', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 2 }}>
          <div style={{ fontSize: 14, color: INK }}>安い × 上がっているエリアを探す</div>
          <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
            {AXES.map(a => (
              <button key={a.key} type="button" onClick={() => setAxis(a.key)} style={{
                padding: '5px 11px', fontSize: 12, cursor: 'pointer', borderRadius: 999,
                border: `1px solid ${axis === a.key ? GOLD : LINE}`,
                background: axis === a.key ? 'rgba(200,169,106,0.15)' : 'transparent',
                color: axis === a.key ? GOLD : MUTED,
              }}>{a.label}</button>
            ))}
          </div>
        </div>
        <div style={{ fontSize: 12, color: MUTED, marginBottom: 14 }}>
          横軸＝㎡単価（万円）、縦軸＝{axisMeta.label}（%）。{axisMeta.note}。
          <b style={{ color: GOLD }}> 左上ほど狙い目</b>／円の大きさ＝成約件数（＝流動性）。
        </div>
        <Scatter points={pts} axis={axis} onHover={setHover} hover={hover} />
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10, fontSize: 12, color: MUTED }}>
          {Object.entries(CITY_COLOR).map(([c, col]) => (
            <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <i style={{ width: 9, height: 9, borderRadius: '50%', background: col, display: 'inline-block' }} />{c}
            </span>
          ))}
        </div>
      </div>

      {/* テーブル */}
      <div style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['エリア', '件数', '㎡単価', '10年', '直近3年', '中央価格', '価格帯(25-75%)', '築年中央', '用途地域'].map((h, i) => (
                  <th key={h} style={{
                    padding: '11px 12px', fontSize: 11.5, fontWeight: 600, color: FAINT,
                    textAlign: i === 0 || i === 8 ? 'left' : 'right', borderBottom: `1px solid ${LINE}`, whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(a => (
                <tr key={`${a.city}-${a.district}`}
                    onMouseEnter={() => setHover(a)} onMouseLeave={() => setHover(null)}
                    style={{ background: hover === a ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                  <td style={{ ...td, textAlign: 'left', whiteSpace: 'nowrap' }}>
                    <span style={{ color: CITY_COLOR[a.city] ?? MUTED, fontSize: 11.5 }}>{a.city}</span>
                    <span style={{ color: INK, marginLeft: 7 }}>{a.district}</span>
                  </td>
                  <td style={td} title={`直近3年 ${a.n_recent}件 / その前3年 ${a.n_mid}件 / 10年前 ${a.n_old}件`}>
                    {a.trade_count}
                  </td>
                  <td style={{ ...td, color: INK }}>{a.unit_price_man ?? '—'}</td>
                  <td style={{ ...td, color: trendColor(a.trend_10y) }}>{fmtPct(a.trend_10y)}</td>
                  <td style={{ ...td, color: trendColor(a.trend_3y) }}>{fmtPct(a.trend_3y)}</td>
                  <td style={{ ...td, color: INK }}>{a.price_med_man?.toLocaleString() ?? '—'}</td>
                  <td style={{ ...td, color: MUTED, fontSize: 12.5 }}>
                    {a.price_p25_man && a.price_p75_man ? `${a.price_p25_man.toLocaleString()}〜${a.price_p75_man.toLocaleString()}` : '—'}
                  </td>
                  <td style={{ ...td, color: MUTED }}>{a.built_year_med ?? '—'}</td>
                  <td style={{ ...td, textAlign: 'left', color: MUTED, fontSize: 12, whiteSpace: 'nowrap' }}>{a.zoning_top ?? '—'}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={9} style={{ ...td, textAlign: 'center', color: MUTED, padding: 36 }}>条件に合うエリアがありません</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ fontSize: 12, color: FAINT, marginTop: 14, lineHeight: 1.8 }}>
        出典: 国土交通省 不動産情報ライブラリ（不動産取引価格情報）。中古マンション等・専有20〜30㎡の成約 2014Q3〜2026Q1 から算出。<br />
        <b>10年</b>＝直近3年の㎡単価中央値 ÷ 約10年前（2014–17）の中央値。<b>直近3年</b>＝直近3年 ÷ その前3年（2021–23）。両側5件以上あるときだけ表示します。<br />
        同一物件の値上がりではなく、異なる物件群の中央値比較です。方向性の指標として扱ってください。<br />
        国交省は価格を有効数字、面積を5㎡刻みに丸めて公表するため、単価は粗い階段状になります。<br />
        築年中央値が新しいエリアは築浅プレミアムが単価を押し上げています。単価だけで割高と判断しないこと。
      </p>
    </div>
  );
}

function fmtPct(t: number | null) {
  if (t == null) return '—';
  return `${t > 0 ? '+' : ''}${t}%`;
}

function trendColor(t: number | null) {
  if (t == null) return MUTED;
  if (t >= 20) return '#4CC182';
  if (t > 0) return INK;
  return '#E0605C';
}

const td: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'right', color: MUTED, borderBottom: `1px solid rgba(255,255,255,0.04)`,
};
const labelStyle: React.CSSProperties = { fontSize: 11.5, color: FAINT, marginBottom: 6 };
const selectStyle: React.CSSProperties = {
  padding: '6px 10px', fontSize: 12.5, color: INK, background: 'rgba(0,0,0,0.25)',
  border: `1px solid ${LINE}`, borderRadius: 8, outline: 'none',
};

function Scatter({ points, axis, onHover, hover }: {
  points: Area[]; axis: Axis; onHover: (a: Area | null) => void; hover: Area | null;
}) {
  const W = 900, H = 340, mL = 46, mR = 16, mT = 12, mB = 38;
  const iw = W - mL - mR, ih = H - mT - mB;
  if (!points.length) return <div style={{ fontSize: 13, color: MUTED, padding: 40, textAlign: 'center' }}>データがありません</div>;

  const xs = points.map(p => p.unit_price_man!), ys = points.map(p => p[axis]!);
  const xMin = 0, xMax = Math.max(...xs) * 1.05;
  const yLo = Math.min(...ys), yHi = Math.max(...ys);
  const pad = Math.max((yHi - yLo) * 0.12, 2);
  const yMin = Math.min(0, yLo - pad), yMax = yHi + pad;
  const X = (v: number) => mL + ((v - xMin) / (xMax - xMin)) * iw;
  const Y = (v: number) => mT + ih - ((v - yMin) / (yMax - yMin)) * ih;

  const xTicks = 5, yTicks = 5;
  const medX = [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const medY = [...ys].sort((a, b) => a - b)[Math.floor(ys.length / 2)];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }} role="img"
         aria-label="エリア別の㎡単価と上昇率の散布図">
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const v = yMin + ((yMax - yMin) * i) / yTicks;
        return (
          <g key={`y${i}`}>
            <line x1={mL} y1={Y(v)} x2={mL + iw} y2={Y(v)} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            <text x={mL - 9} y={Y(v) + 4} textAnchor="end" fontSize={10.5} fill={FAINT}>{Math.round(v)}%</text>
          </g>
        );
      })}
      {Array.from({ length: xTicks + 1 }, (_, i) => {
        const v = xMin + ((xMax - xMin) * i) / xTicks;
        return (
          <text key={`x${i}`} x={X(v)} y={mT + ih + 20} textAnchor="middle" fontSize={10.5} fill={FAINT}>{Math.round(v)}</text>
        );
      })}
      <text x={mL + iw / 2} y={mT + ih + 36} textAnchor="middle" fontSize={11} fill={FAINT}>㎡単価（万円）</text>

      {/* 中央値の十字。左上の象限が「安い×上がっている」 */}
      <line x1={X(medX)} y1={mT} x2={X(medX)} y2={mT + ih} stroke={GOLD} strokeWidth={1} strokeDasharray="3 4" opacity={0.45} />
      <line x1={mL} y1={Y(medY)} x2={mL + iw} y2={Y(medY)} stroke={GOLD} strokeWidth={1} strokeDasharray="3 4" opacity={0.45} />
      <text x={mL + 8} y={mT + 16} fontSize={11} fill={GOLD} opacity={0.8}>狙い目</text>

      {points.map(p => {
        const on = hover === p;
        const r = Math.max(4, Math.min(13, Math.sqrt(p.trade_count) * 0.62));
        return (
          <circle key={`${p.city}-${p.district}`}
            cx={X(p.unit_price_man!)} cy={Y(p[axis]!)} r={on ? r + 3 : r}
            fill={CITY_COLOR[p.city] ?? MUTED} fillOpacity={on ? 0.95 : 0.62}
            stroke={on ? INK : 'rgba(0,0,0,0.35)'} strokeWidth={on ? 1.5 : 2}
            onMouseEnter={() => onHover(p)} onMouseLeave={() => onHover(null)}
            style={{ cursor: 'pointer', transition: 'r 90ms' }} />
        );
      })}

      {hover && hover[axis] != null && (
        <g pointerEvents="none">
          <rect x={Math.min(X(hover.unit_price_man!) + 12, W - 236)} y={Math.max(Y(hover[axis]!) - 60, 4)}
                width={226} height={68} rx={7} fill="rgba(10,10,10,0.94)" stroke={LINE} />
          <text x={Math.min(X(hover.unit_price_man!) + 24, W - 224)} y={Math.max(Y(hover[axis]!) - 40, 24)}
                fontSize={12.5} fill={INK}>{hover.city}{hover.district}</text>
          <text x={Math.min(X(hover.unit_price_man!) + 24, W - 224)} y={Math.max(Y(hover[axis]!) - 23, 41)}
                fontSize={11.5} fill={MUTED}>
            {hover.unit_price_man}万/㎡ · 中央{hover.price_med_man?.toLocaleString()}万 · {hover.trade_count}件
          </text>
          <text x={Math.min(X(hover.unit_price_man!) + 24, W - 224)} y={Math.max(Y(hover[axis]!) - 7, 57)}
                fontSize={11.5} fill={MUTED}>
            10年 {fmtPct(hover.trend_10y)} · 直近3年 {fmtPct(hover.trend_3y)}
          </text>
        </g>
      )}
    </svg>
  );
}
