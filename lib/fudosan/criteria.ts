// 買付クライテリア（城南・資産形成モード）
// 閾値を変えたら CRITERIA_VERSION を必ず上げること。
// 「いつ何を変えたら通過率がどう動いたか」が残らないと PDCA の Act が効かない。

export const CRITERIA_VERSION = 'v2.1-jonan-wealth';

export const CONFIG = {
  loan: { rate: 0.022, years: 35, equityMan: 1500, costRate: 0.075 },
  ops: { vacancy: 0.05, pm: 0.05, insuranceMan: 1.5, taxRate: 0.0035 },
  exit: { holdYears: 15, apprRate: 0.010, apprStress: 0.0, sellCostRate: 0.04 },
  gates: {
    minAreaSqm: 25,
    minRegisteredSqm: 25,
    wallToInnerRatio: 0.89,   // ワンルームの壁芯→内法 平均約11%減
    minRentMan: 11.0,
    targetRentMan: 12.0,
    maxFeeRatio: 0.18,
    minBtcfMan: -6.0,
    eqRateNg: 0.030,
    eqRateOk: 0.045,
    minRemainingLife: 22,
    setagayaMinSqm: 30,
    repairRatioNg: 0.70,
  },
} as const;

export type WardInfo = { bench: number; penalty: number; note: string };

// 区別ベンチマーク表面利回り（実勢／2026年8月）
// 日本不動産研究所の「城南」は目黒・世田谷のみなので、3.6%を品川・大田に適用しない
export const WARD: Record<string, WardInfo> = {
  品川区: { bench: 0.041, penalty: 0, note: '第1優先。単身世帯比率59.4%で4区最高、2045年まで+20.8%' },
  目黒区: { bench: 0.039, penalty: 0, note: '築古の値持ちが最強（新築÷最古2.2倍）。単身世帯の伸びは+6.6%と最弱' },
  大田区: { bench: 0.045, penalty: -10, note: '単身世帯が2040年ピークアウト。9年上昇率+36.3%は23区最下位' },
  世田谷区: { bench: 0.042, penalty: -8, note: '20㎡台の㎡単価が区平均の49%。30㎡以上・駅力ある物件に限定' },
};

export const EXCLUDE_STATIONS = ['大井競馬場前', '大鳥居', '上町', '久が原', '御嶽山', '千鳥町'];

export const PRIORITY_STATIONS = [
  '大崎', '武蔵小山', '目黒', '中目黒', '二子玉川', '池尻大橋',
  '京急蒲田', '五反田', '戸越銀座', '不動前', '大井町', '三軒茶屋',
];

// 多摩川低地・呑川流域など浸水想定にかかりやすい駅
export const FLOOD_WATCH = [
  '田園調布', '沼部', '鵜の木', '下丸子', '武蔵新田', '矢口渡', '多摩川', '六郷土手', '雑色',
];

// 直通なし・短編成でアクセスが弱い路線
export const WEAK_LINES = ['東急多摩川線', '東急世田谷線', '東京モノレール'];

// 国交省 修繕積立金ガイドライン（令和6年6月改定）円/㎡・月
export const REPAIR_GUIDELINE = [
  { maxFloors: 19, maxGfa: 5000, avg: 335, low: 235 },
  { maxFloors: 19, maxGfa: 10000, avg: 252, low: 170 },
  { maxFloors: 19, maxGfa: 20000, avg: 271, low: 200 },
  { maxFloors: 19, maxGfa: Infinity, avg: 255, low: 190 },
  { maxFloors: Infinity, maxGfa: Infinity, avg: 338, low: 240 },
];

export const LEGAL_LIFE_RC = 47;
export const REPAIR_COST_PER_UNIT_MAN = 110.2; // 国交省R3調査 1回目大規模修繕 戸あたり中央値
