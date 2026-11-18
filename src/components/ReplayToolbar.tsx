import {
  ChevronLeft,
  ChevronsRight,
  FastForward,
  Pause,
  Play,
  Rewind,
  RotateCcw,
  SkipBack,
  SkipForward,
  X,
  Zap,
} from 'lucide-react';
import type { ReplayControls } from '../types/replay';
import type { Timeframe } from '../types/market';
import { REPLAY_SPEEDS } from '../utils/replayEngine';
import { formatCandleDate } from '../utils/candleUtils';

interface ReplayToolbarProps {
  controls: ReplayControls;
  timeframe: Timeframe;
  decimals: number;
  autoFollow: boolean;
  onToggleAutoFollow: () => void;
  variant?: 'floating' | 'inline';
}

export function ReplayToolbar({
  controls,
  timeframe,
  autoFollow,
  onToggleAutoFollow,
  variant = 'floating',
}: ReplayToolbarProps) {
  const { state, togglePlay, nextCandle, previousCandle, skipBackward, skipForward, resetReplay, exitReplay, setSpeed, jumpToLive } =
    controls;

  const total = state.candles.length;
  const current = state.candles[state.currentReplayIndex];
  const atEnd = state.currentReplayIndex >= total - 1;
  const atStart = state.currentReplayIndex <= state.visibleStartIndex;
  const atReplayStart = state.currentReplayIndex === (state.replayStartIndex ?? 0);
  const revealedPct = total > 0 ? ((state.currentReplayIndex + 1) / total) * 100 : 0;
  const remaining = Math.max(0, total - state.currentReplayIndex - 1);

  const bar = (
    <div className="relative flex flex-col gap-2 overflow-hidden rounded-md border border-bg-border bg-bg-panel/95 p-2 shadow-neo backdrop-blur-sm">
      {/* Visual Replay Progress Bar */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-bg-hover">
        <div
          className="h-full bg-accent transition-all duration-200"
          style={{ width: `${Math.min(100, Math.max(0, revealedPct))}%` }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] text-text-secondary pt-0.5">
        <span className="flex items-center gap-1 rounded-sm border border-accent/60 bg-accent-dim px-1.5 py-0.5 font-semibold uppercase tracking-wider text-accent glow-accent">
          <Zap size={10} className={state.isPlaying ? 'animate-pulse text-amber-400' : ''} /> 回放模式
        </span>
        <span>
          当前:{' '}
          <span className="text-text-primary font-semibold">
            {current ? formatCandleDate(current.time, timeframe) : '—'}
          </span>
        </span>
        <span>
          K 线:{' '}
          <span className="text-text-primary">
            {total > 0 ? state.currentReplayIndex + 1 : 0} / {total.toLocaleString()}
          </span>
        </span>
        <span>
          已揭示: <span className="font-bold text-accent">{revealedPct.toFixed(1)}%</span>
        </span>
        <span>
          剩余: <span className="text-text-primary">{remaining.toLocaleString()}</span>
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <ToolButton label="退出回放" onClick={exitReplay} tone="danger" title="退出回放 (Esc)">
          <X size={15} />
        </ToolButton>
        <ToolButton label="重置回放" onClick={resetReplay} disabled={atReplayStart}>
          <RotateCcw size={15} />
        </ToolButton>
        <div className="mx-0.5 h-6 w-px bg-bg-border" aria-hidden="true" />
        <ToolButton label="后退 10 根" onClick={() => skipBackward(10)} disabled={atStart}>
          <Rewind size={15} />
        </ToolButton>
        <ToolButton label="后退 5 根" onClick={() => skipBackward(5)} disabled={atStart}>
          <ChevronLeft size={15} />
        </ToolButton>
        <ToolButton label="上一根" onClick={previousCandle} disabled={atStart}>
          <SkipBack size={15} />
        </ToolButton>
        <ToolButton label={state.isPlaying ? '暂停' : '播放'} onClick={togglePlay} disabled={atEnd} accent>
          {state.isPlaying ? <Pause size={15} /> : <Play size={15} />}
        </ToolButton>
        <ToolButton label="下一根" onClick={nextCandle} disabled={atEnd}>
          <SkipForward size={15} />
        </ToolButton>
        <div className="mx-0.5 h-6 w-px bg-bg-border" aria-hidden="true" />
        <ToolButton label="前进 5 根" onClick={() => skipForward(5)} disabled={atEnd}>
          <ChevronsRight size={15} />
        </ToolButton>
        <ToolButton label="前进 10 根" onClick={() => skipForward(10)} disabled={atEnd}>
          <FastForward size={15} />
        </ToolButton>
        <div className="mx-0.5 h-6 w-px bg-bg-border" aria-hidden="true" />
        <ToolButton label="跳到最新 K 线" onClick={jumpToLive}>
          <ChevronsRight size={15} />
        </ToolButton>
        <button
          onClick={onToggleAutoFollow}
          aria-pressed={autoFollow}
          className={`rounded-sm border px-2 py-1.5 text-[12px] font-semibold transition-colors ${
            autoFollow
              ? 'border-accent bg-accent-dim text-accent'
              : 'border-bg-border bg-bg-elevated text-text-secondary hover:bg-bg-hover'
          }`}
        >
          自动跟随
        </button>
        <label className="ml-auto flex items-center gap-1.5 font-mono text-[12px] text-text-secondary">
          速度
          <select
            value={state.speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="h-7 cursor-pointer rounded-sm border border-bg-border bg-bg-elevated px-1.5 font-mono text-[13px] font-semibold text-text-primary outline-none focus:border-accent"
            aria-label="回放速度"
          >
            {REPLAY_SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}x
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );

  if (variant === 'floating') {
    return (
      <div className="pointer-events-none absolute inset-x-2 top-2 z-20">
        <div className="pointer-events-auto">{bar}</div>
      </div>
    );
  }
  return bar;
}

function ToolButton({
  children,
  onClick,
  label,
  disabled,
  accent = false,
  tone = 'default',
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
  accent?: boolean;
  tone?: 'default' | 'danger';
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
      className={`flex h-8 min-w-8 items-center justify-center rounded-sm border px-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        accent
          ? 'border-accent bg-accent text-white hover:bg-accent-hover'
          : tone === 'danger'
            ? 'border-down/60 text-down hover:bg-down-dim'
            : 'border-bg-border bg-bg-elevated text-text-primary hover:bg-bg-hover'
      }`}
    >
      {children}
    </button>
  );
}
