import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { evaluate, toMessage, type MarketContext, type Property } from './score'
import { loadMarketContext } from './market'
import {
  JONAN_RENT_1K, RENT_ABOVE_MARKET, RENT_SEGMENT,
  askingFromStockYen, normalizeRentRow, parseEstatRentPayload, pickRentMarket, rentNeedsAreaLookup,
  resolveRentMarket, yenToMan, type RentMarketRow,
} from './rent-market'
import { CONFIG, CRITERIA_VERSION } from './criteria'

const base: Property = {
  name: 'テストマンション',
  price_man: 2800,
  area_sqm: 25,
  built_ym: '2015-04',
  address: '東京都品川区西五反田2丁目1-1',
  city: '品川区',
  line: '東急目黒線',
  station: '不動前',
  walk_min: 5,
  floor: 3,
  total_floors: 8,
  total_units: 40,
  land_right: '所有権',
  management_fee_yen: 8000,
  repair_reserve_yen: 8000,
}

function marketOf(city: string): MarketContext {
  const rent = resolveRentMarket([], city, null, null)
  if (!rent) throw new Error(`no rent for ${city}`)
  return {
    station_rent_1k_man: rent.rent_1k_man,
    rent_stock_1k_man: rent.rent_stock_man,
    rent_basis: rent.rent_basis,
    rent_correction_factor: rent.correction_factor,
    rent_correction_as_of: rent.correction_as_of,
    rent_level: rent.level,
    rent_scope_label: rent.scope_label,
    rent_source: rent.source,
    rent_as_of: rent.as_of,
    rent_segment: rent.segment,
    rent_sample_n: rent.sample_n,
  }
}

const census = marketOf('品川区')

function row(partial: Partial<RentMarketRow> & Pick<RentMarketRow, 'level' | 'city' | 'rent_1k_man'>): RentMarketRow {
  return {
    district: '',
    rent_1k_yen: null,
    sample_n: null,
    source: 'test',
    as_of: '2023-10-01',
    segment: RENT_SEGMENT,
    rent_basis: 'stock',
    rent_asking_man: null,
    rent_asking_yen: null,
    ...partial,
  }
}

test('円を万円に丸めると第130表のseedと一致する', () => {
  const sql = readFileSync(new URL('../../scripts/fudosan-rent-market.sql', import.meta.url), 'utf8')
  for (const ward of JONAN_RENT_1K) {
    const man = yenToMan(ward.rent_1k_yen)
    const asking = askingFromStockYen(ward.rent_1k_yen)
    assert.equal(sql.includes(String(ward.rent_1k_yen)), true, ward.city)
    assert.equal(sql.includes(man.toFixed(2)), true, `${ward.city} ${man}`)
    assert.equal(sql.includes(String(asking.askingYen)), true, `${ward.city} asking yen`)
    assert.equal(sql.includes(asking.askingMan.toFixed(2)), true, `${ward.city} asking man`)
  }
  assert.equal(sql.includes(String(askingFromStockYen(81353).factor)), true)
  assert.equal(yenToMan(81353), 8.14)
  assert.equal(yenToMan(85375), 8.54)
  assert.equal(yenToMan(71628), 7.16)
  assert.equal(yenToMan(75381), 7.54)
})

