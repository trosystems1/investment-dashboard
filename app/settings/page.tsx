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

interface SearchResult {
  code: string
  name: string
  market: string
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
      .then((d) => setRules(d.rules ?? []))
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

  const removeRule = (i: number) => setRules((prev) => prev.filter((_, idx) => idx !== i))

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

        <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: 8, padding: '1.5rem' }}>
          <h2 style={{ color: '#c49c48', fontSize: '0.8rem', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
            シグナル検出ルール
          </h2>
          <p style={{ color: '#666', fontSize: '0.8rem', marginBottom: '1rem' }}>
            複数のルールを登録できます。全ルールを同時にチェックします。
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
        </div>
      </div>
    </div>
  )
}
