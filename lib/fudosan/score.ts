import {
  CRITERIA_VERSION, CONFIG, WARD, EXCLUDE_STATIONS, PRIORITY_STATIONS,
  FLOOD_WATCH, WEAK_LINES, REPAIR_GUIDELINE, LEGAL_LIFE_RC, REPAIR_COST_PER_UNIT_MAN,
} from './criteria';

export type Property = {
  name?: string | null;
  price_man?: number | null;
  rent_man?: number | null;
  area_sqm?: number | null;
  area_basis?: string | null;
  registered_sqm?: number | null;
  management_fee_yen?: number | null;
  repair_reserve_yen?: number | null;
  other_monthly_yen?: number | null;
  built_ym?: string | null;
  address?: string | null;
  city?: string | null;
  line?: string | null;
  station?: string | null;
  walk_min?: number | null;
  floor?: number | null;
  total_floors?: number | null;
  total_units?: number | null;
  facing?: string | null;
  zoning?: string | null;
  land_right?: string | null;
  management_type?: string | null;
  manager_type?: string | null;
  occupancy?: string | null;
  sublease?: boolean | null;
  repair_method?: string | null;
  [k: string]: unknown;
};

/** 相場データ（Supabase から引き当てて渡す） */
export type MarketContext = {
  matched_level?: 'town' | 'area' | 'city' | 'none';
  district?: string | null;
  scope_label?: string | null;                 // 「目黒区平町（町名）」など、何と比べたか
  station_unit_price_sqm_man?: number | null;  // 成約㎡単価の中央値（万円）
  city_unit_price_sqm_man?: number | null;
  unit_price_trend_3y?: number | null;         // %
  unit_price_trend_10y?: number | null;        // %
  price_med_man?: number | null;               // その粒度の成約価格中央値（万円）
  built_year_med?: number | null;
  zoning_top?: string | null;
  land_price_trend_3y?: number | null;         // %
  station_rent_1k_man?: number | null;         // 1K賃料相場（万円）
  trade_count?: number | null;
  tier?: string | null;
};

export type Warning = { tag: string; pt: number };

export type Evaluation = {
  criteria_version: string;
  verdict: 'A' | 'B' | 'C' | 'NG' | 'PENDING';
  score: number | null;
  ng_reasons: string[];
  gate2_fails: string[];
  gate3_fails: string[];
  gate4_fails: string[];
  warnings: Warning[];
  bonuses: Warning[];
  todo: string[];
  metrics: Record<string, unknown>;
  market_context: MarketContext;
};

const num = (v: unknown, d: number | null = null): number | null => {
  if (v === null || v === undefined || v === '') return d;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : d;
};

function buildingAge(ym?: string | null): number | null {
  if (!ym) return null;
  const m = String(ym).match(/(\d{4})[-/年]?\s*(\d{1,2})?/);
  if (!m) return null;
  const now = new Date();
  return now.getFullYear() - Number(m[1]) + (now.getMonth() + 1 - (m[2] ? Number(m[2]) : 6)) / 12;
}

export function ads(loan: number, rate: number, years: number): number {
  if (loan <= 0) return 0;
  const r = rate / 12, n = years * 12;
  return r === 0 ? loan / years : (loan * (r * (1 + r) ** n)) / ((1 + r) ** n - 1) * 12;
}

export function balance(loan: number, rate: number, years: number, k: number): number {
  if (loan <= 0) return 0;
  const r = rate / 12, n = years * 12, kk = k * 12;
  return r === 0 ? loan * (1 - kk / n) : (loan * ((1 + r) ** n - (1 + r) ** kk)) / ((1 + r) ** n - 1);
}

function repairGuideline(floors: number | null, gfa: number | null) {
  const f = floors ?? 10, g = gfa ?? 4000;
  return REPAIR_GUIDELINE.find(r => f <= r.maxFloors && g <= r.maxGfa) ?? REPAIR_GUIDELINE[3];
}