test('賃料の引き当ては町名、駅圏、区、同梱値の順', () => {
  const rows = [
    row({ level: 'town', city: '品川区', district: '西五反田', rent_1k_man: 11.2 }),
    row({ level: 'area', city: '品川区', district: '五反田', rent_1k_man: 10.4 }),
    row({ level: 'city', city: '品川区', rent_1k_man: 9.9 }),
  ]
  assert.equal(pickRentMarket(rows, '品川区', '西五反田', '五反田')?.rent_1k_man, 11.2)
  assert.equal(pickRentMarket(rows, '品川区', '西五反田', '五反田')?.level, 'town')
  assert.equal(pickRentMarket(rows, '品川区', '大崎', '五反田')?.rent_1k_man, 10.4)
  assert.equal(pickRentMarket(rows, '品川区', '大崎', '五反田')?.level, 'area')
  assert.equal(pickRentMarket(rows, '品川区', '大崎', null)?.rent_1k_man, 9.9)
  assert.equal(pickRentMarket([], '品川区', '大崎', null), null)
  const embedded = resolveRentMarket([], '品川区', '大崎', null)
  assert.equal(embedded?.rent_stock_man, 8.14)
  assert.equal(embedded?.rent_stock_yen, 81353)
  assert.equal(embedded?.rent_1k_man, askingFromStockYen(81353).askingMan)
  assert.equal(embedded?.level, 'city')
  assert.equal(embedded?.rent_basis, 'stock')
  const fromDb = resolveRentMarket(rows, '品川区', '大崎', null)
  assert.equal(fromDb?.scope_label, '品川区（区）')
  assert.equal(fromDb?.rent_stock_man, 9.9)
  assert.equal(fromDb?.rent_1k_man, askingFromStockYen(99000).askingMan)
  assert.notEqual(fromDb?.rent_1k_man, embedded?.rent_1k_man)
  assert.equal(resolveRentMarket([], '渋谷区', null, null), null)
})

test('駅圏の areaOf は、町名行が無く駅圏行があるときだけ要る', () => {
  const area = [row({ level: 'area', city: '品川区', district: '五反田', rent_1k_man: 10 })]
  assert.equal(rentNeedsAreaLookup(area, '品川区', '西五反田'), true)
  assert.equal(rentNeedsAreaLookup([
    row({ level: 'town', city: '品川区', district: '西五反田', rent_1k_man: 11 }),
    ...area,
  ], '品川区', '西五反田'), false)
  assert.equal(rentNeedsAreaLookup([
    row({ level: 'city', city: '品川区', rent_1k_man: 8.14 }),
  ], '品川区', '西五反田'), false)
})

test('Supabaseのnumeric文字列も行として読める', () => {
  const parsed = normalizeRentRow({
    level: 'city', city: '大田区', district: '', rent_1k_man: '7.16', rent_1k_yen: '71628', sample_n: '73140',
  })
  assert.equal(parsed?.rent_1k_man, 7.16)
  assert.equal(parsed?.sample_n, 73140)
  assert.equal(normalizeRentRow({ level: 'city', city: '大田区', rent_1k_man: 0 }), null)
})

test('e-Statの応答から29㎡以下・非木造・0円を含まない平均だけを取る', () => {
  const body = {
    GET_STATS_DATA: {
      RESULT: { STATUS: 0 },
      STATISTICAL_DATA: {
        CLASS_INF: {
          CLASS_OBJ: [
            { '@id': 'cat01', '@name': '住宅の建て方', CLASS: [
              { '@code': '0', '@name': '総数' },
              { '@code': '3', '@name': '共同住宅(木造)' },
              { '@code': '4', '@name': '共同住宅(非木造)' },
            ] },
            { '@id': 'cat02', '@name': '住宅の延べ面積', CLASS: [
              { '@code': '0', '@name': '総数' },
              { '@code': '1', '@name': '29ｍ2以下' },
              { '@code': '2', '@name': '30～49ｍ2' },
            ] },
            { '@id': 'cat03', '@name': '住宅の家賃の平均', CLASS: [
              { '@code': '1', '@name': '家賃０円を含む' },
              { '@code': '2', '@name': '家賃０円を含まない' },
            ] },
          ],
        },
        DATA_INF: {
          VALUE: [
            { '@cat01': '4', '@cat02': '1', '@cat03': '1', '@area': '13109', $: '81083' },
            { '@cat01': '4', '@cat02': '1', '@cat03': '2', '@area': '13109', $: '81353' },
            { '@cat01': '4', '@cat02': '2', '@cat03': '2', '@area': '13109', $: '125778' },
            { '@cat01': '3', '@cat02': '1', '@cat03': '2', '@area': '13109', $: '67669' },
            { '@cat01': '4', '@cat02': '1', '@cat03': '2', '@area': '13110', $: '85375' },
            { '@cat01': '4', '@cat02': '1', '@cat03': '2', '@area': '99999', $: '50000' },
          ],
        },
      },
    },
  }
  const got = parseEstatRentPayload(body)
  assert.deepEqual(got.map(r => r.city), ['品川区', '目黒区'])
  assert.equal(got[0].rent_1k_yen, 81353)
  assert.equal(parseEstatRentPayload({ GET_STATS_DATA: { STATISTICAL_DATA: {} } }).length, 0)
})

