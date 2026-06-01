'use client';

import { useState, useEffect } from 'react';

const EXAMPLES = [
  '出来高が過去20日平均の3倍を超えており、かつ終値が前日比+2%以上の場合にシグナルを出す。',
  '直近5日間の終値が連続して上昇しており、かつ直近の出来高が増加傾向にある場合にシグナルを出す。',
  '終値の25日移動平均を5日移動平均が下から上に突き抜けた（ゴールデンクロス）場合にシグナルを出す。',
];

export default function SettingsPage() {
  const [prompt, setPrompt] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastRun, setLastRun] = useState<{
    timestamp: string;
    signalCount: number;
    signals: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 保存済みプロンプトと最終実行結果を取得
    fetch('/api/settings/signal')
      .then(r => r.json())
      .then(d => {
        if (d.prompt) setPrompt(d.prompt);
        if (d.lastRun) setLastRun(d.lastRun);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    await fetch('/api/settings/signal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTest = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/cron/signal-check', {
        headers: { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET ?? 'test'}` },
      });
      const data = await res.json();
      alert(`テスト完了: シグナル ${data.signalCount ?? 0} 件`);
    } catch {
      alert('テスト実行に失敗しました');
    } finally {
      setSaving(false);
    }
  };

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
          <h1 style={{
            fontSize: 28,
            fontWeight: 600,
            color: '#e8e0d0',
            margin: 0,
            letterSpacing: '0.02em',
          }}>
            シグナル設定
          </h1>
          <p style={{ color: 'rgba(232,224,208,0.5)', fontSize: 14, marginTop: 8 }}>
            自然言語でシグナル検出ルールを記述してください。Claudeが株価データを分析して判断します。
          </p>
        </div>

        {/* プロンプト入力 */}
        <div style={{
          background: 'rgba(196,156,72,0.04)',
          border: '1px solid rgba(196,156,72,0.2)',
          borderRadius: 12,
          padding: 24,
          marginBottom: 24,
        }}>
          <label style={{
            display: 'block',
            fontSize: 12,
            color: 'rgba(196,156,72,0.8)',
            letterSpacing: '0.1em',
            marginBottom: 12,
          }}>
            シグナル検出ルール
          </label>
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
              onClick={handleSave}
              disabled={saving || !prompt.trim()}
              style={{
                background: saving || !prompt.trim()
                  ? 'rgba(196,156,72,0.2)'
                  : 'rgba(196,156,72,0.85)',
                color: saving || !prompt.trim() ? 'rgba(196,156,72,0.4)' : '#0a0a0f',
                border: 'none',
                borderRadius: 8,
                padding: '10px 24px',
                fontSize: 13,
                fontWeight: 600,
                cursor: saving || !prompt.trim() ? 'not-allowed' : 'pointer',
                letterSpacing: '0.05em',
                transition: 'all 0.2s',
              }}
            >
              {saving ? '保存中...' : saved ? '✓ 保存しました' : '保存'}
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
          <p style={{
            fontSize: 12,
            color: 'rgba(232,224,208,0.5)',
            letterSpacing: '0.1em',
            marginBottom: 16,
            margin: '0 0 16px',
          }}>
            サンプルルール（クリックで入力）
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {EXAMPLES.map((ex, i) => (
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
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(196,156,72,0.3)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgba(232,224,208,0.9)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'rgba(232,224,208,0.65)';
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* 最終実行結果 */}
        {!loading && lastRun && (
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12,
            padding: 24,
          }}>
            <p style={{
              fontSize: 12,
              color: 'rgba(232,224,208,0.5)',
              letterSpacing: '0.1em',
              margin: '0 0 12px',
            }}>
              最終実行結果
            </p>
            <p style={{ fontSize: 13, color: 'rgba(232,224,208,0.6)', margin: '0 0 8px' }}>
              {new Date(lastRun.timestamp).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
              　{lastRun.signalCount > 0
                ? `🔔 ${lastRun.signalCount}件のシグナルを検出`
                : '✓ シグナルなし'}
            </p>
            {lastRun.signals.length > 0 && (
              <div style={{ marginTop: 12 }}>
                {lastRun.signals.map((s, i) => (
                  <div key={i} style={{
                    background: 'rgba(196,156,72,0.06)',
                    border: '1px solid rgba(196,156,72,0.15)',
                    borderRadius: 6,
                    padding: '8px 12px',
                    fontSize: 13,
                    color: 'rgba(232,224,208,0.8)',
                    marginBottom: 8,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {s}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ナビゲーション */}
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <a href="/" style={{
            color: 'rgba(196,156,72,0.7)',
            fontSize: 13,
            textDecoration: 'none',
            letterSpacing: '0.05em',
          }}>
            ← ダッシュボードに戻る
          </a>
        </div>

      </div>
    </div>
  );
}
