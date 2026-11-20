import { useEffect, useMemo, useRef, useState } from 'react';
import { X , RefreshCw } from 'lucide-react';
import type { Direction } from '../types/trading';
import type { OrderDraft } from '../types/trading';
import { formatCurrency, formatPrice, orderPreview, validateOrder } from '../utils/tradingCalculations';

interface TradePanelProps {
  symbol: string;
  currentPrice: number;
  availableBalance: number;
  decimals: number;
  disabled?: boolean;
  onPlaceOrder: (draft: OrderDraft) => { ok: boolean; errors: string[] };
}

const SKIP_CONFIRM_KEY = 'replaytrade:skip_confirm';

function parseNum(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export function TradePanel({
  symbol,
  currentPrice,
  availableBalance,
  decimals,
  disabled = false,
  onPlaceOrder,
}: TradePanelProps) {
  const [direction, setDirection] = useState<Direction>('long');
  const [quantityStr, setQuantityStr] = useState<string>(() => {
    try {
      return localStorage.getItem('replaytrade:qty') ?? '0.1';
    } catch {
      return '0.1';
    }
  });
  const setQty = (v: string): void => {
    setQuantityStr(v);
    try {
      localStorage.setItem('replaytrade:qty', v);
    } catch {
      /* ignore */
    }
  };
  const [entryStr, setEntryStr] = useState('');
  const [followEntry, setFollowEntry] = useState(true);
  const [slStr, setSlStr] = useState('');
  const [tpStr, setTpStr] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Once the user edits the entry price, stop auto-following the live price so
  // replay ticks never overwrite what they typed.
  useEffect(() => {
    setFollowEntry(true);
  }, [symbol]);

  useEffect(() => {
    if (!followEntry) return;
    if (currentPrice > 0) {
      setEntryStr(currentPrice.toFixed(decimals));
    }
  }, [currentPrice, decimals]);

  const draft: OrderDraft = useMemo(() => {
    const quantity = parseNum(quantityStr);
    const entry = parseNum(entryStr);
    const sl = parseNum(slStr);
    const tp = parseNum(tpStr);
    return {
      direction,
      quantity: quantity === null || Number.isNaN(quantity) ? 0 : quantity,
      entryPrice: entry === null || Number.isNaN(entry) ? 0 : entry,
      stopLoss: sl === null || Number.isNaN(sl) ? null : sl,
      takeProfit: tp === null || Number.isNaN(tp) ? null : tp,
    };
  }, [direction, quantityStr, entryStr, slStr, tpStr]);

  const preview = useMemo(() => orderPreview(draft), [draft]);

  const [skipConfirm, setSkipConfirm] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SKIP_CONFIRM_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [pendingDraft, setPendingDraft] = useState<OrderDraft | null>(null);
  const [lastErrors, setLastErrors] = useState<string[] | null>(null);

  const place = (d: OrderDraft) => {
    const result = onPlaceOrder(d);
    if (result.ok) {
      setConfirmOpen(false);
      setPendingDraft(null);
      setSubmitted(false);
      setLastErrors(null);
    }
  };

  /** 按钮即方向：校验按按钮方向现算，不等异步 state；同步内部方向供快捷键使用 */
  const submitDirection = (dir: Direction) => {
    const finalDraft: OrderDraft = { ...draft, direction: dir };
    const check = validateOrder(finalDraft, availableBalance);
    setSubmitted(true);
    setDirection(dir);
    if (!check.valid) {
      setLastErrors(check.errors);
      return;
    }
    setLastErrors(null);
    if (skipConfirm) {
      place(finalDraft);
    } else {
      setPendingDraft(finalDraft);
      setConfirmOpen(true);
    }
  };

  const toggleSkipConfirm = (v: boolean) => {
    setSkipConfirm(v);
    try {
      localStorage.setItem(SKIP_CONFIRM_KEY, v ? '1' : '0');
    } catch {
      /* ignore */
    }
  };

  const canSubmit = draft.quantity > 0 && draft.entryPrice > 0;

  const applySlPct = (pct: number) => {
    const e = parseNum(entryStr);
    if (e === null || Number.isNaN(e) || e <= 0) return;
    const sl = direction === 'long' ? e * (1 - pct) : e * (1 + pct);
    setSlStr(sl.toFixed(decimals));
  };

  const applyTpPct = (pct: number) => {
    const e = parseNum(entryStr);
    if (e === null || Number.isNaN(e) || e <= 0) return;
    const tp = direction === 'long' ? e * (1 + pct) : e * (1 - pct);
    setTpStr(tp.toFixed(decimals));
  };

  const applyTpRatio = (ratio: number) => {
    const e = parseNum(entryStr);
    const s = parseNum(slStr);
    if (e === null || Number.isNaN(e) || e <= 0) return;
    if (s === null || Number.isNaN(s) || s <= 0) return;
    const dist = Math.abs(e - s);
    if (dist <= 0) return;
    const tp = direction === 'long' ? e + dist * ratio : e - dist * ratio;
    setTpStr(tp.toFixed(decimals));
  };

  const applyRiskQty = (riskPct: number) => {
    const e = parseNum(entryStr);
    const s = parseNum(slStr);
    if (e === null || Number.isNaN(e) || e <= 0) return;
    if (s === null || Number.isNaN(s) || s <= 0) return;
    const dist = Math.abs(e - s);
    if (dist <= 0) return;
    const qty = (availableBalance * (riskPct / 100)) / dist;
    setQuantityStr(qty.toFixed(4));
  };

  const inputCls = (invalid: boolean) =>
    `w-full rounded-sm border bg-bg-panel px-2.5 py-1.5 font-mono text-[14px] text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-accent ${
      invalid ? 'border-down/60' : 'border-bg-border'
    }`;

  const labelCls = 'mb-1 block text-[12px] font-semibold uppercase tracking-wider text-text-muted';

  const slInvalid =
    submitted &&
    ((direction === 'long' && draft.stopLoss !== null && draft.stopLoss >= draft.entryPrice) ||
      (direction === 'short' && draft.stopLoss !== null && draft.stopLoss <= draft.entryPrice));
  const tpInvalid =
    submitted &&
    ((direction === 'long' && draft.takeProfit !== null && draft.takeProfit <= draft.entryPrice) ||
      (direction === 'short' && draft.takeProfit !== null && draft.takeProfit >= draft.entryPrice));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2.5">
        <div>
          <label htmlFor="tp-qty" className={labelCls}>
            数量
          </label>
          <div className="mt-1 flex flex-wrap gap-1">
            {['0.01', '0.1', '0.2', '0.3', '1', '2', '3'].map((q) => (
              <QuickBtn key={q} onClick={() => setQty(q)} disabled={disabled}>
                {q}
              </QuickBtn>
            ))}
          </div>
          <div className="h-1.5" />
          <ClearableInput
            id="tp-qty"
            value={quantityStr}
            onChange={setQty}
            className={inputCls(submitted && draft.quantity <= 0)}
            placeholder="0.0"
            ariaLabel="数量"
            onClear={() => setQty('')}
          />
        </div>
        <div>
          <label htmlFor="tp-entry" className={labelCls}>
            <span className="flex items-center gap-1">
              开仓价
              <button
                type="button"
                title={followEntry ? '跟随当前价（市价）· 已开启' : '点击跟随当前价（市价）'}
                aria-label="跟随当前价"
                onClick={() => {
                  setFollowEntry(true);
                  if (currentPrice > 0) setEntryStr(currentPrice.toFixed(decimals));
                }}
                className={`flex h-4 w-4 items-center justify-center rounded-sm transition-colors ${
                  followEntry
                    ? 'text-accent'
                    : 'text-text-muted hover:bg-bg-hover hover:text-text-primary'
                }`}
              >
                <RefreshCw size={11} />
              </button>
            </span>
          </label>
          <ClearableInput
            id="tp-entry"
            value={entryStr}
            onChange={(v) => {
              setFollowEntry(false);
              setEntryStr(v);
            }}
            className={inputCls(submitted && draft.entryPrice <= 0)}
            ariaLabel="开仓价"
            onClear={() => {
              setFollowEntry(false);
              setEntryStr('');
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="tp-sl" className={labelCls}>
              止损价
            </label>
            <ClearableInput
              id="tp-sl"
              value={slStr}
              onChange={setSlStr}
              className={inputCls(slInvalid)}
              placeholder="选填"
              ariaLabel="止损价"
              onClear={() => setSlStr('')}
            />
          </div>
          <div>
            <label htmlFor="tp-tp" className={labelCls}>
              止盈价
            </label>
            <ClearableInput
              id="tp-tp"
              value={tpStr}
              onChange={setTpStr}
              className={inputCls(tpInvalid)}
              placeholder="选填"
              ariaLabel="止盈价"
              onClear={() => setTpStr('')}
            />
          </div>
        </div>

        <div>
          <div className={labelCls}>风险快捷键</div>
          <div className="flex flex-wrap gap-1">
            <QuickBtn onClick={() => applySlPct(0.01)} disabled={disabled}>
              SL 1%
            </QuickBtn>
            <QuickBtn onClick={() => applyTpPct(0.02)} disabled={disabled}>
              TP 2%
            </QuickBtn>
            <QuickBtn onClick={() => applyTpPct(0.03)} disabled={disabled}>
              TP 3%
            </QuickBtn>
            <QuickBtn onClick={() => applyTpRatio(2)} disabled={disabled || draft.stopLoss === null}>
              1 : 2
            </QuickBtn>
            <QuickBtn onClick={() => applyTpRatio(3)} disabled={disabled || draft.stopLoss === null}>
              1 : 3
            </QuickBtn>
            <QuickBtn onClick={() => applyRiskQty(1)} disabled={disabled || draft.stopLoss === null}>
              按 1% 风险定量
            </QuickBtn>
          </div>
        </div>
      </div>

      <div className="rounded-sm border border-bg-border bg-bg-panel p-2.5 font-mono text-[13px]">
        <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-text-muted">
          订单预览
        </div>
        <dl className="space-y-1">
          <Row label="仓位价值" value={formatCurrency(preview.positionValue)} />
          <Row
            label="预计风险"
            value={formatCurrency(preview.estimatedRisk)}
            tone={preview.estimatedRisk > 0 ? 'down' : undefined}
          />
          <Row
            label="潜在收益"
            value={formatCurrency(preview.potentialReward)}
            tone={preview.potentialReward > 0 ? 'up' : undefined}
          />
          <Row
            label="风险收益比"
            value={preview.riskRewardRatio !== null ? `1 : ${preview.riskRewardRatio.toFixed(2)}` : '—'}
          />
          <Row
            label="资金风险占比"
            value={
              availableBalance > 0 && preview.estimatedRisk > 0
                ? `${((preview.estimatedRisk / availableBalance) * 100).toFixed(2)}%`
                : '—'
            }
          />
        </dl>
      </div>

      {submitted && lastErrors && lastErrors.length > 0 && (
        <ul className="rounded-sm border border-down/50 bg-down-dim px-2.5 py-2 text-[13px] text-down">
          {lastErrors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onPointerEnter={() => setDirection('long')}
          onClick={() => submitDirection('long')}
          disabled={disabled || !canSubmit}
          className="rounded-sm bg-up px-3 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          买入 / 做多
        </button>
        <button
          onPointerEnter={() => setDirection('short')}
          onClick={() => submitDirection('short')}
          disabled={disabled || !canSubmit}
          className="rounded-sm bg-down px-3 py-2.5 text-[14px] font-bold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          卖出 / 做空
        </button>
      </div>
      <label className="-mt-1 flex cursor-pointer select-none items-center justify-end gap-1.5 text-[12px] text-text-muted">
        <input
          type="checkbox"
          checked={skipConfirm}
          onChange={(e) => toggleSkipConfirm(e.target.checked)}
          className="h-3.5 w-3.5 cursor-pointer accent-[#4f8cff]"
        />
        下单免确认（不弹确认框）
      </label>

      <p className="text-center text-[12px] text-text-muted">
        可用余额：{formatCurrency(availableBalance)}
      </p>

      {confirmOpen && (
        <ConfirmModal
          symbol={symbol}
          draft={pendingDraft ?? draft}
          decimals={decimals}
          onConfirm={() => pendingDraft && place(pendingDraft)}
          onCancel={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}

function ClearableInput({
  id,
  value,
  onChange,
  className,
  placeholder,
  ariaLabel,
  onClear,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  className: string;
  placeholder?: string;
  ariaLabel: string;
  onClear: () => void;
}): JSX.Element {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className + ' pr-7'}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      {value !== '' && (
        <button
          type="button"
          title="清空"
          aria-label={`清空${ariaLabel}`}
          onClick={onClear}
          className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-text-muted transition-colors hover:bg-bg-hover hover:text-text-primary"
        >
          <span className="text-[13px] leading-none">×</span>
        </button>
      )}
    </div>
  );
}

function QuickBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-sm border border-bg-border px-1.5 py-1 text-[12px] font-semibold text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'up' | 'down' }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-text-muted">{label}</dt>
      <dd className={tone === 'up' ? 'text-up' : tone === 'down' ? 'text-down' : 'text-text-primary'}>
        {value}
      </dd>
    </div>
  );
}

function ConfirmModal({
  symbol,
  draft,
  decimals,
  onConfirm,
  onCancel,
}: {
  symbol: string;
  draft: OrderDraft;
  decimals: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const preview = orderPreview(draft);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-order-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-md border border-bg-border bg-bg-panel shadow-neo animate-fade-in">
        <div className="flex items-center justify-between border-b border-bg-border px-4 py-3">
          <h2 id="confirm-order-title" className="text-[15px] font-bold text-text-primary">
            确认{draft.direction === 'long' ? '买入' : '卖出'}订单
          </h2>
          <button onClick={onCancel} aria-label="关闭" className="text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
        <div className="px-4 py-3 font-mono text-[14px]">
          <div className="flex items-center justify-between rounded-sm bg-bg-elevated px-3 py-2">
            <span className="text-text-secondary">{symbol}</span>
            <span className={`font-bold ${draft.direction === 'long' ? 'text-up' : 'text-down'}`}>
              {draft.direction === 'long' ? '买入 / 做多' : '卖出 / 做空'}
            </span>
          </div>
          <dl className="mt-3 space-y-1.5">
            <ConfirmRow label="数量" value={String(draft.quantity)} />
            <ConfirmRow label="开仓价" value={formatPrice(draft.entryPrice, decimals)} />
            <ConfirmRow
              label="止损价"
              value={draft.stopLoss !== null ? formatPrice(draft.stopLoss, decimals) : '—'}
            />
            <ConfirmRow
              label="止盈价"
              value={draft.takeProfit !== null ? formatPrice(draft.takeProfit, decimals) : '—'}
            />
            <ConfirmRow label="仓位价值" value={formatCurrency(preview.positionValue)} />
            <ConfirmRow label="预计风险" value={formatCurrency(preview.estimatedRisk)} />
            <ConfirmRow
              label="风险收益比"
              value={preview.riskRewardRatio !== null ? `1 : ${preview.riskRewardRatio.toFixed(2)}` : '—'}
            />
          </dl>
          <p className="mt-3 text-[12px] text-text-muted">
            仅模拟下单，不涉及真实资金。
          </p>
        </div>
        <div className="flex gap-2 border-t border-bg-border px-4 py-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-sm border border-bg-border px-3 py-2 text-[14px] font-semibold text-text-secondary hover:bg-bg-hover"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className={`flex-1 rounded-sm px-3 py-2 text-[14px] font-bold text-white ${
              draft.direction === 'long' ? 'bg-up hover:bg-emerald-600' : 'bg-down hover:bg-red-600'
            }`}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-text-primary">{value}</dd>
    </div>
  );
}