test('在庫行は保存済みの募集スナップショットを使わず、現行係数で掛け直す', () => {
  const got = resolveRentMarket([
    row({
      level: 'city', city: '品川区', rent_1k_man: 8.14, rent_1k_yen: 81353,
      rent_asking_man: 99, rent_basis: 'stock',
    }),
  ], '品川区', null, null)
  assert.equal(got?.rent_stock_man, 8.14)
  assert.equal(got?.rent_1k_man, askingFromStockYen(81353).askingMan)
  assert.equal(got?.correction_factor, askingFromStockYen(81353).factor)
  assert.equal(got?.rent_1k_man, 12.07)
})

test('12万円は募集相当の1.15倍以内で、それを超える賃料だけ減点する', () => {
  const bench = census.station_rent_1k_man!
  assert.equal(bench, 12.07)
  assert.equal(census.rent_stock_1k_man, 8.14)
  assert.ok(12 <= bench * RENT_ABOVE_MARKET)
  const none = evaluate({ ...base, rent_man: 12 }, {})
  const withRent = evaluate({ ...base, rent_man: 12 }, census)
  assert.equal(none.warnings.some(w => w.tag.includes('1K相場')), false)
  assert.equal(none.todo.some(t => t.includes('1K相場')), false)
  assert.equal(none.metrics.rent_market_note, undefined)
  assert.equal(withRent.criteria_version, CRITERIA_VERSION)
  assert.equal(withRent.warnings.some(w => w.tag.includes('1K相場')), false)
  assert.equal(withRent.score, none.score)
  assert.equal(withRent.metrics.rent_market_1k_man, 12.07)
  assert.equal(withRent.metrics.rent_market_stock_man, 8.14)
  assert.match(String(withRent.metrics.rent_market_note), /在庫平均 8\.14万円/)
  assert.match(String(withRent.metrics.rent_market_note), /1K相場 12\.07万円/)
  assert.match(toMessage({ ...base, rent_man: 12 }, withRent), /1K相場 12\.07万円/)

  const high = 14
  assert.ok(high > bench * RENT_ABOVE_MARKET)
  const noneHigh = evaluate({ ...base, rent_man: high }, {})
  const withHigh = evaluate({ ...base, rent_man: high }, census)
  assert.equal(withHigh.warnings.some(w => w.pt === -10 && w.tag.includes('品川区（区）')), true)
  assert.equal(withHigh.score, (noneHigh.score ?? 0) - 10)
  assert.ok((withHigh.metrics.rent_vs_market as number) > 0)
})

