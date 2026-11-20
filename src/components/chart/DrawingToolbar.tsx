import {
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  Circle as CircleIcon,
  Eraser,
  GripVertical,
  Hexagon,
  Magnet,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Pencil,
  PenTool,
  Percent,
  Redo2,
  Ruler,
  Scale,
  SeparatorVertical,
  Slash,
  Square,
  Triangle,
  Trash2,
  TrendingUp,
  Type,
  Undo2,
  Spline,
} from 'lucide-react';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { MagnetMode, ToolId } from '../../drawing';

interface ToolbarItem {
  id: ToolId;
  icon: ReactNode;
  label: string;
  shortcut?: string;
}

interface ToolbarGroup {
  id: string;
  label: string;
  icon: ReactNode;
  items: ToolbarItem[];
}

const GROUPS: ToolbarGroup[] = [
  {
    id: 'lines',
    label: '线条工具',
    icon: <Slash size={16} />,
    items: [
      { id: 'trendLine', icon: <Slash size={16} />, label: '趋势线', shortcut: 'T' },
      { id: 'ray', icon: <TrendingUp size={16} />, label: '射线' },
      { id: 'extendedLine', icon: <ArrowRightLeft size={16} />, label: '延长线' },
      { id: 'horizontalLine', icon: <Minus size={16} />, label: '水平线', shortcut: 'H' },
      { id: 'verticalLine', icon: <SeparatorVertical size={16} />, label: '垂直线', shortcut: 'L' },
    ],
  },
  {
    id: 'shapes',
    label: '形状工具',
    icon: <Square size={16} />,
    items: [
      { id: 'rectangle', icon: <Square size={16} />, label: '矩形', shortcut: 'R' },
      { id: 'circle', icon: <CircleIcon size={16} />, label: '圆' },
      { id: 'ellipse', icon: <CircleIcon size={16} className="scale-y-75" />, label: '椭圆' },
      { id: 'triangle', icon: <Triangle size={16} />, label: '三角形' },
      { id: 'polygon', icon: <Hexagon size={16} />, label: '多边形' },
      { id: 'path', icon: <Pencil size={16} />, label: '自由画笔', shortcut: 'P' },
    ],
  },
  {
    id: 'annotations',
    label: '标注工具',
    icon: <PenTool size={16} />,
    items: [
      { id: 'arrow', icon: <ArrowUpRight size={16} />, label: '箭头', shortcut: 'A' },
      { id: 'pathArrow', icon: <Spline size={16} />, label: '箭头折线', shortcut: 'W' },
      { id: 'text', icon: <Type size={16} />, label: '文本', shortcut: 'X' },
      { id: 'fibRetracement', icon: <Percent size={16} />, label: '斐波那契回撤' },
    ],
  },
  {
    id: 'positions',
    label: '仓位工具',
    icon: <Scale size={16} />,
    items: [
      { id: 'longPosition', icon: <ArrowUpRight size={16} />, label: '多头仓位' },
      { id: 'shortPosition', icon: <ArrowDownRight size={16} />, label: '空头仓位' },
      { id: 'riskReward', icon: <Scale size={16} />, label: '风险 / 收益比' },
      { id: 'measure', icon: <Ruler size={16} />, label: '测量' },
    ],
  },
];

const CURSOR_ITEM: ToolbarItem = {
  id: 'select',
  icon: <MousePointer2 size={16} />,
  label: '选择 / 移动',
  shortcut: 'V',
};

const MAGNET_LABEL: Record<MagnetMode, string> = {
  off: '磁吸: 关',
  weak: '磁吸: 弱',
  strong: '磁吸: 强',
};

export interface DrawingToolbarProps {
  tool: ToolId;
  onToolChange: (t: ToolId) => void;
  magnetMode: MagnetMode;
  onMagnetChange: (m: MagnetMode) => void;
  canUndo: boolean;
  canRedo: boolean;
  hasDrawings: boolean;
  hasSelection: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onClear: () => void;
}

