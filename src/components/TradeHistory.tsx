import { History } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ClosedTrade } from '../types/trading';
import { formatCurrency, formatDateTime, formatPrice } from '../utils/tradingCalculations';
import { AUTO_TAG_BY_REASON, TAG_GROUPS, tagGroupOf } from '../utils/tradeTags';

interface TradeHistoryProps {
  history: ClosedTrade[];
  decimals: number;
  maxRows?: number;
  /** 提供时显示可编辑备注输入框 */
  onNoteEdit?: (tradeId: string, note: string) => void;
  /** 提供时开/平仓时间可点击跳转 K 线 */
  onJumpTo?: (time: number) => void;
  /** 提供时标签可编辑 */
  onTagsEdit?: (tradeId: string, tags: string[]) => void;
}

const REASON_LABEL: Record<ClosedTrade['exitReason'], string> = {
  manual: '手动',
  'stop-loss': '止损',
  'take-profit': '止盈',
  'replay-ended': '回放结束',
};

export function TradeHistory({ history, decimals, maxRows = 50, onNoteEdit, onJumpTo, onTagsEdit }: TradeHistoryProps) {
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
      <table className="w-full min-w-[1360px] border-collapse font-mono text-[13px]">
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
            <Th>余额</Th>
            <Th className="whitespace-nowrap">止损 / 止盈</Th>
            <Th>标签</Th>
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
                <Td className="whitespace-nowrap pr-6 text-text-secondary">
                  {t.balanceAfter !== undefined ? formatCurrency(t.balanceAfter) : '—'}
                </Td>
                <Td className="whitespace-nowrap text-text-secondary">
                  {t.exitStopLoss != null || t.exitTakeProfit != null
                    ? `${t.exitStopLoss != null ? formatPrice(t.exitStopLoss, decimals) : '—'} / ${
                        t.exitTakeProfit != null ? formatPrice(t.exitTakeProfit, decimals) : '—'
                      }`
                    : '—'}
                </Td>
                <Td>
                  {onTagsEdit ? (
                    <TagPicker tags={t.tags ?? []} onChange={(tags) => onTagsEdit(t.id, tags)} />
                  ) : (
                    <span className="flex max-w-[240px] flex-wrap gap-1">
                      <TagChip tag={AUTO_TAG_BY_REASON[t.exitReason] ?? t.exitReason} />
                      {(t.tags ?? []).map((tag) => (
                        <TagChip key={tag} tag={tag} />
                      ))}
                    </span>
                  )}
                </Td>
                <Td>
                  {onNoteEdit ? (
                    <textarea
                      rows={2}
                      value={t.note ?? ''}
                      onChange={(e) => onNoteEdit(t.id, e.target.value)}
                      placeholder="备注…（成功/失败原因等）"
                      className="w-[240px] resize-y rounded-sm border border-bg-border bg-bg-elevated px-1.5 py-1 text-[12px] leading-snug text-text-primary outline-none focus:border-accent"
                    />
                  ) : (
                    <span className="block max-w-[240px] whitespace-pre-wrap text-[12px] italic text-accent">
                      {t.note ?? ''}
                    </span>
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


function TagChip({ tag }: { tag: string }) {
  const g = tagGroupOf(tag);
  const cls = g?.cls ?? 'border-bg-border bg-bg-elevated text-text-secondary';
  return (
    <span className={`inline-block whitespace-nowrap rounded-sm border px-1 py-px text-[11px] font-semibold ${cls}`}>
      {tag}
    </span>
  );
}

function TagPicker({ tags, onChange }: { tags: string[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const toggle = (): void => {
    if (!open) {
      const r = btnRef.current?.getBoundingClientRect();
      if (r) {
        // fixed 向上弹：脱离底部面板的 overflow 裁剪；左侧越界钳回
        setPos({
          left: Math.max(8, Math.min(r.left, window.innerWidth - 336)),
          bottom: window.innerHeight - r.top + 6,
        });
      }
    }
    setOpen((v) => !v);
  };
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        title="点击编辑标签"
        className="flex max-w-[260px] flex-wrap items-center gap-1 rounded-sm border border-dashed border-bg-border px-1.5 py-1 text-left transition-colors hover:border-accent"
      >
        {tags.length === 0 ? (
          <span className="text-[11px] text-text-muted">+ 标签</span>
        ) : (
          tags.map((tag) => <TagChip key={tag} tag={tag} />)
        )}
      </button>
      {open && pos && (
        <>
          <button
            type="button"
            aria-label="关闭标签选择"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-50 w-[320px] rounded-md border border-bg-border bg-bg-panel p-2 shadow-neo"
            style={{ left: pos.left, bottom: pos.bottom }}
          >
            {TAG_GROUPS.map((g) => (
              <div key={g.key} className="mb-1.5 last:mb-0">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {g.name}
                </div>
                <div className="flex flex-wrap gap-1">
                  {g.tags.map((tag) => {
                    const on = tags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          onChange(on ? tags.filter((x) => x !== tag) : [...tags, tag])
                        }
                        className={`rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${
                          on ? g.cls : 'border-bg-border bg-bg-elevated text-text-muted hover:text-text-primary'
                        }`}
                      >
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