test('月12万円は城南4区とも募集相当の減点線を超えず、大田の14万円は超える', () => {
  // 32㎡・3200万円・中延。2800万円だと点数が100で頭打ちになり、区の減点が見えない。
  const fixture = { ...base, price_man: 3200, area_sqm: 32, station: '中延', line: '東急大井町線' }
  const expected = [
    { city: '品川区', asking: 12.07, vs: -0.6, score: 97, verdict: 'A' },
    { city: '目黒区', asking: 12.66, vs: -5.2, score: 99, verdict: 'A' },
    { city: '大田区', asking: 10.62, vs: 13, score: 84, verdict: 'A' },
    { city: '世田谷区', asking: 11.18, vs: 7.3, score: 88, verdict: 'A' },
  ] as const
  for (const exp of expected) {
    const market = marketOf(exp.city)
    assert.equal(market.station_rent_1k_man, exp.asking)
    assert.ok(12 <= exp.asking * CONFIG.rent.aboveMarket, exp.city)
    const scored = evaluate({
      ...fixture,
      rent_man: 12,
      city: exp.city,
      address: `東京都${exp.city}中延1-2-3`,
    }, market)
    const plain = evaluate({
      ...fixture,
      rent_man: 12,
      city: exp.city,
      address: `東京都${exp.city}中延1-2-3`,
    }, {})
    assert.equal(scored.warnings.some(w => w.tag.includes('1K相場')), false, exp.city)
    assert.equal(scored.metrics.rent_vs_market, exp.vs, exp.city)
    assert.equal(scored.verdict, exp.verdict, exp.city)
    assert.equal(scored.score, exp.score, exp.city)
    assert.equal(scored.score, plain.score, exp.city)
  }
  const ota = marketOf('大田区')
  const over = evaluate({
    ...fixture,
    rent_man: 14,
    city: '大田区',
    address: '東京都大田区中延1-2-3',
  }, ota)
  const plain = evaluate({
    ...fixture,
    rent_man: 14,
    city: '大田区',
    address: '東京都大田区中延1-2-3',
  }, {})
  assert.ok(14 > ota.station_rent_1k_man! * CONFIG.rent.aboveMarket)
  assert.equal(over.warnings.some(w => w.pt === -10 && w.tag.includes('1K相場')), true)
  assert.equal(over.score, (plain.score ?? 0) - 10)
})

test('賃料不明でも必要家賃と募集相当の1K相場の突き合わせが出る', () => {
  const pending = evaluate({ ...base, rent_man: null }, census)
  assert.equal(pending.verdict, 'PENDING')
  assert.equal(pending.warnings.some(w => w.tag.includes('1K相場')), false)
  const line = pending.todo.find(t => t.includes('1K相場'))
  assert.ok(line)
  assert.match(line!, /12\.07万円/)
  assert.match(line!, /募集相当/)
  assert.match(line!, /必要家賃/)
  const silent = evaluate({ ...base, rent_man: null }, {})
  assert.equal(silent.todo.some(t => t.includes('1K相場')), false)
})

test('テーブルが無くても住所から区の同梱相場が付く', async () => {
  const market = await loadMarketContext({
    address: '東京都目黒区平町1-2-3',
    city: '目黒区',
  }, [])
  assert.equal(market.rent_stock_1k_man, 8.54)
  assert.equal(market.station_rent_1k_man, askingFromStockYen(85375).askingMan)
  assert.equal(market.rent_level, 'city')
  assert.equal(market.rent_scope_label, '目黒区（区）')
  assert.equal(market.matched_level, 'none')

  const observed = row({
    level: 'town', city: '品川区', district: '西五反田',
    rent_1k_man: 11.5, rent_1k_yen: 115000, rent_basis: 'asking',
  })
  const town = await loadMarketContext({
    address: '東京都品川区西五反田2丁目1-1',
    city: '品川区',
  }, [observed])
  assert.equal(town.station_rent_1k_man, 11.5)
  assert.equal(town.rent_stock_1k_man, null)
  assert.equal(town.rent_basis, 'asking')
  assert.equal(town.rent_level, 'town')
  assert.equal(town.rent_scope_label, '品川区西五反田（町名）')

  const stockTown = await loadMarketContext({
    address: '東京都品川区西五反田2丁目1-1',
    city: '品川区',
  }, [row({
    level: 'town', city: '品川区', district: '西五反田',
    rent_1k_man: 11.5, rent_1k_yen: 115000, rent_basis: 'stock',
  })])
  assert.equal(stockTown.station_rent_1k_man, askingFromStockYen(115000).askingMan)
  assert.notEqual(stockTown.station_rent_1k_man, 11.5)
})
