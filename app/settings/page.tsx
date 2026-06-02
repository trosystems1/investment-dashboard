'use client';

import { useState, useEffect } from 'react';

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
];

export default function SettingsPage() {
  const [rules, setRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState('');
  const [rulesSaved, setRulesSaved] = useState(false);
  const [rulesSaving, setRulesSaving] = useState(false);

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
      if (signalData.rules && Array.isArray(signalData.rules)) {
        setRules(signalData.rules);
      } else if (signalData.prompt) {
        // 旧形式からの移行
        setRules([signalData.prompt]);
      }
      if (signalData.lastRun) setLastRun(signalData.lastRun);
      if (watchlistData.tickers) setTickers(watchlistData.tickers);
    });
  }, []);

  const handleAddRule = (text?: string) => {
    const rule = (text ?? newRule).trim();
    if (!rule || rules.includes(rule)) return;
    setRules(prev => [...prev, rule]);
    setNewRule('');
  };

  const handleRemoveRule = (index: number) => {
    setRules(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveRules = async () => {
    setRulesSaving(true);
    await fetch('/api/settings/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules }),
    });
    setRulesSaving(false);
    setRulesSaved(true);
    setTimeout(() => setRulesSaved(false), 3000);
  };

  const handleAddTicker = () => {
    const code = tickerInput.trim().toUpperCase();
    if (!code) return;
    const normalized = code.endsWith('0') ? code : `${code}0`;
    if (tickers.includes(normalized)) { setTickerInput(''); return; }
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
    marginBottom: 24,
  };
  const cardClass = 'p-5 sm:p-6';

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
    transition: 'all 0.2s',
  });

  return (
    <div
      className="px-4 py-6 sm:px-6 sm:py-10"
      style={{
        minHeight: '100vh',
        background: '#0a0a0f',
        color: '#e8e0d0',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* ヘッダー */}
        <div className="mb-7 md:mb-10">
          <p style={{ color: 'rgba(196,156,72,0.7)', fontSize: 12, letterSpacing: '0.15em', marginBottom: 8 }}>
            APEX DASHBOARD
          </p>
          <h1 className="text-2xl md:text-[28px]" style={{ fontWeight: 600, color: '#e8e0d0', margin: 0 }}>
            シグナル設定
          </h1>
          <p style={{ color: 'rgba(232,224,208,0.5)', fontSize: 14, marginTop: 8 }}>
            ウォッチリストと検出ルールを管理します。
          </p>
        </div>

        {/* ウォッチリスト */}
        <div className={cardClass} style={cardStyle}>
          <label style={labelStyle}>ウォッチリスト（銘柄コード）</label>
          <p style={{ fontSize: 12, color: 'rgba(232,224,208,0.4)', margin: '0 0 16px' }}>
            末尾の「0」は自動付加されます。例: 4443 → 44430
          </p>
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
            <button onClick={handleAddTicker} disabled={!tickerInput.trim()} style={btnPrimary(!tickerInput.trim())}>
              追加
            </button>
          </div>
          {tickers.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {tickers.map(ticker => (
                <div key={ticker} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: 'rgba(196,156,72,0.1)', border: '1px solid rgba(196,156,72,0.25)',
                  borderRadius: 6, padding: '5px 10px', fontSize: 13, color: 'rgba(196,156,72,0.9)',
                }}>
                  {ticker}
                  <button onClick={() => handleRemoveTicker(ticker)} style={{
                    background: 'none', border: 'none', color: 'rgba(196,156,72,0.5)',
                    cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1,
                  }}>×</button>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: 'rgba(232,224,208,0.3)', marginBottom: 16 }}>銘柄が登録されていません</p>
          )}
          <button onClick={handleSaveTickers} disabled={tickerSaving || tickers.length === 0} style={btnPrimary(tickerSaving || tickers.length === 0)}>
            {tickerSaving ? '保存中...' : tickerSaved ? '✓ 保存しました' : `保存（${tickers.length}銘柄）`}
          </button>
        </div>

        {/* シグナルルール */}
        <div className={cardClass} style={cardStyle}>
          <label style={labelStyle}>シグナル検出ルール</label>
          <p style={{ fontSize: 12, color: 'rgba(232,224,208,0.4)', margin: '0 0 16px' }}>
            複数のルールを登録できます。全ルールを同時にチェックします。
          </p>

          {/* 登録済みルール */}
          {rules.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {rules.map((rule, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  background: 'rgba(196,156,72,0.06)', border: '1px solid rgba(196,156,72,0.15)',
                  borderRadius: 8, padding: '10px 12px', marginBottom: 8,
                }}>
                  <span style={{
                    background: 'rgba(196,156,72,0.2)', color: 'rgba(196,156,72,0.8)',
                    borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600,
                    flexShrink: 0, marginTop: 1,
                  }}>{i + 1}</span>
                  <span style={{ fontSize: 13, color: 'rgba(232,224,208,0.8)', flex: 1, lineHeight: 1.6 }}>{rule}</span>
                  <button onClick={() => handleRemoveRule(i)} style={{
                    background: 'none', border: 'none', color: 'rgba(232,224,208,0.3)',
                    cursor: 'pointer', padding: 0, fontSize: 16, flexShrink: 0,
                  }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* 新規ルール入力 */}
          <textarea
            value={newRule}
            onChange={e => setNewRule(e.target.value)}
            placeholder="新しいルールを入力..."
            rows={3}
            style={{
              width: '100%', background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(196,156,72,0.15)', borderRadius: 8,
              padding: '12px 14px', color: '#e8e0d0', fontSize: 14,
              lineHeight: 1.7, resize: 'vertical', outline: 'none',
              fontFamily: 'var(--font-body)', boxSizing: 'border-box',
            }}
          />
          <div className="flex flex-wrap gap-3 mt-3">
            <button onClick={() => handleAddRule()} disabled={!newRule.trim()} style={btnPrimary(!newRule.trim())}>
              + ルールを追加
            </button>
            <button onClick={handleSaveRules} disabled={rulesSaving || rules.length === 0} style={btnPrimary(rulesSaving || rules.length === 0)}>
              {rulesSaving ? '保存中...' : rulesSaved ? '✓ 保存しました' : `保存（${rules.length}件）`}
            </button>
          </div>
        </div>

        {/* プリセット */}
        <div className="p-5 sm:p-6" style={{
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12, marginBottom: 24,
        }}>
          <p style={{ fontSize: 12, color: 'rgba(232,224,208,0.5)', letterSpacing: '0.1em', margin: '0 0 16px' }}>
            プリセット（クリックで追加）
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SIGNAL_PRESETS.map((preset, i) => {
              const already = rules.includes(preset.description);
              return (
                <button
                  key={i}
                  onClick={() => !already && handleAddRule(preset.description)}
                  title={preset.description}
                  style={{
                    background: already ? 'rgba(196,156,72,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${already ? 'rgba(196,156,72,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    borderRadius: 6, padding: '7px 14px',
                    color: already ? 'rgba(196,156,72,0.8)' : 'rgba(232,224,208,0.65)',
                    fontSize: 12, cursor: already ? 'default' : 'pointer',
                  }}
                >
                  {already ? '✓ ' : '+ '}{preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 最終実行結果 */}
        {lastRun && (
          <div className="p-5 sm:p-6" style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12, marginBottom: 24,
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
                background: 'rgba(196,156,72,0.06)', border: '1px solid rgba(196,156,72,0.15)',
                borderRadius: 6, padding: '8px 12px', fontSize: 13,
                color: 'rgba(232,224,208,0.8)', marginTop: 8, whiteSpace: 'pre-wrap',
              }}>{s}</div>
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
