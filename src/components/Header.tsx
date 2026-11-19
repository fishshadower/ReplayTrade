import { ArrowDownUp, Camera, CandlestickChart, CircleHelp, Expand, Maximize2, Minimize2, PanelsTopLeft, Play, X } from 'lucide-react';
import type { DataSource, DataSourceOption, Timeframe } from '../types/market';
import { SYMBOLS, TIME_FRAMES } from '../types/market';
import { formatCurrency, formatPct } from '../utils/tradingCalculations';
import { Tooltip } from './ui';

interface HeaderProps {
  symbol: string;
  timeframe: Timeframe;
  onSymbolChange: (s: string) => void;
  onTimeframeChange: (t: Timeframe) => void;
  balance: number;
  startingBalance: number;
  totalPnl: number;
  currentPrice: number;
  decimals: number;
  source: DataSource | null;
  replayActive: boolean;
  onStartReplay: () => void;
  onExitReplay: () => void;
  canStartReplay: boolean;
  sourceOption: DataSourceOption;
  availableSources: DataSourceOption[];
  onSourceChange: (s: DataSourceOption) => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  chartExpanded: boolean;
  onToggleChartExpanded: () => void;
  invertPriceScale: boolean;
  onToggleInvertPriceScale: () => void;
  onShowHelp: () => void;
  onTakeScreenshot: () => void;
}

