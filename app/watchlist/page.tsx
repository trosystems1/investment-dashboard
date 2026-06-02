'use client';

import { useState, useEffect } from 'react';

type HistoryEntry = {
  date: string;
  signals: string[];
  checkedAt: string;
};

type WatchlistItem = {
  ticker: string;
  companyName: string;
  history: HistoryEntry[];
};

type ListedInfo = {
  companyName: string;
  segment: string;
};

const SEGMENT_COLORS: Record<string, { color: string; border: string; background: string }> = {
  プライム: { color: 'rgba(196,156,72,0.85)', border: 'rgba(196,156,72,0.35)', background: 'rgba(196,156,72,0.08)' },
  グロース: { color: 'rgba(180,200,220,0.75)', border: 'rgba(180,200,220,0.25)', background: 'rgba(180,200,220,0.06)' },
  スタンダード: { color: 'rgba(232,224,208,0.55)', border: 'rgba(232,224,208,0.2)', background: 'rgba(232,224,208,0.04)' },
};

const segmentKey = (segment: string) => {
  if (segment.startsWith('プライム')) return 'プライム';
  if (segment.startsWith('グロース')) return 'グロース';
  if (segment.startsWith('スタンダード')) return 'スタンダード';
  return '';
};

export default function WatchlistPage() {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [listedInfo, setListedInfo] = useState<Record<string, ListedInfo>>({});

  useEffect(() => {
    fetch('/api/watchlist')
      .then(r => r.json())
      .then(d => {
        const list: WatchlistItem[] = d.watchlist ?? [];
        setWatchlist(list);
        setLoading(false);

        list.forEach(item => {
          const code = item.ticker.replace(/0$/, '');
          fetch(`/api/listed-info?code=${encodeURIComponent(code)}`)
            .then(r => (r.ok ? r.json() : null))
            .then(json => {
              const first = json?.data?.data?.[0];
              if (!first) return;
              setListedInfo(prev => ({
                ...prev,
                [item.ticker]: {
                  companyName: first.CoName || '',
                  segment: first.MktNm || '',
                },
              }));
            })
            .catch(() => {});
        });
      });
  }, []);

  const getLatestSignal = (history: HistoryEntry[]) => {
    for (const entry of history) {
      if (entry.signals.length > 0) return { date: entry.date, signals: entry.signals };
    }
    return null;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      color: '#e8e0d0',
      fontFamily: 'var(--font-body)',
      padding: '40px 24px',
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        {/* ヘッダー */}
        <div style={{ marginBottom: 40 }}>
          <p style={{ color: 'rgba(196,156,72,0.7)', fontSize: 12, letterSpacing: '0.15em', marginBottom: 8 }}>
            APEX DASHBOARD
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 600, color: '#e8e0d0', margin: 0 }}>
            ウォッチリスト
          </h1>
          <p style={{ color: 'rgba(232,224,208,0.5)', fontSize: 14, marginTop: 8 }}>
            銘柄ごとのシグナル検出履歴
          </p>
        </div>

        {loading ? (
          <div style={{ color: 'rgba(232,224,208,0.3)', fontSize: 14, textAlign: 'center', paddingTop: 60 }}>
            読み込み中...
          </div>
        ) : watchlist.length === 0 ? (
          <div style={{ color: 'rgba(232,224,208,0.3)', fontSize: 14, textAlign: 'center', paddingTop: 60 }}>
            ウォッチリストに銘柄が登録されていません。
            <br />
            <a href="/settings" style={{ color: 'rgba(196,156,72,0.7)', marginTop: 8, display: 'inline-block' }}>
              設定画面で追加する →
            </a>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {watchlist.map((item) => {
              const latest = getLatestSignal(item.history);
              const isExpanded = expanded === item.ticker;

              return (
                <div key={item.ticker} style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${latest ? 'rgba(196,156,72,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}>
                  {/* 銘柄ヘッダー */}
                  <div
                    onClick={() => setExpanded(isExpanded ? null : item.ticker)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px 20px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div>
                        {(() => {
                          const info = listedInfo[item.ticker];
                          const name = info?.companyName;
                          const segment = info?.segment ?? '';
                          const seg = segment ? SEGMENT_COLORS[segmentKey(segment)] : null;
                          return (
                            <>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                {name ? (
                                  <>
                                    <span style={{ fontSize: 15, fontWeight: 600, color: '#e8e0d0' }}>
                                      {name}
                                    </span>
                                    <span style={{
                                      fontSize: 12, color: 'rgba(196,156,72,0.6)',
                                      letterSpacing: '0.05em',
                                    }}>
                                      {item.ticker}
                                    </span>
                                  </>
                                ) : (
                                  <span style={{ fontSize: 15, fontWeight: 600, color: '#e8e0d0', letterSpacing: '0.05em' }}>
                                    {item.ticker}
                                  </span>
                                )}
                              </div>
                              {segment && seg && (
                                <span style={{
                                  display: 'inline-block',
                                  marginTop: 4,
                                  padding: '2px 8px',
                                  fontSize: 10,
                                  letterSpacing: '0.1em',
                                  color: seg.color,
                                  background: seg.background,
                                  border: `0.5px solid ${seg.border}`,
                                  borderRadius: 10,
                                }}>
                                  {segment}
                                </span>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {latest ? (
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 11, color: 'rgba(232,224,208,0.4)', marginBottom: 2 }}>
                            {latest.date}
                          </div>
                          <div style={{ fontSize: 12, color: 'rgba(196,156,72,0.9)' }}>
                            🔔 {latest.signals.length}件のシグナル
                          </div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'rgba(232,224,208,0.3)' }}>
                          シグナル履歴なし
                        </span>
                      )}
                      <span style={{
                        color: 'rgba(232,224,208,0.3)',
                        fontSize: 12,
                        transform: isExpanded ? 'rotate(180deg)' : 'none',
                        transition: 'transform 0.2s',
                        display: 'inline-block',
                      }}>▼</span>
                    </div>
                  </div>

                  {/* 履歴展開 */}
                  {isExpanded && (
                    <div style={{
                      borderTop: '1px solid rgba(255,255,255,0.06)',
                      padding: '16px 20px',
                    }}>
                      {item.history.length === 0 ? (
                        <p style={{ fontSize: 13, color: 'rgba(232,224,208,0.3)', margin: 0 }}>
                          まだ履歴がありません。次回のCron実行後に表示されます。
                        </p>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {item.history.map((entry, i) => (
                            <div key={i} style={{
                              display: 'flex',
                              gap: 16,
                              padding: '10px 14px',
                              background: entry.signals.length > 0
                                ? 'rgba(196,156,72,0.05)'
                                : 'rgba(255,255,255,0.01)',
                              border: `1px solid ${entry.signals.length > 0
                                ? 'rgba(196,156,72,0.15)'
                                : 'rgba(255,255,255,0.04)'}`,
                              borderRadius: 8,
                            }}>
                              <div style={{
                                fontSize: 12,
                                color: 'rgba(232,224,208,0.4)',
                                flexShrink: 0,
                                paddingTop: 1,
                                minWidth: 80,
                              }}>
                                {entry.date}
                              </div>
                              <div style={{ flex: 1 }}>
                                {entry.signals.length > 0 ? (
                                  entry.signals.map((sig, j) => (
                                    <div key={j} style={{
                                      fontSize: 13,
                                      color: 'rgba(196,156,72,0.9)',
                                      lineHeight: 1.6,
                                    }}>
                                      🔔 {sig}
                                    </div>
                                  ))
                                ) : (
                                  <span style={{ fontSize: 13, color: 'rgba(232,224,208,0.3)' }}>
                                    ✓ シグナルなし
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ナビゲーション */}
        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 24 }}>
          <a href="/" style={{ color: 'rgba(196,156,72,0.7)', fontSize: 13, textDecoration: 'none' }}>
            ← ダッシュボードに戻る
          </a>
          <a href="/settings" style={{ color: 'rgba(196,156,72,0.7)', fontSize: 13, textDecoration: 'none' }}>
            シグナル設定 →
          </a>
        </div>

      </div>
    </div>
  );
}
