/** 指标配置（第二层地基：指标 = 有名字、参数、显隐的可配置对象）。 */

export interface IndicatorConfigs {
  sma: { visible: boolean; period: number };
  ema: { visible: boolean; period: number };
  volume: { visible: boolean };
  zigzag: { visible: boolean; deviationPct: number };
}

const STORAGE_KEY = 'replaytrade:indicators';

export const DEFAULT_INDICATORS: IndicatorConfigs = {
  sma: { visible: true, period: 20 },
  ema: { visible: true, period: 50 },
  volume: { visible: true },
  zigzag: { visible: false, deviationPct: 5 },
};

export function loadIndicatorConfigs(): IndicatorConfigs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_INDICATORS };
    const v = JSON.parse(raw) as Partial<IndicatorConfigs>;
    return {
      sma: { ...DEFAULT_INDICATORS.sma, ...v.sma },
      ema: { ...DEFAULT_INDICATORS.ema, ...v.ema },
      volume: { ...DEFAULT_INDICATORS.volume, ...v.volume },
      zigzag: { ...DEFAULT_INDICATORS.zigzag, ...v.zigzag },
    };
  } catch {
    return { ...DEFAULT_INDICATORS };
  }
}

export function saveIndicatorConfigs(c: IndicatorConfigs): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

/**
 * 注册表约定（新指标照此扩展）：
 * 1. 计算函数放 src/indicators/<name>.ts，纯函数 (candles, params) => LineData[]
 * 2. IndicatorConfigs 加一项 { visible, ...params }（含默认值与 load/save 合并）
 * 3. TradingChart 建 series + 在数据 effect 喂数据 + 指标行 UI 加一行
 * 未来抽成声明式注册表时，这三步收敛为一个声明。
 */