export function evaluate(p: Property, market: MarketContext = {}, equityManOverride?: number): Evaluation {
  const ng: string[] = [], g2: string[] = [], g3: string[] = [], g4: string[] = [];
  const warnings: Warning[] = [], bonuses: Warning[] = [], todo: string[] = [];
  const M: Record<string, unknown> = {};
  const G = CONFIG.gates;

  const price = num(p.price_man);
  const rent = num(p.rent_man);
  const area = num(p.area_sqm);
  const mgmt = num(p.management_fee_yen, 0) ?? 0;
  const repair = num(p.repair_reserve_yen, 0) ?? 0;
  const other = num(p.other_monthly_yen, 0) ?? 0;
  const feeMan = (mgmt + repair + other) / 10000;
  const age = buildingAge(p.built_ym);
  const hay = [p.city, p.address].filter(Boolean).join(' ');
  const ward = Object.keys(WARD).find(w => hay.includes(w)) ?? null;
  const station = String(p.station ?? '').replace(/駅$/, '');
  const floor = num(p.floor), floors = num(p.total_floors), units = num(p.total_units);
  const equityMan = equityManOverride ?? CONFIG.loan.equityMan;

  if (!price) {
    return {
      criteria_version: CRITERIA_VERSION, verdict: 'PENDING', score: null,
      ng_reasons: ['価格が読み取れず'], gate2_fails: [], gate3_fails: [], gate4_fails: [],
      warnings: [], bonuses: [], todo: ['マイソクの解像度を上げて再アップロード'],
      metrics: M, market_context: market,
    };
  }

  // 登記（内法）面積の推定
  let reg = num(p.registered_sqm);
  if (reg === null && area !== null && (p.area_basis ?? '壁芯') === '壁芯') {
    reg = area * G.wallToInnerRatio;
    M.registered_sqm_estimated = true;
  }
  Object.assign(M, { ward, station, area_sqm: area, registered_sqm: reg === null ? null : +reg.toFixed(1) });

  // ---------- STEP 1: ハードNG ----------
  if (!ward) ng.push('城南4区（品川・目黒・大田・世田谷）以外');
  if (station && EXCLUDE_STATIONS.some(s => station.includes(s))) ng.push(`除外駅: ${station}`);
  if (area !== null && area < G.minAreaSqm) ng.push(`専有面積 ${area}㎡ < ${G.minAreaSqm}㎡`);
  if (ward === '世田谷区' && area !== null && area < G.setagayaMinSqm) {
    ng.push(`世田谷区 かつ ${area}㎡ < ${G.setagayaMinSqm}㎡（20㎡台の㎡単価が区平均の49%）`);
  }
  if (p.land_right && /借地/.test(p.land_right)) ng.push('借地権');
  const by = p.built_ym?.match(/(\d{4})/);
  if (by && Number(by[1]) < 1982) ng.push('旧耐震（建築確認1981/5/31以前の可能性）');
  if (age !== null) {
    M.age = +age.toFixed(1);
    M.remaining_life = +(LEGAL_LIFE_RC - age).toFixed(1);
    if ((M.remaining_life as number) < G.minRemainingLife) {
      ng.push(`残存耐用年数 ${M.remaining_life}年 < ${G.minRemainingLife}年`);
    }
  }
  if (p.sublease === true || p.occupancy === 'サブリース') {
    warnings.push({ tag: 'サブリース（解約困難・減額請求リスク）', pt: -15 });
  }

  // ---------- 修繕積立金の診断 ----------
  if (repair > 0 && area) {
    const gl = repairGuideline(floors, null);
    const idealYen = gl.avg * area, lowYen = gl.low * area;
    Object.assign(M, {
      repair_per_sqm: Math.round(repair / area),
      repair_guideline_avg_yen: Math.round(idealYen),
      repair_ratio_to_avg: +(repair / idealYen).toFixed(2),
      repair_shortfall_man_year: +((Math.max(0, idealYen - repair) * 12) / 10000).toFixed(1),
    });
    if (repair < idealYen * G.repairRatioNg) {
      warnings.push({
        tag: `修繕積立金 ${repair.toLocaleString()}円/月（${M.repair_per_sqm}円/㎡）はガイドライン平均の${Math.round((M.repair_ratio_to_avg as number) * 100)}%。是正時 年${M.repair_shortfall_man_year}万円のCF悪化`,
        pt: -25,
      });
      todo.push('長期修繕計画書・修繕積立金残高・総会議事録（直近3期）を入手。均等積立か段階増額か、将来の到達額はいくらか');
    } else if (repair < lowYen) {
      warnings.push({ tag: '修繕積立金がガイドライン下限未満', pt: -12 });
    }
    if (units && age !== null) {
      const accum = (repair * units * 12 * 14) / 1e4;
      const need = REPAIR_COST_PER_UNIT_MAN * units;
      Object.assign(M, {
        repair_accum_man: Math.round(accum),
        repair_need_man: Math.round(need),
        repair_coverage: +(accum / need).toFixed(2),
      });
      if (accum < need * 0.7) {
        warnings.push({
          tag: `築14年時点の積立累計 約${M.repair_accum_man}万円 vs 必要 約${M.repair_need_man}万円（充足率${Math.round((M.repair_coverage as number) * 100)}%／戸あたり不足 約${Math.round((need - accum) / units)}万円）`,
          pt: -12,
        });
      }
    }
  } else if (!repair) {
    todo.push('修繕積立金の月額を重要事項調査報告書で確認');
  }

  // ---------- 収益・資産形成 ----------
  const bench = ward ? WARD[ward].bench : 0.045;
  M.benchmark = +(bench * 100).toFixed(2);
  M.rent_for_benchmark_man = +((price * bench) / 12).toFixed(2);

  // ---------- 必要家賃の逆算（賃料が読めなくても必ず出す） ----------
  {
    const total0 = price * (1 + CONFIG.loan.costRate);
    const equity0 = Math.min(equityMan, total0);
    const loan0 = Math.max(0, total0 - equity0);
    const a0 = ads(loan0, CONFIG.loan.rate, CONFIG.loan.years);
    const principal0 = Math.max(0, a0 - loan0 * CONFIG.loan.rate);
    const appr0 = price * CONFIG.exit.apprRate;
    const fixed0 = feeMan * 12 + price * CONFIG.ops.taxRate + CONFIG.ops.insuranceMan;
    const keep = 1 - CONFIG.ops.vacancy - CONFIG.ops.pm;  // 賃料のうちNOIに残る割合
    const rBtcf = (fixed0 + a0) / keep / 12;
    const rEq = (fixed0 + a0 - principal0 - appr0 + equity0 * G.eqRateOk) / keep / 12;
    const cands: Array<[string, number]> = [
      ['ベンチマーク利回り', M.rent_for_benchmark_man as number],
      ['BTCF±0', rBtcf],
      [`自己資本増加率${(G.eqRateOk * 100).toFixed(1)}%`, rEq],
      ['最低賃料ライン', G.minRentMan],
    ];
    const top = cands.reduce((x, y) => (y[1] > x[1] ? y : x));
    Object.assign(M, {
      rent_required_btcf0_man: +rBtcf.toFixed(2),
      rent_required_eq_ok_man: +rEq.toFixed(2),
      rent_required_man: +top[1].toFixed(2),
      rent_required_driver: top[0],
      fee_ratio_at_required_rent: +((feeMan / top[1]) * 100).toFixed(1),
    });
  }

  let btcf = 0, eqRate = 0, hasFin = false;
  if (rent) {
    hasFin = true;
    const rentY = rent * 12;
    const tax = price * CONFIG.ops.taxRate;
    const noi = rentY * (1 - CONFIG.ops.vacancy) - feeMan * 12 - rentY * CONFIG.ops.pm - tax - CONFIG.ops.insuranceMan;
    const total = price * (1 + CONFIG.loan.costRate);
    const equity = Math.min(equityMan, total);
    const loan = Math.max(0, total - equity);
    const a = ads(loan, CONFIG.loan.rate, CONFIG.loan.years);
    const principal = Math.max(0, a - loan * CONFIG.loan.rate);
    btcf = noi - a;
    const appr = price * CONFIG.exit.apprRate;
    const eqGain = btcf + principal + appr;
    const realY = noi / total;
    const K = loan > 0 ? a / loan : null;
    const noiFixed = noi - ((M.repair_shortfall_man_year as number) ?? 0);
    eqRate = eqGain / equity;

    Object.assign(M, {
      gross_yield: +((rentY / price) * 100).toFixed(2),
      real_yield: +(realY * 100).toFixed(2),
      loan_constant: K === null ? null : +(K * 100).toFixed(2),
      yield_gap: K === null ? null : +((realY - K) * 100).toFixed(2),
      noi: +noi.toFixed(1),
      noi_after_repair_fix: +noiFixed.toFixed(1),
      ads: +a.toFixed(1),
      btcf: +btcf.toFixed(1),
      btcf_after_repair_fix: +(noiFixed - a).toFixed(1),
      principal: +principal.toFixed(1),
      appreciation: +appr.toFixed(1),
      equity_gain: +eqGain.toFixed(1),
      equity_rate: +(eqRate * 100).toFixed(2),
      ccr: +((btcf / equity) * 100).toFixed(2),
      fee_ratio: +((feeMan / rent) * 100).toFixed(1),
      equity_used: Math.round(equity),
      loan: Math.round(loan),
    });

    if (rentY / price < bench) {
      g2.push(`表面 ${M.gross_yield}% < ${ward ?? '基準'}ベンチマーク ${M.benchmark}%（必要賃料 ${M.rent_for_benchmark_man}万円）`);
    }
    if (rent < G.minRentMan) g2.push(`月額賃料 ${rent.toFixed(2)}万 < ${G.minRentMan}万（年100万円CFの器にならない）`);
    if (feeMan / rent > G.maxFeeRatio) g2.push(`(管理費+積立金)/賃料 = ${M.fee_ratio}% > ${G.maxFeeRatio * 100}%`);

    if (btcf < G.minBtcfMan) g3.push(`BTCF ${M.btcf}万/年（持ち出し）`);
    if (eqRate < G.eqRateNg) g3.push(`自己資本増加率 ${M.equity_rate}% < ${G.eqRateNg * 100}%`);

    const h = CONFIG.exit.holdYears;
    const bal15 = balance(loan, CONFIG.loan.rate, CONFIG.loan.years, h);
    const px15 = price * (1 + CONFIG.exit.apprRate) ** h;
    const px15s = price * (1 + CONFIG.exit.apprStress) ** h;
    Object.assign(M, {
      exit_balance_15y: Math.round(bal15),
      exit_price_15y: Math.round(px15),
      exit_net_15y: Math.round(px15 * (1 - CONFIG.exit.sellCostRate) - bal15),
      exit_net_15y_stress: Math.round(px15s * (1 - CONFIG.exit.sellCostRate) - bal15),
    });
    M.can_clear_two_units = (M.exit_net_15y as number) >= bal15 * 2;
    if (age !== null && age + h > LEGAL_LIFE_RC - 15) {
      g4.push(`売却時 築${(age + h).toFixed(1)}年で買主の融資が細る`);
    }
    if ((M.exit_net_15y_stress as number) < equity) {
      g4.push(`価格横ばい時の15年後売却手取 ${M.exit_net_15y_stress}万 < 投下自己資金 ${M.equity_used}万`);
    }
  } else {
    todo.push('現行賃料が不明。オーナーチェンジなら賃貸借契約書で現行賃料・契約日・契約種別を確認');
    todo.push(`この価格で基準を満たすには月額 ${M.rent_required_man}万円以上が必要（律速: ${M.rent_required_driver}）。空室なら募集賃料、賃貸中なら現行賃料をこの線と比べる`);
    if (market.station_rent_1k_man) {
      todo.push(`地区の1K相場は ${market.station_rent_1k_man}万円。必要家賃 ${M.rent_required_man}万円が現実的に取れる水準かを確認`);
    }
  }

  // ---------- 相場との突き合わせ（Supabaseの蓄積データ） ----------
  if (area && market.station_unit_price_sqm_man) {
    const own = price / area;
    const mkt = market.station_unit_price_sqm_man;
    const diff = +(((own / mkt) - 1) * 100).toFixed(1);
    const scope = market.scope_label ?? `${market.district ?? p.city ?? ward ?? ''}周辺`;
    const trend: string[] = [];
    if (typeof market.unit_price_trend_3y === 'number') trend.push(`3年${market.unit_price_trend_3y > 0 ? '+' : ''}${market.unit_price_trend_3y}%`);
    if (typeof market.unit_price_trend_10y === 'number') trend.push(`10年${market.unit_price_trend_10y > 0 ? '+' : ''}${market.unit_price_trend_10y}%`);
    M.unit_price_sqm_man = +own.toFixed(1);
    M.market_unit_price_sqm_man = mkt;
    M.price_vs_market = diff;
    M.market_level = market.matched_level ?? null;
    M.market_scope = scope;
    M.market_note = `㎡単価 ${M.unit_price_sqm_man}万 vs 相場 ${mkt}万（${scope}・成約${market.trade_count ?? '—'}件）→ ${diff > 0 ? '+' : ''}${diff}%`
      + (trend.length ? `／相場推移 ${trend.join(' ')}` : '');
    if (own > mkt * 1.15) warnings.push({ tag: `㎡単価 ${M.unit_price_sqm_man}万は相場 ${mkt}万を${diff}%上回る`, pt: -12 });
    else if (own < mkt * 0.9) bonuses.push({ tag: `㎡単価が相場を${Math.abs(diff)}%下回る`, pt: 10 });
  } else {
    M.market_note = area ? '相場データなし（該当地区の成約サンプルが不足）' : '相場データなし（専有面積が読み取れず）';
    M.market_level = market.matched_level ?? 'none';
  }
  if (rent && market.station_rent_1k_man && rent > market.station_rent_1k_man * 1.15) {
    warnings.push({ tag: `想定賃料 ${rent}万は駅圏相場 ${market.station_rent_1k_man}万を大きく上回る。賃料の妥当性を要確認`, pt: -10 });
    todo.push('現行賃料が相場より高い場合、退去後に下がる前提でシミュレーションし直す');
  }
  if (typeof market.unit_price_trend_3y === 'number' && market.unit_price_trend_3y < 0) {
    warnings.push({ tag: `駅圏の成約㎡単価が3年で ${market.unit_price_trend_3y}%（下落トレンド）`, pt: -10 });
  }
  if (typeof market.trade_count === 'number' && market.trade_count < 5) {
    warnings.push({ tag: `駅圏の直近成約が ${market.trade_count}件と少ない（流動性が低い）`, pt: -8 });
  }

  // ---------- 物理条件の減点 ----------
  if (reg !== null && reg < G.minRegisteredSqm) {
    warnings.push({
      tag: `登記(内法)面積 ${M.registered_sqm}㎡${M.registered_sqm_estimated ? '（推定）' : ''} < 25㎡。買主が使える金融機関が激減し出口の流動性が構造的に低い`,
      pt: -20,
    });
    todo.push('登記簿謄本で実際の登記面積を確認。25㎡を超えるか否かで出口の難易度が大きく変わる');
  }
  if (ward && WARD[ward].penalty) warnings.push({ tag: `${ward}: ${WARD[ward].note}`, pt: WARD[ward].penalty });
  if (floor === 1) warnings.push({ tag: '1階住戸。賃貸希望者の約7割が2階以上を希望するため募集母集団が縮み、空室期間が非線形に伸びる', pt: -12 });
  const facing = String(p.facing ?? '');
  if (/北/.test(facing) && !/南/.test(facing)) warnings.push({ tag: `主要採光方向「${facing}」。賃料▲5%前後、分譲価格▲5〜13%`, pt: -8 });
  if (floor === 1 && /北/.test(facing)) warnings.push({ tag: '1階×北向きの重複。入居者母集団が二重に絞られる', pt: -10 });
  if (/準工業|工業/.test(String(p.zoning ?? ''))) {
    warnings.push({ tag: `用途地域「${p.zoning}」。隣地に工場・倉庫・遊技場が建ちうる／土壌汚染履歴／積算評価が出にくい`, pt: -10 });
  }
  if (station && FLOOD_WATCH.some(s => station.includes(s))) {
    warnings.push({ tag: `${station}周辺は低地。多摩川氾濫の想定浸水深は広く0.5〜3m`, pt: -10 });
    todo.push('自治体ハザードマップ原図で当該地番の想定浸水深と家屋倒壊等氾濫想定区域の該当有無を確認');
    if (floor === 1) warnings.push({ tag: '浸水想定域 かつ 1階住戸。水災補償が必須で保険料増、罹災時の空室損が大きい', pt: -15 });
  }
  if (p.line && WEAK_LINES.some(l => String(p.line).includes(l))) {
    warnings.push({ tag: `${p.line}は直通なし・短編成で必ず乗換が発生。賃料の天井が低い`, pt: -8 });
  }
  if (p.management_type === '自主管理') warnings.push({ tag: '自主管理', pt: -10 });
  if (/巡回/.test(String(p.manager_type ?? ''))) warnings.push({ tag: '管理員は巡回（常駐でない）', pt: -3 });
  if (units !== null && units < 20) warnings.push({ tag: '総戸数20戸未満', pt: -5 });
  if (area !== null && area < 28) warnings.push({ tag: '専有面積28㎡未満（登記が25㎡を切りやすい）', pt: -5 });

  // ---------- 加点 ----------
  if (station && PRIORITY_STATIONS.some(s => station.includes(s))) bonuses.push({ tag: `優先駅: ${station}`, pt: 8 });
  if (rent && rent >= G.targetRentMan) bonuses.push({ tag: `月額賃料 ${rent.toFixed(1)}万（年100万円CFの器）`, pt: 12 });
  if (area !== null && area >= 30) bonuses.push({ tag: '30㎡以上（条例・建替え・実需の出口すべて有利）', pt: 6 });
  if (p.land_right === '所有権') bonuses.push({ tag: '所有権', pt: 2 });

  // ---------- スコア ----------
  let score = 50;
  if (hasFin && rent) {
    score += Math.min(20, ((rent * 12) / price - bench) * 100 * 8);
    score += Math.min(20, (eqRate - G.eqRateOk) * 300);
    score += Math.min(10, btcf * 0.4);
    score += Math.min(6, (G.maxFeeRatio - feeMan / rent) * 100);
    if (M.can_clear_two_units) score += 8;
  }
  score += warnings.reduce((s, w) => s + w.pt, 0) + bonuses.reduce((s, b) => s + b.pt, 0);
  score = Math.max(0, Math.min(100, Math.round(score)));

  // ---------- 判定 ----------
  let verdict: Evaluation['verdict'];
  if (ng.length) { verdict = 'NG'; score = 0; }
  else if (!hasFin) verdict = 'PENDING';
  else if (g2.length || g3.length) verdict = 'C';
  else if (eqRate >= G.eqRateOk && btcf >= 0 && !g4.length && (rent ?? 0) >= G.targetRentMan) verdict = 'A';
  else verdict = 'B';

  return {
    criteria_version: CRITERIA_VERSION, verdict, score,
    ng_reasons: ng, gate2_fails: g2, gate3_fails: g3, gate4_fails: g4,
    warnings, bonuses, todo, metrics: M, market_context: market,
  };
}

