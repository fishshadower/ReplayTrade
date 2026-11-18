import { AlertTriangle, Database, Play, Radio } from 'lucide-react';
import type { DataSource, DataSourceOption, Timeframe } from '../types/market';
import { SYMBOLS, TIME_FRAMES } from '../types/market';
import type { LoadProgress } from '../services/marketDataService';
import type { DataRange } from '../hooks/useMarketData';
import { sixMonthRange } from '../hooks/useMarketData';
import { formatShortDate } from '../utils/candleUtils';
import { Skeleton } from './ui';

interface MarketSelectorProps {
  symbol: string;
  timeframe: Timeframe;
  onSymbolChange: (s: string) => void;
  onTimeframeChange: (t: Timeframe) => void;
  loading: boolean;
  progress: LoadProgress | null;
  error: string | null;
  source: DataSource | null;
  range: DataRange | null;
  candleCount: number;
  canStartReplay: boolean;
  replayActive: boolean;
  onStartReplay: () => void;
  onRetry: () => void;
  onUseDemo: () => void;
  sourceOption: DataSourceOption;
  availableSources: DataSourceOption[];
  onSourceChange: (s: DataSourceOption) => void;
}

export function MarketSelector({
  symbol,
  timeframe,
  onSymbolChange,
  onTimeframeChange,
  loading,
  progress,
  error,
  source,
  range,
  candleCount,
  canStartReplay,
  replayActive,
  onStartReplay,
  onRetry,
  onUseDemo,
  sourceOption,
  availableSources,
  onSourceChange,
}: MarketSelectorProps) {
  const target = sixMonthRange();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {loading && !progress ? (
          <div className="flex flex-col gap-1.5">
            <Skeleton height={10} width={80} />
            <Skeleton height={36} />
            <Skeleton height={10} width={80} />
            <Skeleton height={36} />
            {availableSources.length > 1 && (
              <>
                <Skeleton height={10} width={80} />
                <Skeleton height={36} />
              </>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ms-symbol" className="text-[12px] font-semibold uppercase tracking-wider text-text-muted">
                市场
              </label>
              <select
                id="ms-symbol"
                value={symbol}
                onChange={(e) => onSymbolChange(e.target.value)}
                disabled={loading || replayActive}
                className="h-9 cursor-pointer rounded-sm border border-bg-border bg-bg-elevated px-2 font-mono text-[14px] font-semibold text-text-primary outline-none transition-colors hover:border-accent focus:border-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                {SYMBOLS.map((s) => (
                  <option key={s.symbol} value={s.symbol}>
                    {s.symbol} — {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ms-tf" className="text-[12px] font-semibold uppercase tracking-wider text-text-muted">
                周期
              </label>
              <select
                id="ms-tf"
                value={timeframe}
                onChange={(e) => onTimeframeChange(e.target.value as Timeframe)}
                disabled={loading || replayActive}
                className="h-9 cursor-pointer rounded-sm border border-bg-border bg-bg-elevated px-2 font-mono text-[14px] font-semibold text-text-primary outline-none transition-colors hover:border-accent focus:border-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                {TIME_FRAMES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            {availableSources.length > 1 && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="ms-source" className="text-[12px] font-semibold uppercase tracking-wider text-text-muted">
                  数据源
                </label>
                <select
                  id="ms-source"
                  value={sourceOption}
                  onChange={(e) => onSourceChange(e.target.value as DataSourceOption)}
                  disabled={loading || replayActive}
                  className="h-9 cursor-pointer rounded-sm border border-bg-border bg-bg-elevated px-2 font-mono text-[14px] font-semibold text-text-primary outline-none transition-colors hover:border-accent focus:border-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {availableSources.map((s) => (
                    <option key={s} value={s}>
                      {s === 'oanda' ? 'OANDA — 黄金现货 (XAU_USD)' : 'Binance — 黄金代币 (PAXGUSDT)'}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </>
        )}
      </div>

      {/* Data status */}
      <div className="rounded-sm border border-bg-border bg-bg-panel p-2.5">
        <div className="flex items-center gap-1.5">
          <Database size={12} className="text-accent" />
          <span className="text-[12px] font-semibold uppercase tracking-wider text-text-muted">
            行情数据
          </span>
          {source === 'binance' && (
            <span className="ml-auto flex items-center gap-1 rounded-sm border border-up/50 bg-up-dim px-1.5 py-px text-[11px] font-semibold uppercase text-up">
              <Radio size={9} /> Binance
            </span>
          )}
          {source === 'oanda' && (
            <span className="ml-auto flex items-center gap-1 rounded-sm border border-accent/60 bg-accent-dim px-1.5 py-px text-[11px] font-semibold uppercase text-accent">
              <Radio size={9} /> OANDA
            </span>
          )}
          {source === 'demo' && (
            <span className="ml-auto rounded-sm border border-yellow-500/50 bg-yellow-500/10 px-1.5 py-px text-[11px] font-semibold uppercase text-yellow-400">
              演示
            </span>
          )}
        </div>

        {loading ? (
          <div className="mt-2">
            <div className="flex items-center justify-between font-mono text-[12px] text-text-secondary">
              <span>正在加载历史数据…</span>
              <span className="text-accent">
                {progress ? `${progress.pct}%` : '0%'}
              </span>
            </div>
            <div
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-bg-hover"
              role="progressbar"
              aria-valuenow={progress?.pct ?? 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="历史数据加载进度"
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-150"
                style={{ width: `${progress?.pct ?? 0}%` }}
              />
            </div>
            <div className="mt-1 font-mono text-[12px] text-text-muted">
              {formatShortDate(target.from / 1000)} → {formatShortDate(target.to / 1000)}
            </div>
          </div>
        ) : (
          <dl className="mt-2 space-y-1 font-mono text-[12px]">
            <div className="flex justify-between">
              <dt className="text-text-muted">K 线数</dt>
              <dd className="text-text-primary">{candleCount.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">开始</dt>
              <dd className="text-text-primary">
                {range ? formatShortDate(range.from) : '—'}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-text-muted">结束</dt>
              <dd className="text-text-primary">{range ? formatShortDate(range.to) : '—'}</dd>
            </div>
            {source === 'demo' && (
              <div className="pt-1 text-[12px] leading-snug text-yellow-400/90">
                演示数据：本地生成，非真实行情。
              </div>
            )}
          </dl>
        )}
      </div>

      {error && (
        <div className="rounded-sm border border-down/50 bg-down-dim p-2.5">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-down" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold text-down">数据加载失败</p>
              <p className="mt-0.5 break-words font-mono text-[12px] leading-snug text-down/90">
                {error}
              </p>
              <div className="mt-2 flex gap-1.5">
                <button
                  onClick={onRetry}
                  className="rounded-sm border border-bg-border bg-bg-elevated px-2 py-1 text-[12px] font-semibold text-text-primary hover:bg-bg-hover"
                >
                  重试
                </button>
                <button
                  onClick={onUseDemo}
                  className="rounded-sm border border-yellow-500/60 bg-yellow-500/10 px-2 py-1 text-[12px] font-semibold text-yellow-400 hover:bg-yellow-500/20"
                >
                  使用演示数据
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!error && !loading && (
        <button
          onClick={onStartReplay}
          disabled={!canStartReplay}
          className="flex items-center justify-center gap-1.5 rounded-sm border border-accent bg-accent px-3 py-2.5 text-[15px] font-bold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play size={15} /> 开始回放
        </button>
      )}
    </div>
  );
}
