import { useState } from 'react';
import { ChevronDown, ChevronRight, Download, FolderOpen, Pencil, Trash2 } from 'lucide-react';
import type { ReplaySessionRecord } from '../utils/sessionStore';
import { computeSessionStats, exportSessionCsv, sessionTitle } from '../utils/sessionStore';
import { formatCurrency, formatPct } from '../utils/tradingCalculations';
import { TradeHistory } from './TradeHistory';
import { EquityChart } from './StatisticsPanel';

interface ReplaySessionsPanelProps {
  sessions: ReplaySessionRecord[];
  decimals: number;
  onDelete: (id: string) => void;
  onClear: () => void;
  onUpdateNote: (id: string, note: string) => void;
}

export function ReplaySessionsPanel({ sessions, decimals, onDelete, onClear, onUpdateNote }: ReplaySessionsPanelProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [editNoteId, setEditNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
        <FolderOpen size={22} className="text-bg-border" />
        <p className="text-[14px] text-text-muted">暂无回放记录</p>
        <p className="text-[12px] text-text-muted">每次回放有成交，结束时会自动归档到这里，刷新不丢。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-text-muted">
          共 {sessions.length} 批回放
        </span>
        {confirmClear ? (
          <span className="flex items-center gap-1.5">
            <span className="text-[12px] text-down">确认清空全部记录？</span>
            <button
              onClick={() => {
                onClear();
                setConfirmClear(false);
                setOpenId(null);
              }}
              className="rounded-sm border border-down/60 px-2 py-1 text-[12px] font-semibold text-down hover:bg-down-dim"
            >
              清空
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="rounded-sm border border-bg-border px-2 py-1 text-[12px] font-semibold text-text-secondary hover:bg-bg-hover"
            >
              取消
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            className="flex items-center gap-1 rounded-sm border border-bg-border px-2 py-1 text-[12px] font-semibold text-text-secondary transition-colors hover:border-down/60 hover:text-down"
          >
            <Trash2 size={12} /> 清空全部
          </button>
        )}
      </div>

      <div className="divide-y divide-bg-border rounded-sm border border-bg-border">
        {sessions.map((rec) => {
          const open = openId === rec.id;
          return (
            <div key={rec.id}>
              <div className="flex items-center gap-2 px-2.5 py-2">
                <button
                  onClick={() => setOpenId(open ? null : rec.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  {open ? <ChevronDown size={14} className="shrink-0 text-text-muted" /> : <ChevronRight size={14} className="shrink-0 text-text-muted" />}
                  <span className="truncate font-mono text-[13px] font-semibold text-text-primary">{sessionTitle(rec)}</span>
                </button>
                {rec.note && editNoteId !== rec.id && (
                  <span className="max-w-[180px] shrink-0 truncate text-[12px] italic text-accent" title={rec.note}>
                    {rec.note}
                  </span>
                )}
                {editNoteId === rec.id ? (
                  <input
                    autoFocus
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onBlur={() => {
                      onUpdateNote(rec.id, noteDraft);
                      setEditNoteId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onUpdateNote(rec.id, noteDraft);
                        setEditNoteId(null);
                      } else if (e.key === 'Escape') {
                        setEditNoteId(null);
                      }
                    }}
                    placeholder="备注…"
                    className="h-7 w-[160px] shrink-0 rounded-sm border border-accent/60 bg-bg-elevated px-2 text-[12px] text-text-primary outline-none"
                  />
                ) : (
                  <button
                    title="编辑备注"
                    onClick={() => {
                      setNoteDraft(rec.note ?? '');
                      setEditNoteId(rec.id);
                    }}
                    className="shrink-0 rounded-sm border border-bg-border p-1 text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
                  >
                    <Pencil size={12} />
                  </button>
                )}
                <span className="shrink-0 font-mono text-[12px] text-text-muted">
                  净盈亏{' '}
                  <span className={rec.totalPnl >= 0 ? 'font-bold text-up' : 'font-bold text-down'}>
                    {formatCurrency(rec.totalPnl)}
                  </span>
                </span>
                <button
                  title="导出本批 CSV"
                  onClick={() => exportSessionCsv(rec)}
                  className="shrink-0 rounded-sm border border-bg-border p-1 text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
                >
                  <Download size={12} />
                </button>
                <button
                  title="删除本批"
                  onClick={() => {
                    onDelete(rec.id);
                    if (openId === rec.id) setOpenId(null);
                  }}
                  className="shrink-0 rounded-sm border border-bg-border p-1 text-text-secondary transition-colors hover:border-down/60 hover:text-down"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              {open && <SessionDetail rec={rec} decimals={decimals} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SessionDetail({ rec, decimals }: { rec: ReplaySessionRecord; decimals: number }) {
  const { perf, equitySeries, maxDrawdown } = computeSessionStats(rec);
  const netPnl = rec.totalPnl;
  const returnPct = rec.startingBalance > 0 ? (netPnl / rec.startingBalance) * 100 : 0;
  const stat = (label: string, value: string, tone?: 'up' | 'down') => (
    <div className="flex flex-col gap-0.5 rounded-sm border border-bg-border bg-bg-panel px-2.5 py-2">
      <span className="text-[12px] uppercase tracking-wider text-text-muted">{label}</span>
      <span
        className={`font-mono text-[14px] font-bold ${
          tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-text-primary'
        }`}
      >
        {value}
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 border-t border-bg-border bg-bg-base/40 px-2.5 py-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stat('总交易数', String(perf.totalTrades))}
        {stat('胜率', formatPct(perf.winRate))}
        {stat('净盈亏', formatCurrency(netPnl), netPnl >= 0 ? 'up' : 'down')}
        {stat('收益率', formatPct(returnPct), returnPct >= 0 ? 'up' : 'down')}
        {stat('盈利笔数', String(perf.winningTrades), 'up')}
        {stat('亏损笔数', String(perf.losingTrades), 'down')}
        {stat('盈亏比 PF', perf.profitFactor === Infinity ? '∞' : perf.profitFactor.toFixed(2))}
        {stat('最大回撤', formatPct(-maxDrawdown), 'down')}
      </div>
      <div className="rounded-sm border border-bg-border bg-bg-panel p-2.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-text-muted">权益曲线</span>
          <span className="font-mono text-[13px] text-text-secondary">{formatCurrency(rec.finalBalance)}</span>
        </div>
        <EquityChart series={equitySeries} />
      </div>
      <TradeHistory history={rec.trades} decimals={decimals} />
    </div>
  );
}
