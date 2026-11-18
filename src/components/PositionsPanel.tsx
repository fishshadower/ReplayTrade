import { Crosshair } from 'lucide-react';
import type { Position } from '../types/trading';
import {
  formatCurrency,
  formatPrice,
  positionPnl,
  positionRisk,
  positionValue,
  rMultiple,
} from '../utils/tradingCalculations';

interface PositionsPanelProps {
  positions: Position[];
  currentPrice: number;
  decimals: number;
  onClose: (id: string) => void;
  onCloseHalf: (id: string) => void;
  onMoveStop: (id: string) => void;
}

export function PositionsPanel({
  positions,
  currentPrice,
  decimals,
  onClose,
  onCloseHalf,
  onMoveStop,
}: PositionsPanelProps) {
  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
        <Crosshair size={22} className="text-bg-border" />
        <p className="text-[14px] text-text-muted">暂无持仓</p>
        <p className="text-[12px] text-text-muted">在交易面板下一笔模拟单开始练习。</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-bg-border">
      {positions.map((p) => {
        const pnl = positionPnl(p, currentPrice);
        const value = positionValue(p, currentPrice);
        const pnlPct = ((pnl / (p.entryPrice * p.remaining)) * 100) || 0;
        const risk = positionRisk(p);
        const r = rMultiple(pnl, risk);
        return (
          <div key={p.id} className="px-3 py-2.5 font-mono text-[13px]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-text-secondary">{p.symbol}</span>
                <span
                  className={`rounded-sm px-1.5 py-px text-[12px] font-bold ${
                    p.direction === 'long' ? 'bg-up-dim text-up' : 'bg-down-dim text-down'
                  }`}
                >
                  {p.direction === 'long' ? '多头' : '空头'}
                </span>
                {p.stopLoss === p.entryPrice && (
                  <span className="rounded-sm bg-accent-dim px-1 py-px text-[11px] font-semibold text-accent">
                    SL = 保本
                  </span>
                )}
                {p.quantity !== p.remaining && (
                  <span className="text-[12px] text-text-muted">剩余 {p.remaining}</span>
                )}
              </div>
              <div className={`rounded-sm px-1.5 py-0.5 text-right font-mono transition-all ${pnl >= 0 ? 'bg-up-dim text-up' : 'bg-down-dim text-down'}`}>
                <span className="font-bold">{formatCurrency(pnl)}</span>{' '}
                <span className="text-[12px]">({pnlPct >= 0 ? '+' : ''}
                  {pnlPct.toFixed(2)}%)</span>
              </div>
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
              <Meta label="开仓" value={formatPrice(p.entryPrice, decimals)} />
              <Meta label="现价" value={formatPrice(currentPrice, decimals)} />
              <Meta label="数量" value={String(p.remaining)} />
              <Meta label="价值" value={formatCurrency(value)} />
              <Meta
                label="止损"
                value={p.stopLoss !== null ? formatPrice(p.stopLoss, decimals) : '—'}
              />
              <Meta
                label="止盈"
                value={p.takeProfit !== null ? formatPrice(p.takeProfit, decimals) : '—'}
              />
              <Meta label="风险" value={risk !== null ? formatCurrency(risk) : '—'} />
              <Meta
                label="R"
                value={r !== null ? `${r >= 0 ? '+' : ''}${r.toFixed(2)}R` : '—'}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ActionBtn onClick={() => onClose(p.id)} tone="danger">
                平仓
              </ActionBtn>
              <ActionBtn onClick={() => onCloseHalf(p.id)}>平一半</ActionBtn>
              <ActionBtn onClick={() => onMoveStop(p.id)}>SL 移到开仓价</ActionBtn>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-primary">{value}</span>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'danger' | 'default';
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-sm border px-2 py-1 text-[12px] font-semibold transition-colors ${
        tone === 'danger'
          ? 'border-down/60 text-down hover:bg-down-dim'
          : 'border-bg-border text-text-secondary hover:bg-bg-hover hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}
