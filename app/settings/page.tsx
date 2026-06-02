'use client';

import { useState, useEffect } from 'react';

const SIGNAL_EXAMPLES = [
  '出来高が過去20日平均の3倍を超えており、かつ終値が前日比+2%以上の場合にシグナルを出す。',
  '直近5日間の終値が連続して上昇しており、かつ直近の出来高が増加傾向にある場合にシグナルを出す。',
  '終値の25日移動平均を5日移動平均が下から上に突き抜けた（ゴールデンクロス）場合にシグナルを出す。',
];

export default function SettingsPage() {
  const [prompt, setPrompt] = useState('');
  const [promptSaved, setPromptSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const [tickerInput, setTickerInput] = useState('');
  const [tickers, setTickers] = useState<string[]>([]);
  const [tickerSaving, setTickerSaving] = useState(false);
  const [tickerSaved, setTickerSaved] = useState(false);

  const [lastRun, setLastRun] = useState<{
    timestamp: string;
    signalCount: number;
    signals: string[];
    tickerCount?: number;
  } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/settings/signal').then(r => r.json()),
      fetch('/api/settings/watchlist').then(r => r.json()),
    ]).then(([signalData, watchlistData]) => {
      if (signalData.prompt) setPrompt(signalData.prompt);
      if (signalData.lastRun) setLastRun(signalData.lastRun);
      if (watchlistData.tickers) setTickers(watchlistData.tickers);
    });
  }, []);

  const handleSavePrompt = async () => {
    setSaving(true);
    await fetch('/api/settings/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    setSaving(false);
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 3000);
  };

  const handleAddTicker = () => {
    const code = tickerInput.trim().toUpperCase();
    if (!code) return;
    const normalized = code.endsWith('0') ? code : `${code}0`;
    if (tickers.includes(normalized)) {
      setTickerInput('');
      return;
    }
    setTickers(prev => [...prev, normalized]);
    setTickerInput('');
  };

  const handleRemoveTicker = (ticker: string) => {
    setTickers(prev => prev.filter(t => t !== ticker));
  };

  const handleSaveTickers = async () => {
    setTickerSaving(true);
    await fetch('/api/settings/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tickers }),
    });
    setTickerSaving(false);
    setTickerSaved(true);
    setTimeout(() => setTickerSaved(false), 3000);
  };

  const cardStyle: React.CSSProperties = {
    background: 'rgba(196,156,72,0.04)',
    border: '1px solid rgba(196,156,72,0.2)',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 12,
    color: 'rgba(196,156,72,0.8)',
    letterSpacing: '0.1em',
    marginBottom: 12,
  };

  const btnPrimary = (disabled: boolean): React.CSSProperties => ({
    background: disabled ? 'rgba(196,156,72,0.2)' : 'rgba(196,156,72,0.85)',
    color: disabled ? 'rgba(196,156,72,0.4)' : '#0a0a0f',
    border: 'none',
    borderRadius: 8,
    padding: '10px 24px',
    fontSize: 13,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    letterSpacing: '0.05em',
    transition: 'all 0.2s',
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      color: '#e8e0d0',
      fontFamily: 'var(--font-body)',
      padding: '40px 24px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* ヘッダー */}
        <div style={{ marginBottom: 40 }}>
          <p style={{ color: 'rgba(196,156,72,0.7)', fontSize: 12, letterSpacing: '0.15em', marginBottom: 8 }}>
            APEX DASHBOARD
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: '#e8e0d0', margin: 0 }}>
            シグナル設定
          </h1>
          <p style={{ color: 'rgba(232,224,208,0.5)', fontSize: 14, marginTop: 8 }}>
            ウォッチリストと検出ルールを管理します。
          </p>
        </div>

        {/* ウォッチリスト */}
        <div style={cardStyle}>
          <label style={labelStyle}>ウォッチリスト（銘柄コード）</label>
          <p style={{ fontSize: 12, color: 'rgba(232,224,208,0.4)', margin: '0 0 16px' }}>
            末尾の「0」は自動で付加されます。例: 4443 → 44430
          </p>

          {/* 追加入力 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              value={tickerInput}
              onChange={e => setTickerInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTicker()}
              placeholder="銘柄コードを入力 (例: 4443)"
              style={{
                flex: 1,
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(196,156,72,0.15)',
                borderRadius: 8,
                padding: '10px 14px',
                color: '#e8e0d0',
                fontSize: 14,
                outline: 'none',
                fontFamily: 'var(--font-body)',
              }}
            />
            <button
              onClick={handleAddTicker}
              disabled={!tickerInput.trim()}
              style={btnPrimary(!tickerInput.trim())}
            >
              追加
            </button>
          </div>

          {/* 銘柄タグ一覧 */}
          {tickers.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {tickers.map(ticker => (
                <div key={ticker} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(196,156,72,0.1)',
                  border: '1px solid rgba(196,156,72,0.25)',
                  borderRadius: 6,
                  padding: '5px 10px',
                  fontSize: 13,
                  color: 'rgba(196,156,72,0.9)',
                }}>
                  {ticker}
                  <button
                    onClick={() => handleRemoveTicker(ticker)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(196,156,72,0.5)',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: 14,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'rgba(232,224,208,0.3)', marginBottom: 16 }}>
              銘柄が登録されていません
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={handleSaveTickers}
              disabled={tickerSaving || tickers.length === 0}
              style={btnPrimary(tickerSaving || tickers.length === 0)}
            >
              {tickerSaving ? '保存中...' : tickerSaved ? '✓ 保存しました' : `保存（${tickers.length}銘柄）`}
            </button>
          </div>
        </div>

        {/* シグナルプロンプト */}
        <div style={cardStyle}>
          <label style={labelStyle}>シグナル検出ルール</label>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="例: 出来高が過去20日平均の3倍を超えており、かつ終値が前日比+2%以上の場合にシグナルを出す。"
            rows={6}
            style={{
              width: '100%',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(196,156,72,0.15)',
              borderRadius: 8,
              padding: '12px 14px',
              color: '#e8e0d0',
              fontSize: 14,
              lineHeight: 1.7,
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'var(--font-body)',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button
              onClick={handleSavePrompt}
              disabled={saving || !prompt.trim()}
              style={btnPrimary(saving || !prompt.trim())}
            >
              {saving ? '保存中...' : promptSaved ? '✓ 保存しました' : '保存'}
            </button>
          </div>
        </div>

        {/* サンプルプロンプト */}
        <div style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
        }}>
          <p style={{ fontSize: 12, color: 'rgba(232,224,208,0.5)', letterSpacing: '0.1em', margin: '0 0 16px' }}>
            サンプルルール（クリックで入力）
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SIGNAL_EXAMPLES.map((ex, i) => (
              <button
                key={i}
                onClick={() => setPrompt(ex)}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  color: 'rgba(232,224,208,0.65)',
                  fontSize: 13,
                  textAlign: 'left',
                  cursor: 'pointer',
                  lineHeight: 1.5,
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* 最終実行結果 */}
        {lastRun && (
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}>
            <p style={{ fontSize: 12, color: 'rgba(232,224,208,0.5)', letterSpacing: '0.1em', margin: '0 0 12px' }}>
              最終実行結果
            </p>
            <p style={{ fontSize: 13, color: 'rgba(232,224,208,0.6)', margin: '0 0 8px' }}>
              {new Date(lastRun.timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
              　{lastRun.tickerCount && `${lastRun.tickerCount}銘柄チェック`}
              　{lastRun.signalCount > 0 ? `🔔 ${lastRun.signalCount}件検出` : '✓ シグナルなし'}
            </p>
            {lastRun.signals.map((s, i) => (
              <div key={i} style={{
                background: 'rgba(196,156,72,0.06)',
                border: '1px solid rgba(196,156,72,0.15)',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 13,
                color: 'rgba(232,224,208,0.8)',
                marginTop: 8,
                whiteSpace: 'pre-wrap',
              }}>
                {s}
              </div>
            ))}
          </div>
        )}

        <div style={{ paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <a href="/" style={{ color: 'rgba(196,156,72,0.7)', fontSize: 13, textDecoration: 'none' }}>
            ← ダッシュボードに戻る
          </a>
        </div>

      </div>
    </div>
  );
}
