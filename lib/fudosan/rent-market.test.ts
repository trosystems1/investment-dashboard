import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { evaluate, toMessage, type MarketContext, type Property } from './score'
import { loadMarketContext } from './market'
import {
  JONAN_RENT_1K, RENT_ABOVE_MARKET, RENT_SEGMENT,
  normalizeRentRow, parseEstatRentPayload, pickRentMarket, rentNeedsAreaLookup,
  resolveRentMarket, yenToMan, type RentMarketRow,
} from './rent-market'
import { CRITERIA_VERSION } from './criteria'

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

const census: MarketContext = {
  station_rent_1k_man: 8.14,
  rent_level: 'city',
  rent_scope_label: '品川区（区）',
  rent_source: 'e-Stat 令和5年住宅・土地統計調査 基本集計 第130表',
  rent_as_of: '2023-10-01',
  rent_segment: RENT_SEGMENT,
  rent_sample_n: 49650,
}

function row(partial: Partial<RentMarketRow> & Pick<RentMarketRow, 'level' | 'city' | 'rent_1k_man'>): RentMarketRow {
  return {
    district: '',
    rent_1k_yen: null,
    sample_n: null,
    source: 'test',
    as_of: '2023-10-01',
    segment: RENT_SEGMENT,
    ...partial,
  }
}

test('円を万円に丸めると第130表のseedと一致する', () => {
  const sql = readFileSync(new URL('../../scripts/fudosan-rent-market.sql', import.meta.url), 'utf8')
  for (const ward of JONAN_RENT_1K) {
    const man = yenToMan(ward.rent_1k_yen)
    assert.equal(sql.includes(String(ward.rent_1k_yen)), true, ward.city)
    assert.equal(sql.includes(man.toFixed(2)), true, `${ward.city} ${man}`)
  }
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
  assert.equal(pickRentMarket(rows, '品川区', '大崎', null)?.scope_label, '品川区（区）')
  assert.equal(pickRentMarket([], '品川区', '大崎', null), null)
  assert.equal(resolveRentMarket([], '品川区', '大崎', null)?.rent_1k_man, 8.14)
  assert.equal(resolveRentMarket([], '品川区', '大崎', null)?.level, 'city')
  assert.equal(resolveRentMarket(rows, '品川区', '大崎', null)?.rent_1k_man, 9.9)
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

test('相場が無いときは賃料チェックも注記も出ない', () => {
  const none = evaluate({ ...base, rent_man: 12 }, {})
  const withRent = evaluate({ ...base, rent_man: 12 }, census)
  assert.equal(none.warnings.some(w => w.tag.includes('1K相場')), false)
  assert.equal(none.todo.some(t => t.includes('1K相場')), false)
  assert.equal(none.metrics.rent_market_note, undefined)
  assert.equal(withRent.criteria_version, CRITERIA_VERSION)
  assert.equal(withRent.warnings.some(w => w.pt === -10 && w.tag.includes('8.14')), true)
  assert.equal(withRent.score, (none.score ?? 0) - 10)
  assert.equal(withRent.metrics.rent_market_1k_man, 8.14)
  assert.equal(typeof withRent.metrics.rent_market_note, 'string')
  assert.match(String(withRent.metrics.rent_market_note), /在庫平均/)
  assert.match(toMessage({ ...base, rent_man: 12 }, withRent), /1K相場 8\.14万円/)
})

test('相場の1.15倍以内なら減点せず、相場自体は表示する', () => {
  const underRent = 9
  assert.ok(underRent <= 8.14 * RENT_ABOVE_MARKET)
  const under = evaluate({ ...base, rent_man: underRent }, census)
  assert.equal(under.warnings.some(w => w.tag.includes('1K相場')), false)
  assert.equal(under.metrics.rent_market_1k_man, 8.14)
  assert.equal(under.todo.some(t => t.includes('在庫平均')), false)
  const over = evaluate({ ...base, rent_man: 12 }, census)
  assert.ok(12 > 8.14 * RENT_ABOVE_MARKET)
  assert.equal(over.warnings.some(w => w.tag.includes('品川区（区）')), true)
  assert.ok((over.metrics.rent_vs_market as number) > 0)
})

test('賃料不明でも必要家賃と1K相場の突き合わせが出る', () => {
  const pending = evaluate({ ...base, rent_man: null }, census)
  assert.equal(pending.verdict, 'PENDING')
  assert.equal(pending.warnings.some(w => w.tag.includes('1K相場')), false)
  const line = pending.todo.find(t => t.includes('1K相場'))
  assert.ok(line)
  assert.match(line!, /8\.14万円/)
  assert.match(line!, /必要家賃/)
  const silent = evaluate({ ...base, rent_man: null }, {})
  assert.equal(silent.todo.some(t => t.includes('1K相場')), false)
})

test('テーブルが無くても住所から区の同梱相場が付く', async () => {
  const market = await loadMarketContext({
    address: '東京都目黒区平町1-2-3',
    city: '目黒区',
  }, [])
  assert.equal(market.station_rent_1k_man, 8.54)
  assert.equal(market.rent_level, 'city')
  assert.equal(market.rent_scope_label, '目黒区（区）')
  assert.equal(market.matched_level, 'none')

  const town = await loadMarketContext({
    address: '東京都品川区西五反田2丁目1-1',
    city: '品川区',
  }, [row({ level: 'town', city: '品川区', district: '西五反田', rent_1k_man: 11.5, rent_1k_yen: 115000 })])
  assert.equal(town.station_rent_1k_man, 11.5)
  assert.equal(town.rent_level, 'town')
  assert.equal(town.rent_scope_label, '品川区西五反田（町名）')
})
