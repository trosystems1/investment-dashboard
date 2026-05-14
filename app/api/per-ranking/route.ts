import { NextResponse } from 'next/server'

const CODE_MAP: Record<string, { name: string; ticker: string }> = {
  '228A0': { name: 'opro',          ticker: '228A.T' },
  '43970': { name: 'TeamSpirit',    ticker: '4397.T' },
  '47760': { name: 'Cybozu',        ticker: '4776.T' },
  '48110': { name: 'Dream Arts',    ticker: '4811.T' },
  '43740': { name: 'ROBOT PAYMENT', ticker: '4374.T' },
  '431A0': { name: 'uSonar',         ticker: '431A.T' },
  '44430': { name: 'Sansan',        ticker: '4443.T' },
  '44780': { name: 'freee',         ticker: '4478.T' },
  '39940': { name: 'MoneyForward',  ticker: '3994.T' },
  '40580': { name: 'Toyokumo',      ticker: '4058.T' },
}

export async function GET() {
  const apiKey = process.env.JQUANTS_API_KEY!
  const today = new Date()
  const from = new Date(today)
  from.setDate(from.getDate() - 7)
  const fromStr = from.toISOString().split('T')[0].replace(/-/g, '')
  const toStr = today.toISOString().split('T')[0].replace(/-/g, '')

  const results = await Promise.all(
    Object.entries(CODE_MAP).map(async ([code, meta]) => {
      try {
        const [priceRes, finRes] = await Promise.all([
          fetch(`https://api.jquants.com/v2/equities/bars/daily?code=${code}&from=${fromStr}&to=${toStr}`, {
            headers: { 'x-api-key': apiKey }
          }),
          fetch(`https://api.jquants.com/v2/fins/summary?code=${code}`, {
            headers: { 'x-api-key': apiKey }
          }),
        ])
        const priceJson = await priceRes.json()
        const finJson = await finRes.json()

        const prices: any[] = priceJson.data || []
        prices.sort((a, b) => b.Date.localeCompare(a.Date))
        const price = prices[0]?.C

        const fins: any[] = (finJson.data || []).sort((a: any, b: any) => b.DiscDate.localeCompare(a.DiscDate))
        const fin = fins[0] || {}
        const eps = parseFloat(fin.FEPS || fin.EPS || '0')

        if (!price || !eps || eps <= 0) return null

        const per = parseFloat((price / eps).toFixed(1))
        return { ticker: meta.ticker, name: meta.name, per, price, eps }
      } catch {
        return null
      }
    })
  )

  const data = results
    .filter(Boolean)
    .sort((a: any, b: any) => b.per - a.per)
    .slice(0, 10)

  return NextResponse.json({ data })
}