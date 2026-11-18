import { Check, X } from 'lucide-react';
import type { Candle } from '../types/market';
import type { Timeframe } from '../types/market';
import { formatCandleDate } from '../utils/candleUtils';
import { formatPrice } from '../utils/tradingCalculations';

interface ReplayStartSelectorProps {
  candles: Candle[];
  selectedIndex: number | null;
  timeframe: Timeframe;
  decimals: number;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Shown while the user is choosing where to start the replay.
 * Displays the currently selected candle and lets the user confirm.
 */
export function ReplayStartSelector({
  candles,
  selectedIndex,
  timeframe,
  decimals,
  onCancel,
  onConfirm,
}: ReplayStartSelectorProps) {
  const selected =
    selectedIndex !== null && selectedIndex >= 0 && selectedIndex < candles.length
      ? candles[selectedIndex]
      : null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-14 z-20 flex justify-center">
      <div className="pointer-events-auto w-full max-w-sm rounded-md border border-bg-border bg-bg-panel/95 p-3 shadow-neo backdrop-blur-sm animate-fade-in">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded-sm border border-accent/60 bg-accent-dim px-1.5 py-0.5 text-[12px] font-semibold uppercase tracking-wider text-accent">
            回放从这里开始
          </span>
          {!selected && (
            <span className="text-[13px] text-text-secondary">
              悬停并点击 K 线选择起点。
            </span>
          )}
        </div>

        {selected ? (
          <>
            <div className="flex items-center justify-between font-mono text-[13px]">
              <span className="text-text-muted">日期</span>
              <span className="text-text-primary">{formatCandleDate(selected.time, timeframe)}</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[13px]">
              <span className="text-text-muted">价格</span>
              <span className="text-text-primary">{formatPrice(selected.close, decimals)}</span>
            </div>
            <div className="flex items-center justify-between font-mono text-[13px]">
              <span className="text-text-muted">K 线</span>
              <span className="text-text-primary">
                {selectedIndex !== null ? selectedIndex + 1 : 0} / {candles.length.toLocaleString()}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={onCancel}
                className="flex flex-1 items-center justify-center gap-1 rounded-sm border border-bg-border px-3 py-2 text-[14px] font-semibold text-text-secondary hover:bg-bg-hover"
              >
                <X size={14} /> 取消
              </button>
              <button
                onClick={onConfirm}
                autoFocus
                className="flex flex-1 items-center justify-center gap-1 rounded-sm bg-accent px-3 py-2 text-[14px] font-bold text-white hover:bg-accent-hover"
              >
                <Check size={14} /> 开始回放
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-sm border border-bg-border bg-bg-elevated px-3 py-2 text-center font-mono text-[13px] text-text-secondary">
            点击图表上任意 K 线选择回放起点
          </div>
        )}
      </div>
    </div>
  );
}
