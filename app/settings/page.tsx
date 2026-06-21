'use client'

import { useEffect, useRef, useState } from 'react'

const BUILTIN_NAMES: Record<string, string> = {
  '228A0': 'オプロ',
  '43970': 'チームスピリット',
  '43740': 'ROBOT PAYMENT',
  '431A0': 'ユーソナー',
  '44430': 'Sansan',
  '44780': 'freee',
  '39940': 'マネーフォワード',
  '47760': 'サイボウズ',
  '40580': 'トヨクモ',
  '48110': 'ドリーム・アーツ',
}

const SIGNAL_PRESETS = [
  { label: '出来高急増', description: '出来高が過去20日平均の3倍を超えており、かつ終値が前日比+2%以上の場合にシグナルを出す。' },
  { label: 'ゴールデンクロス', description: '終値の25日移動平均を5日移動平均が下から上に突き抜けた場合にシグナルを出す。' },
  { label: 'デッドクロス', description: '終値の25日移動平均を5日移動平均が上から下に突き抜けた場合にシグナルを出す。' },
  { label: '5日連続上昇', description: '直近5日間の終値が連続して上昇しており、かつ出来高が増加傾向にある場合にシグナルを出す。' },
  { label: '逆三尊', description: '直近25日間の価格データから逆三尊（インバース・ヘッドアンドショルダー）パターンを検出した場合にシグナルを出す。左肩・頭・右肩の形成とネックラインの突破を確認すること。' },
  { label: 'ダブルボトム', description: '直近25日間で二つの底値が近い水準で形成され、その間の高値を終値が上回った場合にシグナルを出す。' },
  { label: 'RSI過売り', description: '14日間のRSIが30を下回った場合にシグナルを出す。' },
  { label: 'RSI過買い', description: '14日間のRSIが70を超えた場合にシグナルを出す。' },
  { label: 'ボリンジャー下抜け', description: '終値が20日移動平均±2σのボリンジャーバンド下限を下回った場合にシグナルを出す。' },
  { label: '移動平均乖離', description: '終値が25日移動平均から+10%以上乖離している場合にシグナルを出す。' },
]

interface SearchResult {
  code: string
  name: string
  market: string
}

interface LastRun {
  timestamp: string
  signalCount: number
  signals: string[]
  tickerCount?: number
}

interface HistoryEntry {
  date: string
  signals: string[]
  checkedAt: string
}

interface WatchlistItem {
  ticker: string
  companyName: string
  history: HistoryEntry[]
}

interface CryptoSettings {
  productCodes: string[]
  rsiPeriod: number
  rsiThreshold: number
  volumeLookback: number
  volumeMultiplier: number
  notifyCooldownMinutes: number
  enabled: boolean
}

interface CryptoLastRun {
  timestamp: string
  results: Array<{
    productCode: string
    newExecutions: number
    candleCount: number
    evaluation: { rsi: number | null; volumeRatio: number | null; triggered: boolean; reason: string }
    notified: boolean
  }>
}