function IconBtn({
  title,
  active = false,
  danger = false,
  disabled = false,
  badge,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  badge?: ReactNode;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent md:h-8 md:w-8 ${
        active
          ? 'bg-accent/25 text-accent'
          : danger
            ? disabled
              ? 'cursor-not-allowed text-text-muted/40'
              : 'text-text-secondary hover:bg-down-dim hover:text-down'
            : disabled
              ? 'cursor-not-allowed text-text-muted/40'
              : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
      }`}
    >
      {active && <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-accent" />}
      {children}
      {badge && <span className="absolute right-1 bottom-1 h-1.5 w-1.5 rounded-full bg-accent" />}
    </button>
  );
}

export function DrawingToolbar({
  tool,
  onToolChange,
  magnetMode,
  onMagnetChange,
  canUndo,
  canRedo,
  hasDrawings,
  hasSelection,
  onUndo,
  onRedo,
  onDelete,
  onClear,
}: DrawingToolbarProps) {
  const nextMagnet: MagnetMode =
    magnetMode === 'off' ? 'weak' : magnetMode === 'weak' ? 'strong' : 'off';
  // 常用工具直出；其余收进「更多」
  const TOOL_MAP = new Map<ToolbarItem['id'], ToolbarItem>();
  TOOL_MAP.set(CURSOR_ITEM.id, CURSOR_ITEM);
  for (const g of GROUPS) {
    for (const item of g.items) TOOL_MAP.set(item.id, item);
  }
  const PRIMARY: ToolbarItem['id'][] = [
    'select',
    'rectangle',
    'pathArrow',
    'trendLine',
    'horizontalLine',
    'longPosition',
    'shortPosition',
    'path',
    'measure',
  ];
  const SECONDARY = [...TOOL_MAP.values()].filter((t) => !PRIMARY.includes(t.id));

  // 横条可拖动：把手按住拖到任意位置
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const dragOffsetRef = useRef<{ dx: number; dy: number } | null>(null);
  const onHandlePointerDown = (e: React.PointerEvent<HTMLButtonElement>): void => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragOffsetRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setPos((p) => p ?? { x: rect.left, y: rect.top });
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
  };
  const onHandlePointerMove = (e: React.PointerEvent<HTMLButtonElement>): void => {
    const off = dragOffsetRef.current;
    if (!off) return;
    setPos({ x: Math.max(0, e.clientX - off.dx), y: Math.max(0, e.clientY - off.dy) });
  };
  const onHandlePointerUp = (): void => {
    dragOffsetRef.current = null;
  };

  return (
    <div
      ref={rootRef}
      className="flex max-w-[calc(100vw-16px)] flex-row flex-wrap items-center gap-0.5 rounded-md border border-bg-border bg-bg-panel/95 p-1 shadow-neo backdrop-blur-sm"
      style={pos ? { position: 'fixed', left: pos.x, top: pos.y, zIndex: 60 } : undefined}
      onPointerDown={(e) => e.stopPropagation()}
      role="toolbar"
      aria-label="绘图工具"
    >
      <button
        type="button"
        title="按住拖动工具栏"
        aria-label="拖动工具栏"
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        className="flex h-7 w-4 shrink-0 cursor-move items-center justify-center text-text-muted hover:text-text-primary"
      >
        <GripVertical size={12} />
      </button>

      {PRIMARY.map((id) => {
        const item = TOOL_MAP.get(id);
        if (!item) return null;
        return (
          <IconBtn
            key={item.id}
            title={item.shortcut ? `${item.label} (${item.shortcut})` : item.label}
            active={tool === item.id}
            onClick={() => onToolChange(item.id)}
          >
            {item.icon}
          </IconBtn>
        );
      })}

      <MoreMenu items={SECONDARY} activeTool={tool} onPick={onToolChange} />

      <span className="mx-1 h-5 w-px bg-bg-border" />

      <IconBtn
        title={hasSelection ? '删除选中图形 (Del)' : '删除选中图形'}
        danger
        disabled={!hasSelection}
        onClick={onDelete}
      >
        <Eraser size={16} />
      </IconBtn>
      <IconBtn title="撤销 (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
        <Undo2 size={16} />
      </IconBtn>
      <IconBtn title="重做 (Ctrl+Shift+Z)" disabled={!canRedo} onClick={onRedo}>
        <Redo2 size={16} />
      </IconBtn>
      <IconBtn title="清空全部图形" danger disabled={!hasDrawings} onClick={onClear}>
        <Trash2 size={16} />
      </IconBtn>
      <IconBtn title={`${MAGNET_LABEL[magnetMode]} — 点击切换`} active={magnetMode !== 'off'} onClick={() => onMagnetChange(nextMagnet)}>
        <Magnet size={16} />
      </IconBtn>
    </div>
  );
}


function MoreMenu({
  items,
  activeTool,
  onPick,
}: {
  items: ToolbarItem[];
  activeTool: ToolId;
  onPick: (t: ToolId) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = items.some((i) => i.id === activeTool);
  return (
    <div className="relative" onPointerDown={(e) => e.stopPropagation()}>
      <IconBtn title="更多工具" active={active} onClick={() => setOpen((o) => !o)}>
        <MoreHorizontal size={16} />
      </IconBtn>
      {open && (
        <>
          <button
            type="button"
            aria-label="关闭更多工具"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            aria-label="更多工具"
            className="absolute left-0 top-full z-40 mt-1 flex flex-col rounded-md border border-bg-border bg-bg-panel p-1 shadow-neo"
          >
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  onPick(item.id);
                  setOpen(false);
                }}
                className={`flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] transition-colors ${
                  activeTool === item.id
                    ? 'bg-accent/25 text-accent'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span className="whitespace-nowrap">{item.label}</span>
                {item.shortcut && (
                  <span className="ml-auto rounded-sm border border-bg-border px-1 font-mono text-[11px] text-text-muted">
                    {item.shortcut}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
