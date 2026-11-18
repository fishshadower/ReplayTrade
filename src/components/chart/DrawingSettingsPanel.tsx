import { BringToFront, Copy, Eye, EyeOff, GripVertical, Layers, Lock, LockOpen, SendToBack, Trash2, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { PALETTE, STYLE_PRESETS, TOOL_LABELS } from '../../drawing';
import type { Drawing, DrawingStyle, PresetId } from '../../drawing';
import { formatPrice } from '../../utils/tradingCalculations';
import { formatISODateTime } from '../../utils/candleUtils';

const FILLABLE_TYPES = new Set(['rectangle', 'circle', 'ellipse', 'triangle', 'polygon', 'longPosition', 'shortPosition', 'riskReward']);

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  'h-7 w-full rounded-sm border border-bg-border bg-bg-elevated px-2 text-[13px] text-text-primary outline-none focus:border-accent';

function ActionBtn({
  title,
  danger = false,
  disabled,
  onClick,
  className = '',
  children,
}: {
  title: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 items-center justify-center gap-1 rounded-sm border px-2 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${className} ${
        danger
          ? 'border-down/60 bg-down-dim text-down hover:bg-down hover:text-white'
          : 'border-bg-border bg-bg-elevated text-text-secondary hover:bg-bg-hover hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

export interface DrawingSettingsPanelProps {
  drawing: Drawing;
  decimals: number;
  onUpdateStyle: (partial: Partial<DrawingStyle>) => void;
  onApplyPreset: (p: PresetId) => void;
  onSetText: (text: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onLock: () => void;
  onHide: () => void;
  onLayer: (dir: 'front' | 'back' | 'forward' | 'backward') => void;
  onClose: () => void;
}

export function DrawingSettingsPanel({
  drawing,
  decimals,
  onUpdateStyle,
  onApplyPreset,
  onSetText,
  onDuplicate,
  onDelete,
  onLock,
  onHide,
  onLayer,
  onClose,
}: DrawingSettingsPanelProps) {
  const s = drawing.style;
  const isText = drawing.type === 'text';
  const isFillable = FILLABLE_TYPES.has(drawing.type);
  const anchor = drawing.points[0];

  // 可拖动浮窗：标题栏按住拖到任意位置
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null);
  const onTitlePointerDown = (e: React.PointerEvent<HTMLButtonElement>): void => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffsetRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setPos((p) => p ?? { x: rect.left, y: rect.top });
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
  };
  const onTitlePointerMove = (e: React.PointerEvent<HTMLButtonElement>): void => {
    const off = dragOffsetRef.current;
    if (!off) return;
    setPos({ x: Math.max(0, e.clientX - off.dx), y: Math.max(0, e.clientY - off.dy) });
  };
  const onTitlePointerUp = (): void => {
    dragOffsetRef.current = null;
  };

  return (
    <div
      ref={rootRef}
      className="flex w-56 flex-col gap-2.5 rounded-md border border-bg-border bg-bg-panel/95 p-3 shadow-neo backdrop-blur-sm"
      style={pos ? { position: 'fixed', left: pos.x, top: pos.y, zIndex: 45 } : undefined}
      onPointerDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={`${TOOL_LABELS[drawing.type]} 设置`}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-0.5 text-[13px] font-bold uppercase tracking-wider text-text-primary">
          <button
            type="button"
            title="按住拖动面板"
            aria-label="拖动面板"
            onPointerDown={onTitlePointerDown}
            onPointerMove={onTitlePointerMove}
            onPointerUp={onTitlePointerUp}
            className="flex h-6 w-4 shrink-0 cursor-move items-center justify-center text-text-muted hover:text-text-primary"
          >
            <GripVertical size={12} />
          </button>
          {TOOL_LABELS[drawing.type]}
        </span>
        <button type="button" onClick={onClose} aria-label="关闭设置" className="text-text-muted hover:text-text-primary">
          <X size={14} />
        </button>
      </div>

      {/* Style presets */}
      <div className="flex flex-wrap gap-1">
        {(Object.keys(STYLE_PRESETS) as PresetId[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onApplyPreset(p)}
            title={`预设: ${p}`}
            aria-label={`应用 ${p} 预设`}
            className="flex h-5 items-center rounded-sm border border-bg-border bg-bg-elevated px-1.5 text-[11px] uppercase tracking-wide text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary"
            style={{ borderLeftWidth: 3, borderLeftColor: STYLE_PRESETS[p].strokeColor }}
          >
            {p}
          </button>
        ))}
      </div>

      {isText && (
        <Field label="文本">
          <textarea
            value={drawing.text ?? ''}
            onChange={(e) => onSetText(e.target.value)}
            rows={2}
            className={`${inputCls} h-auto py-1`}
            placeholder="输入标注文字…"
          />
        </Field>
      )}

      {/* Colors */}
      <Field label="颜色">
        <div className="flex items-center gap-1">
          {PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              aria-label={`颜色 ${c}`}
              onClick={() => onUpdateStyle({ strokeColor: c, fillColor: c })}
              className="h-5 w-5 rounded-sm border border-black/40 transition-transform hover:scale-110"
              style={{
                backgroundColor: c,
                boxShadow:
                  s.strokeColor === c ? '0 0 0 2px rgba(255,255,255,0.85), 0 0 0 4px rgba(0,0,0,0.4)' : undefined,
              }}
            />
          ))}
          <input
            type="color"
            title="自定义颜色"
            aria-label="自定义颜色"
            value={s.strokeColor}
            onChange={(e) => onUpdateStyle({ strokeColor: e.target.value, fillColor: e.target.value })}
            className="h-5 w-6 cursor-pointer rounded-sm border border-bg-border bg-transparent p-0"
          />
        </div>
      </Field>

      {!isText && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="线宽">
              <NumberField
                value={s.strokeWidth}
                min={1}
                max={10}
                step={0.5}
                ariaLabel="线宽"
                onCommit={(v) => onUpdateStyle({ strokeWidth: v })}
              />
            </Field>
            <Field label="线型">
              <select
                value={s.strokeStyle}
                onChange={(e) => onUpdateStyle({ strokeStyle: e.target.value as DrawingStyle['strokeStyle'] })}
                className={inputCls}
              >
                <option value="solid">实线</option>
                <option value="dashed">虚线</option>
                <option value="dotted">点线</option>
              </select>
            </Field>
          </div>
          {isFillable && (
            <Field label={`填充不透明度 — ${Math.round(s.fillOpacity * 100)}%`}>
              <input
                type="range"
                min={0}
                max={50}
                step={1}
                value={Math.round(s.fillOpacity * 100)}
                onChange={(e) => onUpdateStyle({ fillOpacity: Number(e.target.value) / 100 })}
                className="h-2 w-full accent-[#4f8cff]"
              />
            </Field>
          )}
        </>
      )}

      {isText && (
        <Field label="字号">
          <NumberField
            value={s.fontSize}
            min={10}
            max={60}
            ariaLabel="字号"
            onCommit={(v) => onUpdateStyle({ fontSize: v })}
          />
        </Field>
      )}

      {/* Coordinates */}
      {anchor && (
        <div className="rounded-sm border border-bg-border bg-bg-elevated px-2 py-1.5 font-mono text-[12px] text-text-secondary">
          <div className="flex justify-between">
            <span className="text-text-muted">价格</span>
            <span className="text-text-primary">{formatPrice(anchor.price, decimals)}</span>
          </div>
          <div className="mt-0.5 flex justify-between">
            <span className="text-text-muted">时间</span>
            <span className="text-text-primary">{formatISODateTime(anchor.time)}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-1.5">
        <ActionBtn title="复制图形" onClick={onDuplicate}>
          <Copy size={12} /> 复制
        </ActionBtn>
        <ActionBtn title={drawing.locked ? '解锁图形' : '锁定图形'} onClick={onLock}>
          {drawing.locked ? <LockOpen size={12} /> : <Lock size={12} />} {drawing.locked ? '解锁' : '锁定'}
        </ActionBtn>
        <ActionBtn title={drawing.visible ? '隐藏图形' : '显示图形'} onClick={onHide}>
          {drawing.visible ? <EyeOff size={12} /> : <Eye size={12} />} {drawing.visible ? '隐藏' : '显示'}
        </ActionBtn>
        <ActionBtn title="移到最前" onClick={() => onLayer('front')}>
          <BringToFront size={12} /> 最前
        </ActionBtn>
        <ActionBtn title="移到最后" onClick={() => onLayer('back')}>
          <SendToBack size={12} /> 最后
        </ActionBtn>
        <ActionBtn title="上移 / 下移一层" onClick={() => onLayer('forward')}>
          <Layers size={12} /> 层级
        </ActionBtn>
        <ActionBtn title="删除图形" danger onClick={onDelete} className="col-span-2">
          <Trash2 size={12} /> 删除
        </ActionBtn>
      </div>
    </div>
  );
}


/** 数字输入：打字过程为草稿不钳制，回车/失焦才提交（避免中间态被 clamp 跳值）。 */
function NumberField({
  value,
  min,
  max,
  step,
  ariaLabel,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  ariaLabel: string;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      value={focused ? draft : String(value)}
      onFocus={() => {
        setFocused(true);
        setDraft(String(value));
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setFocused(false);
        const n = Number(draft);
        if (Number.isFinite(n) && n > 0) onCommit(Math.max(min, Math.min(max, n)));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={inputCls}
    />
  );
}