export default function SettingsPage() {
  const [tickers, setTickers] = useState<string[]>([])
  const [nameMap, setNameMap] = useState<Record<string, string>>(BUILTIN_NAMES)
  const [input, setInput] = useState('')
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [rules, setRules] = useState<string[]>([])
  const [newRule, setNewRule] = useState('')
  const [rulesSaving, setRulesSaving] = useState(false)
  const [rulesSaved, setRulesSaved] = useState(false)
  const [lastRun, setLastRun] = useState<LastRun | null>(null)
  const [watchlistHistory, setWatchlistHistory] = useState<WatchlistItem[]>([])

  const [cryptoSettings, setCryptoSettings] = useState<CryptoSettings>({
    productCodes: ['BTC_JPY'],
    rsiPeriod: 14,
    rsiThreshold: 30,
    volumeLookback: 12,
    volumeMultiplier: 3,
    notifyCooldownMinutes: 30,
    enabled: true,
  })
  const [cryptoProductInput, setCryptoProductInput] = useState('')
  const [cryptoSaving, setCryptoSaving] = useState(false)
  const [cryptoSaved, setCryptoSaved] = useState(false)
  const [cryptoLastRun, setCryptoLastRun] = useState<CryptoLastRun | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    fetch('/api/settings/watchlist')
      .then((r) => r.json())
      .then((d) => {
        const codes: string[] = d.tickers ?? []
        setTickers(codes)
        const unknown = codes.filter((c) => !BUILTIN_NAMES[c])
        if (unknown.length > 0) {
          Promise.all(
            unknown.map((c) =>
              fetch(`/api/stock-search?q=${encodeURIComponent(c)}`)
                .then((r) => r.json())
                .then((d) => d.results?.[0])
            )
          ).then((results) => {
            const extra: Record<string, string> = {}
            results.forEach((r) => {
              if (r) extra[r.code] = r.name
            })
            setNameMap((prev) => ({ ...prev, ...extra }))
          })
        }
      })
    fetch('/api/settings/signal')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.rules)) setRules(d.rules)
        else if (d.prompt) setRules([d.prompt])
        if (d.lastRun) setLastRun(d.lastRun)
      })
    fetch('/api/watchlist')
      .then((r) => r.json())
      .then((d) => setWatchlistHistory(d.watchlist ?? []))
      .catch(() => {})
    fetch('/api/settings/crypto')
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setCryptoSettings(d.settings)
        if (d.lastRun) setCryptoLastRun(d.lastRun)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (input.length < 2) {
      setSuggestions([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/stock-search?q=${encodeURIComponent(input)}`)
        const data = await res.json()
        setSuggestions(data.results ?? [])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [input])

  const addTicker = (code: string, name: string) => {
    if (!tickers.includes(code)) {
      setTickers((prev) => [...prev, code])
      setNameMap((prev) => ({ ...prev, [code]: name }))
    }
    setInput('')
    setSuggestions([])
  }

  const removeTicker = (code: string) => {
    setTickers((prev) => prev.filter((t) => t !== code))
  }

  const save = async () => {
    setSaving(true)
    await fetch('/api/settings/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickers }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const addRule = (text?: string) => {
    const rule = (text ?? newRule).trim()
    if (!rule || rules.includes(rule)) return
    setRules((prev) => [...prev, rule])
    setNewRule('')
  }

  const removeRule = (i: number) => setRules((prev) => prev.filter((_, idx) => idx !== i))

  const saveRules = async () => {
    setRulesSaving(true)
    await fetch('/api/settings/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules }),
    })
    setRulesSaving(false)
    setRulesSaved(true)
    setTimeout(() => setRulesSaved(false), 2000)
  }

  const addCryptoProduct = (code: string) => {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed || cryptoSettings.productCodes.includes(trimmed)) return
    setCryptoSettings((prev) => ({ ...prev, productCodes: [...prev.productCodes, trimmed] }))
    setCryptoProductInput('')
  }

  const removeCryptoProduct = (code: string) => {
    setCryptoSettings((prev) => ({
      ...prev,
      productCodes: prev.productCodes.filter((c) => c !== code),
    }))
  }

  const saveCrypto = async () => {
    setCryptoSaving(true)
    const res = await fetch('/api/settings/crypto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cryptoSettings),
    })
    const data = await res.json()
    if (data.settings) setCryptoSettings(data.settings)
    setCryptoSaving(false)
    setCryptoSaved(true)
    setTimeout(() => setCryptoSaved(false), 2000)
  }

  const ruleBtn = (active: boolean, disabled = false): React.CSSProperties => ({
    background: active ? 'rgba(72,196,100,0.2)' : 'rgba(196,156,72,0.15)',
    border: `1px solid ${active ? 'rgba(72,196,100,0.5)' : 'rgba(196,156,72,0.4)'}`,
    color: active ? '#48c464' : '#c49c48',
    borderRadius: 4,
    padding: '0.5rem 1.25rem',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    fontSize: '0.9rem',
  })

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#e5e0d0', padding: '2rem' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <p style={{ color: '#c49c48', fontSize: '0.75rem', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>
          APEX DASHBOARD
        </p>
        <h1 style={{ fontSize: '2rem', fontWeight: 300, marginBottom: '0.5rem' }}>シグナル設定</h1>
        <p style={{ color: '#888', marginBottom: '2rem' }}>ウォッチリストと検出ルールを管理します。</p>

        <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#c49c48', fontSize: '0.8rem', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            ウォッチリスト（銘柄コード）
          </h2>
          <p style={{ color: '#666', fontSize: '0.8rem', marginBottom: '1rem' }}>
            会社名または銘柄コードで検索できます。末尾「0」は自動付加されます。
          </p>

          <div style={{ position: 'relative', display: 'flex', gap: 8, marginBottom: '1rem' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="会社名または銘柄コード（例: freee, 4478）"
                style={{
                  width: '100%',
                  background: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: 4,
                  color: '#e5e0d0',
                  padding: '0.6rem 0.75rem',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {(suggestions.length > 0 || searching) && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#1e1e1e',
                  border: '1px solid #333',
                  borderRadius: 4,
                  zIndex: 100,
                  maxHeight: 240,
                  overflowY: 'auto',
                }}>
                  {searching && (
                    <div style={{ padding: '0.5rem 0.75rem', color: '#666', fontSize: '0.85rem' }}>検索中...</div>
                  )}
                  {suggestions.map((s) => (
                    <button
                      key={s.code}
                      onClick={() => addTicker(s.code, s.name)}
                      style={{
                        display: 'flex',
                        width: '100%',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.5rem 0.75rem',
                        background: 'transparent',
                        border: 'none',
                        color: '#e5e0d0',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        textAlign: 'left',
                        gap: 8,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#2a2a2a')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span>{s.name}</span>
                      <span style={{ color: '#c49c48', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                        {s.code} · {s.market}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '1rem' }}>
            {tickers.map((code) => (
              <span
                key={code}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(196,156,72,0.1)',
                  border: '1px solid rgba(196,156,72,0.3)',
                  borderRadius: 4,
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.85rem',
                  color: '#c49c48',
                }}
              >
                <span style={{ color: '#888', fontSize: '0.75rem' }}>{code}</span>
                <span>{nameMap[code] ?? '...'}</span>
                <button
                  onClick={() => removeTicker(code)}
                  style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <button
            onClick={save}
            disabled={saving}
            style={{
              background: saved ? 'rgba(72,196,100,0.2)' : 'rgba(196,156,72,0.15)',
              border: `1px solid ${saved ? 'rgba(72,196,100,0.5)' : 'rgba(196,156,72,0.4)'}`,
              color: saved ? '#48c464' : '#c49c48',
              borderRadius: 4,
              padding: '0.5rem 1.25rem',
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            {saving ? '保存中...' : saved ? '✓ 保存しました' : `保存（${tickers.length}銘柄）`}
          </button>
        </div>

        <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#c49c48', fontSize: '0.8rem', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            シグナル検出ルール
          </h2>
          <p style={{ color: '#666', fontSize: '0.8rem', marginBottom: '1rem' }}>
            複数のルールを登録できます。全ルールを同時にチェックします。
          </p>

          {rules.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
              {rules.map((rule, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    background: '#1a1a1a',
                    border: '1px solid #2a2a2a',
                    borderRadius: 4,
                    padding: '0.75rem 1rem',
                  }}
                >
                  <span style={{ color: '#c49c48', fontSize: '0.8rem', minWidth: 20 }}>{i + 1}</span>
                  <span style={{ flex: 1, fontSize: '0.9rem', lineHeight: 1.5 }}>{rule}</span>
                  <button
                    onClick={() => removeRule(i)}
                    style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 0 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            value={newRule}
            onChange={(e) => setNewRule(e.target.value)}
            placeholder="新しいルールを入力..."
            rows={3}
            style={{
              width: '100%',
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 4,
              color: '#e5e0d0',
              padding: '0.6rem 0.75rem',
              fontSize: '0.9rem',
              lineHeight: 1.6,
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
              marginBottom: '0.75rem',
            }}
          />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <button onClick={() => addRule()} disabled={!newRule.trim()} style={ruleBtn(false, !newRule.trim())}>
              + ルールを追加
            </button>
            <button onClick={saveRules} disabled={rulesSaving || rules.length === 0} style={ruleBtn(rulesSaved, rulesSaving || rules.length === 0)}>
              {rulesSaving ? '保存中...' : rulesSaved ? '✓ 保存しました' : `保存（${rules.length}件）`}
            </button>
          </div>
        </div>

        <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#c49c48', fontSize: '0.8rem', letterSpacing: '0.1em', marginBottom: '1rem' }}>
            おすすめルール（クリックで追加）
          </h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SIGNAL_PRESETS.map((preset, i) => {
              const already = rules.includes(preset.description)
              return (
                <button
                  key={i}
                  onClick={() => !already && addRule(preset.description)}
                  title={preset.description}
                  style={{
                    background: already ? 'rgba(196,156,72,0.15)' : '#1a1a1a',
                    border: `1px solid ${already ? 'rgba(196,156,72,0.4)' : '#333'}`,
                    borderRadius: 4,
                    padding: '0.4rem 0.8rem',
                    color: already ? '#c49c48' : '#999',
                    fontSize: '0.8rem',
                    cursor: already ? 'default' : 'pointer',
                  }}
                >
                  {already ? '✓ ' : '+ '}{preset.label}
                </button>
              )
            })}
          </div>
        </div>

        {lastRun && (
          <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h2 style={{ color: '#c49c48', fontSize: '0.8rem', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
              最終実行結果
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#888', margin: '0 0 0.5rem' }}>
              {new Date(lastRun.timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
              {lastRun.tickerCount ? `　${lastRun.tickerCount}銘柄チェック` : ''}
              　{lastRun.signalCount > 0 ? `🔔 ${lastRun.signalCount}件検出` : '✓ シグナルなし'}
            </p>
            {lastRun.signals.map((s, i) => (
              <div
                key={i}
                style={{
                  background: '#1a1a1a',
                  border: '1px solid #2a2a2a',
                  borderRadius: 4,
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.85rem',
                  color: '#ccc',
                  marginTop: 8,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {s}
              </div>
            ))}
            {watchlistHistory.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <p style={{ fontSize: '0.75rem', color: '#666', letterSpacing: '0.08em', margin: '0 0 10px' }}>
                  銘柄別チェック履歴（直近）
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {watchlistHistory.map((item) => {
                    const latest = item.history[0]
                    return (
                      <div
                        key={item.ticker}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          gap: 12,
                          background: '#1a1a1a',
                          border: '1px solid #2a2a2a',
                          borderRadius: 4,
                          padding: '0.5rem 0.75rem',
                          fontSize: '0.85rem',
                        }}
                      >
                        <span style={{ color: '#ccc' }}>
                          {item.companyName}
                          <span style={{ color: '#666', marginLeft: 8, fontSize: '0.75rem' }}>{item.ticker}</span>
                        </span>
                        <span style={{ color: latest?.signals.length ? '#c49c48' : '#666', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {latest
                            ? (latest.signals.length > 0 ? `🔔 ${latest.signals.length}件` : '✓ なし')
                            : '未チェック'}
                          {latest?.date ? <span style={{ color: '#555', marginLeft: 8, fontSize: '0.75rem' }}>{latest.date}</span> : null}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ background: '#141414', border: '1px solid #4338ca', borderRadius: 8, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h2 style={{ color: '#818cf8', fontSize: '0.8rem', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            暗号資産シグナル（bitFlyer）
          </h2>
          <p style={{ color: '#666', fontSize: '0.8rem', marginBottom: '1rem' }}>
            5分足 RSI + 出来高スパイク検知。外部Cron（5分おき）で <code style={{ color: '#888' }}>/api/cron/crypto-signal</code> を呼び出します。
          </p>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1rem', cursor: 'pointer', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={cryptoSettings.enabled}
              onChange={(e) => setCryptoSettings((prev) => ({ ...prev, enabled: e.target.checked }))}
            />
            暗号資産シグナルを有効にする
          </label>

          <p style={{ color: '#888', fontSize: '0.8rem', margin: '0 0 0.5rem' }}>監視ペア（product_code）</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: '0.75rem' }}>
            <input
              value={cryptoProductInput}
              onChange={(e) => setCryptoProductInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCryptoProduct(cryptoProductInput)}
              placeholder="BTC_JPY, ETH_BTC など"
              style={{
                flex: 1,
                background: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: 4,
                color: '#e5e0d0',
                padding: '0.6rem 0.75rem',
                fontSize: '0.9rem',
                outline: 'none',
              }}
            />
            <button
              onClick={() => addCryptoProduct(cryptoProductInput)}
              disabled={!cryptoProductInput.trim()}
              style={ruleBtn(false, !cryptoProductInput.trim())}
            >
              追加
            </button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '1rem' }}>
            {cryptoSettings.productCodes.map((code) => (
              <span
                key={code}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(129,140,248,0.1)',
                  border: '1px solid rgba(129,140,248,0.3)',
                  borderRadius: 4,
                  padding: '0.3rem 0.6rem',
                  fontSize: '0.85rem',
                  color: '#818cf8',
                }}
              >
                {code}
                <button
                  onClick={() => removeCryptoProduct(code)}
                  style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 0, lineHeight: 1 }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: '1rem' }}>
            {[
              { key: 'rsiPeriod' as const, label: 'RSI期間', step: 1 },
              { key: 'rsiThreshold' as const, label: 'RSI閾値（未満でシグナル）', step: 1 },
              { key: 'volumeLookback' as const, label: '出来高平均本数', step: 1 },
              { key: 'volumeMultiplier' as const, label: '出来高倍率', step: 0.1 },
              { key: 'notifyCooldownMinutes' as const, label: '再通知クールダウン（分）', step: 5 },
            ].map(({ key, label, step }) => (
              <label key={key} style={{ fontSize: '0.8rem', color: '#888' }}>
                {label}
                <input
                  type="number"
                  step={step}
                  value={cryptoSettings[key]}
                  onChange={(e) =>
                    setCryptoSettings((prev) => ({ ...prev, [key]: Number(e.target.value) }))
                  }
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: 4,
                    background: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: 4,
                    color: '#e5e0d0',
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                  }}
                />
              </label>
            ))}
          </div>

          <button
            onClick={saveCrypto}
            disabled={cryptoSaving || cryptoSettings.productCodes.length === 0}
            style={ruleBtn(cryptoSaved, cryptoSaving || cryptoSettings.productCodes.length === 0)}
          >
            {cryptoSaving ? '保存中...' : cryptoSaved ? '✓ 保存しました' : '暗号資産設定を保存'}
          </button>

          {cryptoLastRun && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #2a2a2a' }}>
              <p style={{ fontSize: '0.75rem', color: '#666', margin: '0 0 8px' }}>最終Cron実行</p>
              <p style={{ fontSize: '0.85rem', color: '#888', margin: '0 0 8px' }}>
                {new Date(cryptoLastRun.timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
              </p>
              {cryptoLastRun.results.map((r) => (
                <div
                  key={r.productCode}
                  style={{
                    background: '#1a1a1a',
                    border: '1px solid #2a2a2a',
                    borderRadius: 4,
                    padding: '0.5rem 0.75rem',
                    fontSize: '0.85rem',
                    color: '#ccc',
                    marginTop: 6,
                  }}
                >
                  <strong style={{ color: '#818cf8' }}>{r.productCode}</strong>
                  {' '}· {r.candleCount}本 · RSI {r.evaluation.rsi ?? '—'} · Vol {r.evaluation.volumeRatio ?? '—'}x
                  {r.evaluation.triggered ? (r.notified ? ' · 🔔 通知済' : ' · シグナル（クールダウン中）') : ' · ✓ なし'}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ paddingTop: '1.5rem', borderTop: '1px solid #2a2a2a' }}>
          <a href="/" style={{ color: '#c49c48', fontSize: '0.85rem', textDecoration: 'none' }}>
            ← ダッシュボードに戻る
          </a>
        </div>
      </div>
    </div>
  )
}