export function Header({
  symbol,
  timeframe,
  onSymbolChange,
  onTimeframeChange,
  balance,
  startingBalance,
  totalPnl,
  currentPrice,
  decimals,
  source,
  replayActive,
  onStartReplay,
  onExitReplay,
  canStartReplay,
  sourceOption,
  availableSources,
  onSourceChange,
  fullscreen,
  onToggleFullscreen,
  chartExpanded,
  onToggleChartExpanded,
  invertPriceScale,
  onToggleInvertPriceScale,
  onShowHelp,
  onTakeScreenshot,
}: HeaderProps) {
  const pnlPositive = totalPnl >= 0;

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-bg-border bg-bg-panel px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-accent shadow-neo-sm">
          <CandlestickChart size={18} className="text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-bold tracking-tight text-text-primary">ReplayTrade</div>
          <div className="text-[11px] font-medium uppercase tracking-widest text-text-muted">
            K 线回放 · 模拟练习
          </div>
        </div>
        {source === 'demo' && (
          <span className="ml-1 rounded-sm border border-yellow-500/50 bg-yellow-500/10 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-yellow-400">
            演示
          </span>
        )}
        {source === 'binance' && (
          <span className="ml-1 rounded-sm border border-up/50 bg-up-dim px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-up">
            实时数据
          </span>
        )}
        {source === 'oanda' && (
          <span className="ml-1 rounded-sm border border-accent/60 bg-accent-dim px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-accent">
            OANDA
          </span>
        )}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-1.5">
          <label htmlFor="hdr-symbol" className="sr-only">
            市场代码
          </label>
          <select
            id="hdr-symbol"
            value={symbol}
            onChange={(e) => onSymbolChange(e.target.value)}
            disabled={replayActive}
            className="h-8 cursor-pointer rounded-sm border border-bg-border bg-bg-elevated px-2 font-mono text-[14px] font-semibold text-text-primary outline-none transition-colors hover:border-accent focus:border-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {SYMBOLS.map((s) => (
              <option key={s.symbol} value={s.symbol}>
                {s.symbol}
              </option>
            ))}
          </select>
          <label htmlFor="hdr-tf" className="sr-only">
            周期
          </label>
          <select
            id="hdr-tf"
            value={timeframe}
            onChange={(e) => onTimeframeChange(e.target.value as Timeframe)}
            disabled={replayActive}
            className="h-8 cursor-pointer rounded-sm border border-bg-border bg-bg-elevated px-2 font-mono text-[14px] font-semibold text-text-primary outline-none transition-colors hover:border-accent focus:border-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            {TIME_FRAMES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {availableSources.length > 1 && (
            <>
              <label htmlFor="hdr-source" className="sr-only">
                数据源
              </label>
              <select
                id="hdr-source"
                value={sourceOption}
                onChange={(e) => onSourceChange(e.target.value as DataSourceOption)}
                disabled={replayActive}
                title={sourceOption === 'oanda' ? 'OANDA v20（需要令牌）' : 'Binance 公共行情'}
                className="h-8 cursor-pointer rounded-sm border border-bg-border bg-bg-elevated px-2 font-mono text-[14px] font-semibold text-text-primary outline-none transition-colors hover:border-accent focus:border-accent disabled:cursor-not-allowed disabled:opacity-40"
              >
                {availableSources.map((s) => (
                  <option key={s} value={s}>
                    {s === 'oanda' ? 'OANDA' : 'Binance'}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        <button
          onClick={replayActive ? onExitReplay : onStartReplay}
          disabled={!replayActive && !canStartReplay}
          className={`flex h-8 items-center gap-1.5 rounded-sm border px-3 text-[14px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            replayActive
              ? 'border-down/60 bg-down-dim text-down leading-none hover:border-down hover:bg-down hover:text-white'
              : 'border-accent bg-accent text-white hover:bg-accent-hover'
          }`}
        >
          {replayActive ? <X size={14} /> : <Play size={14} />}
          {replayActive ? '退出回放' : '开始回放'}
        </button>

        <Tooltip content={fullscreen ? '退出全屏 (F)' : '全屏 (F)'}>
          <button
            onClick={onToggleFullscreen}
            aria-label={fullscreen ? '退出全屏' : '进入全屏'}
            className="flex h-8 w-8 items-center justify-center rounded-sm border border-bg-border bg-bg-elevated text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </Tooltip>

        <Tooltip content={chartExpanded ? '退出专注模式 (Esc)' : '专注图表（隐藏侧栏）'}>
          <button
            onClick={onToggleChartExpanded}
            aria-label={chartExpanded ? '退出专注模式' : '专注图表'}
            className={`flex h-8 w-8 items-center justify-center rounded-sm border transition-colors hover:border-accent hover:text-text-primary ${
              chartExpanded
                ? 'border-accent bg-accent-dim text-accent'
                : 'border-bg-border bg-bg-elevated text-text-secondary'
            }`}
          >
            {chartExpanded ? <PanelsTopLeft size={14} /> : <Expand size={14} />}
          </button>
        </Tooltip>

        <Tooltip content="翻转价格轴（把下跌看成上涨）">
          <button
            onClick={onToggleInvertPriceScale}
            aria-label="翻转价格轴"
            aria-pressed={invertPriceScale}
            className={`flex h-8 w-8 items-center justify-center rounded-sm border transition-colors hover:border-accent hover:text-text-primary ${
              invertPriceScale
                ? 'border-accent bg-accent-dim text-accent'
                : 'border-bg-border bg-bg-elevated text-text-secondary'
            }`}
          >
            <ArrowDownUp size={14} />
          </button>
        </Tooltip>

        <Tooltip content="快捷键 (Alt+H)">
          <button
            onClick={onShowHelp}
            aria-label="键盘快捷键"
            className="flex h-8 w-8 items-center justify-center rounded-sm border border-bg-border bg-bg-elevated text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
          >
            <CircleHelp size={14} />
          </button>
        </Tooltip>

        <Tooltip content="保存图表截图 (PNG)">
          <button
            onClick={onTakeScreenshot}
            aria-label="保存图表截图"
            className="flex h-8 w-8 items-center justify-center rounded-sm border border-bg-border bg-bg-elevated text-text-secondary transition-colors hover:border-accent hover:text-text-primary"
          >
            <Camera size={14} />
          </button>
        </Tooltip>

        {replayActive && currentPrice > 0 && (
          <div className="hidden text-right font-mono leading-tight md:block">
            <div className="text-[11px] uppercase tracking-wider text-text-muted">{symbol}</div>
            <div className="text-[15px] font-bold text-text-primary">
              {currentPrice.toLocaleString('en-US', {
                minimumFractionDigits: decimals,
                maximumFractionDigits: decimals,
              })}
            </div>
          </div>
        )}

      </div>
    </header>
  );
}
