import { CandlestickChart, Keyboard, Play, Target } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Modal, Stat } from './ui';

const ONBOARDED_KEY = 'replaytrade:onboarded';

export function isOnboarded(): boolean {
  try {
    return localStorage.getItem(ONBOARDED_KEY) === '1';
  } catch {
    return true;
  }
}

export function markOnboarded(): void {
  try {
    localStorage.setItem(ONBOARDED_KEY, '1');
  } catch {
    /* ignore */
  }
}

interface Step {
  id: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  kbd: string[];
  stats: { label: string; value: string; tone?: 'up' | 'down' }[];
}

const STEPS: Step[] = [
  {
    id: 'welcome',
    icon: <CandlestickChart size={22} className="text-accent" />,
    title: '欢迎来到 ReplayTrade',
    body: '一个逐根 K 线回放的模拟交易终端。研究任意支持的市场、验证你的判断、留下完整的模拟交易记录——全部在浏览器里完成。',
    kbd: ['Alt+H', '快捷键'],
    stats: [
      { label: '市场', value: '5' },
      { label: '周期', value: '7' },
      { label: '模拟资金', value: '$10k' },
    ],
  },
  {
    id: 'replay',
    icon: <Play size={22} className="text-accent" />,
    title: '逐根 K 线回放',
    body: '点击「开始回放」，在图上点选起始 K 线，然后按自己的节奏逐根推进。只显示已揭示的 K 线，绝不会偷看未来。',
    kbd: ['空格', '播放 / 暂停'],
    stats: [
      { label: '揭示方式', value: '逐根推进' },
      { label: '速度档位', value: '0.25x – 10x' },
    ],
  },
  {
    id: 'trading',
    icon: <Target size={22} className="text-accent" />,
    title: '内置风险管理的模拟交易',
    body: '在交易面板下单，自带止损止盈。每笔平仓都按 R 倍数计分，汇入你的统计和权益曲线。',
    kbd: ['→', '下一根'],
    stats: [
      { label: 'R 倍数', value: '自动跟踪' },
      { label: '统计', value: '实时' },
    ],
  },
  {
    id: 'shortcuts',
    icon: <Keyboard size={22} className="text-accent" />,
    title: '键盘优先，专业终端手感',
    body: '数字键 1–7 切周期，方向键逐根推进，+/- 调速度，F 全屏。随时按 Alt+H 重新打开本引导。',
    kbd: ['1–7', '切换周期'],
    stats: [
      { label: '快捷键', value: '12+' },
      { label: '撤销绘图', value: 'Ctrl+Z' },
    ],
  },
];

interface OnboardingOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function OnboardingOverlay({ open, onClose }: OnboardingOverlayProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  if (!current) return null;

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const finish = useCallback(() => {
    markOnboarded();
    onClose();
  }, [onClose]);

  if (!open) return null;

  const isLast = step === STEPS.length - 1;

  return (
    <Modal
      title={
        <span className="flex items-center gap-2">
          <CandlestickChart size={16} className="text-accent" />
          ReplayTrade 快速上手
        </span>
      }
      subtitle="大概 20 秒看完"
      labelledBy="onboarding-title"
      onClose={finish}
      footer={
        <>
          {isLast ? (
            <Button variant="primary" size="lg" onClick={finish} autoFocus>
              开始交易
            </Button>
          ) : (
            <Button variant="primary" size="lg" onClick={() => setStep((s) => s + 1)} autoFocus>
              下一步
            </Button>
          )}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="text-[13px] font-semibold text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              上一步
            </button>
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {STEPS.map((s, i) => (
                <span
                  key={s.id}
                  className={`h-1.5 w-4 rounded-full transition-colors ${
                    i === step ? 'bg-accent' : i < step ? 'bg-accent/40' : 'bg-bg-hover'
                  }`}
                />
              ))}
            </div>
            <button
              onClick={finish}
              className="text-[13px] font-semibold text-text-muted hover:text-text-secondary"
            >
              跳过
            </button>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-bg-border bg-bg-elevated">
            {current.icon}
          </div>
          <div>
            <Badge tone="accent">第 {step + 1} / {STEPS.length} 步</Badge>
            <h3 className="mt-1 text-[16px] font-bold text-text-primary">{current.title}</h3>
          </div>
        </div>
        <p className="text-[14px] leading-relaxed text-text-secondary">{current.body}</p>
        <div className="grid grid-cols-2 gap-2">
          {current.stats.map((s) => (
            <Stat key={s.label} label={s.label} value={s.value} tone={s.tone ?? 'default'} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {current.kbd.map((k) => (
            <kbd
              key={k}
              className="rounded-sm border border-bg-border bg-bg-elevated px-1.5 py-0.5 font-mono text-[12px] text-text-secondary"
            >
              {k}
            </kbd>
          ))}
        </div>
      </div>
    </Modal>
  );
}