/** LINE通知用の短いテキスト */
export function toMessage(p: Property, e: Evaluation): string {
  const mark = { A: '◎A', B: '○B', C: '△C', NG: '×NG', PENDING: '?情報不足' }[e.verdict];
  const M = e.metrics as Record<string, number | string | boolean | null | undefined>;
  const L: string[] = [];
  L.push(`【物件診断】${mark}  スコア ${e.score ?? '—'}`);
  L.push(p.name ?? '物件');
  if (p.price_man) L.push(`${p.price_man.toLocaleString()}万円 / ${p.area_sqm ?? '—'}㎡${M.registered_sqm ? `（登記推定${M.registered_sqm}㎡）` : ''}`);
  if (p.address) L.push(String(p.address));
  if (p.station) L.push(`${p.line ?? ''} ${p.station}${p.walk_min ? ` 徒歩${p.walk_min}分` : ''}`);
  if (p.built_ym) L.push(`${p.built_ym}築${M.age ? `（築${M.age}年）` : ''}`);
  if (M.gross_yield) {
    L.push('');
    L.push(`表面 ${M.gross_yield}% / 実質 ${M.real_yield}%（K=${M.loan_constant}%）`);
    L.push(`NOI ${M.noi}万 → BTCF ${M.btcf}万/年`);
    L.push(`自己資本増加 ${M.equity_gain}万/年（${M.equity_rate}%）`);
  }
  if (M.market_note) {
    L.push('');
    L.push('■相場');
    L.push(String(M.market_note));
  }
  if (!p.rent_man && M.rent_required_man) {
    L.push('');
    L.push('■賃料不明のため逆算');
    L.push(`必要家賃 ${M.rent_required_man}万円/月（律速: ${M.rent_required_driver}）`);
    L.push(`内訳 ベンチマーク ${M.rent_for_benchmark_man}万 / BTCF±0 ${M.rent_required_btcf0_man}万 / 自己資本増加 ${M.rent_required_eq_ok_man}万`);
  }

  const sec = (t: string, arr: string[]) => {
    if (!arr.length) return;
    L.push('');
    L.push(`■${t}`);
    arr.slice(0, 5).forEach(x => L.push(`・${x}`));
  };
  sec('ハードNG', e.ng_reasons);
  sec('収益性ゲート', e.gate2_fails);
  sec('資産形成ゲート', e.gate3_fails);
  sec('出口ゲート', e.gate4_fails);
  sec('減点', e.warnings.map(w => w.tag));
  sec('要確認', e.todo);
  return L.join('\n').slice(0, 4800);
}
