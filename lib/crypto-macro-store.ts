import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export interface MacroDataPoint {
  timestamp: string
  value: number
}

const DOMINANCE_KEY = 'crypto:macro:btc_dominance'
const STABLECOIN_KEY = 'crypto:macro:stablecoin_supply'
const MAX_POINTS = 720

export async function getBtcDominanceHistory(): Promise<MacroDataPoint[]> {
  return (await redis.get<MacroDataPoint[]>(DOMINANCE_KEY)) ?? []
}

export async function getStablecoinSupplyHistory(): Promise<MacroDataPoint[]> {
  return (await redis.get<MacroDataPoint[]>(STABLECOIN_KEY)) ?? []
}

export async function appendBtcDominance(value: number): Promise<void> {
  const history = await getBtcDominanceHistory()
  history.push({ timestamp: new Date().toISOString(), value })
  await redis.set(DOMINANCE_KEY, history.slice(-MAX_POINTS))
}

export async function appendStablecoinSupply(value: number): Promise<void> {
  const history = await getStablecoinSupplyHistory()
  history.push({ timestamp: new Date().toISOString(), value })
  await redis.set(STABLECOIN_KEY, history.slice(-MAX_POINTS))
}

export async function getMacroSnapshot() {
  const [btcDominance, stablecoinSupply] = await Promise.all([
    getBtcDominanceHistory(),
    getStablecoinSupplyHistory(),
  ])
  return {
    btcDominance,
    stablecoinSupply,
    latestDominance: btcDominance.at(-1) ?? null,
    latestStablecoin: stablecoinSupply.at(-1) ?? null,
  }
}
