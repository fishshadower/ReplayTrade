/** 指标实例模型 + 类型注册表（TradingView 式：可添加/删除/多实例/调参/换色）。 */

export type IndicatorType = 'sma' | 'ema' | 'zigzag' | 'volume';

export interface IndicatorInstance {
  id: string;
  type: IndicatorType;
  params: Record<string, number>;
  color: string;
  visible: boolean;
}

export interface ParamDef {
  key: string;
  label: string;
  min: number;
  max: number;
}

export interface IndicatorTypeDef {
  type: IndicatorType;
  /** 显示名（不含参数） */
  name: string;
  defaultParams: Record<string, number>;
  paramDefs: ParamDef[];
  defaultColor: string;
  /** 多实例时依次轮换的颜色 */
  palette: string[];
  /** 最大实例数（volume 独占） */
  max?: number;
  /** 实例行是否显示数值 */
  showValue: boolean;
}

export const INDICATOR_REGISTRY: IndicatorTypeDef[] = [
  {
    type: 'sma',
    name: 'SMA',
    defaultParams: { period: 20 },
    paramDefs: [{ key: 'period', label: '周期', min: 2, max: 500 }],
    defaultColor: '#4f8cff',
    palette: ['#4f8cff', '#22d3ee', '#f97316', '#ec4899'],
    showValue: true,
  },
  {
    type: 'ema',
    name: 'EMA',
    defaultParams: { period: 50 },
    paramDefs: [{ key: 'period', label: '周期', min: 2, max: 500 }],
    defaultColor: '#eab308',
    palette: ['#eab308', '#a3e635', '#f43f5e', '#8b5cf6'],
    showValue: true,
  },
  {
    type: 'zigzag',
    name: 'ZigZag',
    defaultParams: { deviationPct: 5 },
    paramDefs: [{ key: 'deviationPct', label: '回撤%', min: 1, max: 50 }],
    defaultColor: '#a855f7',
    palette: ['#a855f7', '#14b8a6', '#e879f9', '#fb923c'],
    showValue: false,
  },
  {
    type: 'volume',
    name: '成交量',
    defaultParams: {},
    paramDefs: [],
    defaultColor: '#9aa6bd',
    palette: ['#9aa6bd'],
    max: 1,
    showValue: false,
  },
];

export function defOf(type: IndicatorType): IndicatorTypeDef {
  const def = INDICATOR_REGISTRY.find((d) => d.type === type);
  if (!def) throw new Error(`unknown indicator type: ${type}`);
  return def;
}

/** 实例标签：SMA(20) / ZigZag(5%) */
export function instanceLabel(inst: IndicatorInstance): string {
  const def = defOf(inst.type);
  if (inst.type === 'volume') return def.name;
  if (inst.type === 'zigzag') return `ZigZag(${inst.params.deviationPct ?? 5}%)`;
  return `${def.name}(${inst.params.period ?? 20})`;
}

const STORAGE_KEY = 'replaytrade:indicator_instances';
const LEGACY_KEY = 'replaytrade:indicators';

let seq = 0;
function nextId(type: IndicatorType): string {
  seq += 1;
  return `${type}-${Date.now()}-${seq}`;
}

/** 多实例轮换取色。 */
function pickColor(type: IndicatorType, existing: IndicatorInstance[]): string {
  const def = defOf(type);
  const count = existing.filter((i) => i.type === type).length;
  return def.palette[count % def.palette.length] ?? def.defaultColor;
}

export function createInstance(type: IndicatorType, existing: IndicatorInstance[]): IndicatorInstance {
  const def = defOf(type);
  return {
    id: nextId(type),
    type,
    params: { ...def.defaultParams },
    color: pickColor(type, existing),
    visible: true,
  };
}

/** 老的固定槽位配置 → 实例列表（一次性迁移）。 */
function migrateLegacy(): IndicatorInstance[] | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as {
      sma?: { visible: boolean; period: number };
      ema?: { visible: boolean; period: number };
      volume?: { visible: boolean };
      zigzag?: { visible: boolean; deviationPct: number };
    };
    const list: IndicatorInstance[] = [];
    if (v.sma) list.push({ id: nextId('sma'), type: 'sma', params: { period: v.sma.period }, color: '#4f8cff', visible: v.sma.visible });
    if (v.ema) list.push({ id: nextId('ema'), type: 'ema', params: { period: v.ema.period }, color: '#eab308', visible: v.ema.visible });
    if (v.zigzag) list.push({ id: nextId('zigzag'), type: 'zigzag', params: { deviationPct: v.zigzag.deviationPct }, color: '#a855f7', visible: v.zigzag.visible });
    if (v.volume) list.push({ id: nextId('volume'), type: 'volume', params: {}, color: '#9aa6bd', visible: v.volume.visible });
    else list.push({ id: nextId('volume'), type: 'volume', params: {}, color: '#9aa6bd', visible: true });
    localStorage.removeItem(LEGACY_KEY);
    return list;
  } catch {
    return null;
  }
}

export function loadIndicatorInstances(): IndicatorInstance[] {
  const legacy = migrateLegacy();
  if (legacy) {
    saveIndicatorInstances(legacy);
    return legacy;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [createInstance('sma', []), createInstance('ema', [{} as IndicatorInstance]), { ...createInstance('volume', []) }];
  } catch {
    /* fallthrough */
  }
  return [createInstance('sma', []), createInstance('ema', [{} as IndicatorInstance]), { ...createInstance('volume', []) }];
}

export function saveIndicatorInstances(list: IndicatorInstance[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}
