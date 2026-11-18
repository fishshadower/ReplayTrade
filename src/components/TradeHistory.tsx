import { History } from 'lucide-react';
import type { ClosedTrade } from '../types/trading';
import { formatCurrency, formatDateTime, formatPrice } from '../utils/tradingCalculations';

interface TradeHistoryProps {
  history: ClosedTrade[];
  decimals: number;
  maxRows?: number;
  /** 提供时显示可编辑备注输入框 */
  onNoteEdit?: (tradeId: string, note: string) => void;
  /** 提供时开/平仓时间可点击跳转 K 线 */
  onJumpTo?: (time: number) => void;
}

const REASON_LABEL: Record<ClosedTrade['exitReason'], string> = {
  manual: '手动',
  'stop-loss': '止损',
  'take-profit': '止盈',
  'replay-ended': '回放结束',
};

export function TradeHistory({ history, decimals, maxRows = 50, onNoteEdit, onJumpTo }: TradeHistoryProps) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
        <History size={22} className="text-bg-border" />
        <p className="text-[14px] text-text-muted">暂无历史成交</p>
      </div>
    );
  }

  const rows = history.slice(-maxRows).reverse();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse font-mono text-[13px]">
        <thead>
          <tr className="border-b border-bg-border text-left text-[12px] uppercase tracking-wider text-text-muted">
            <Th>#</Th>
            <Th>代码</Th>
            <Th>方向</Th>
            <Th className="text-right">开仓</Th>
            <Th className="text-right">平仓</Th>
            <Th className="text-right">数量</Th>
            <Th className="text-right">盈亏</Th>
            <Th className="text-right">收益率</Th>
            <Th className="text-right">R</Th>
            <Th>原因</Th>
            <Th>开仓时间</Th>
            <Th>平仓时间</Th>
            <Th className="text-right">余额</Th>
            <Th>备注</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t, i) => {
            const win = t.pnl >= 0;
            return (
              <tr key={t.id} className="border-b border-bg-border/50 transition-colors hover:bg-bg-hover/40">
                <Td className="text-text-muted">{history.length - i}</Td>
                <Td className="text-text-primary">{t.symbol}</Td>
                <Td>
                  <span
                    className={`rounded-sm px-1 py-px text-[12px] font-bold ${
                      t.direction === 'long' ? 'bg-up-dim text-up' : 'bg-down-dim text-down'
                    }`}
                  >
                    {t.direction === 'long' ? 'L' : 'S'}
                  </span>
                </Td>
                <Td className="text-right text-text-primary">{formatPrice(t.entryPrice, decimals)}</Td>
                <Td className="text-right text-text-primary">{formatPrice(t.exitPrice, decimals)}</Td>
                <Td className="text-right text-text-secondary">{t.quantity}</Td>
                <Td className={`text-right font-bold ${win ? 'text-up' : 'text-down'}`}>
                  {formatCurrency(t.pnl)}
                </Td>
                <Td className={`text-right ${win ? 'text-up' : 'text-down'}`}>
                  {t.returnPct >= 0 ? '+' : ''}
                  {t.returnPct.toFixed(2)}%
                </Td>
                <Td className={`text-right ${win ? 'text-up' : 'text-down'}`}>
                  {t.rMultiple !== null ? `${t.rMultiple >= 0 ? '+' : ''}${t.rMultiple.toFixed(2)}R` : '—'}
                </Td>
                <Td className="text-text-secondary">
                  <span className="rounded-sm border border-bg-border px-1 py-px text-[12px]">
                    {REASON_LABEL[t.exitReason]}
                  </span>
                </Td>
                <Td className="text-text-muted">
                  {onJumpTo ? (
                    <button
                      type="button"
                      title="点击跳转 K 线"
                      onClick={() => onJumpTo(t.openedAt)}
                      className="underline-offset-2 hover:text-accent hover:underline"
                    >
                      {formatDateTime(t.openedAt)}
                    </button>
                  ) : (
                    formatDateTime(t.openedAt)
                  )}
                </Td>
                <Td className="text-text-muted">
                  {onJumpTo ? (
                    <button
                      type="button"
                      title="点击跳转 K 线"
                      onClick={() => onJumpTo(t.closedAt)}
                      className="underline-offset-2 hover:text-accent hover:underline"
                    >
                      {formatDateTime(t.closedAt)}
                    </button>
                  ) : (
                    formatDateTime(t.closedAt)
                  )}
                </Td>
                <Td className="text-right text-text-secondary">
                  {t.balanceAfter !== undefined ? formatCurrency(t.balanceAfter) : '—'}
                </Td>
                <Td>
                  {onNoteEdit ? (
                    <input
                      type="text"
                      value={t.note ?? ''}
                      onChange={(e) => onNoteEdit(t.id, e.target.value)}
                      placeholder="备注…"
                      className="h-7 w-[140px] rounded-sm border border-bg-border bg-bg-elevated px-1.5 text-[12px] text-text-primary outline-none focus:border-accent"
                    />
                  ) : (
                    <span className="text-[12px] italic text-accent">{t.note ?? ''}</span>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-2.5 py-2 font-semibold ${className}`}>{children}</th>;
}

function Td({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <td className={`px-2.5 py-2 ${className}`}>{children}</td>;
}
