import type { Candle } from '../types/market';

/**
 * ZigZag（反转百分比法）：标记显著的高低位转折点，过滤小于 deviationPct% 的波动。
 * 返回折线顶点序列（时间升序），可直接喂给 LineSeries。
 */
export function zigzag(
  candles: Candle[],
  deviationPct: number,
): Array<{ time: number; value: number }> {
  const out: Array<{ time: number; value: number }> = [];
  if (candles.length < 2 || deviationPct <= 0) return out;

  const ratio = deviationPct / 100;
  let first = candles[0];
  let last = candles[candles.length - 1];
  if (!first || !last) return out;

  // 探测初始方向：从第一根起找先被确认的极值方向
  let trend: 1 | -1 = 1;
  let pivotHigh = { idx: 0, price: first.high };
  let pivotLow = { idx: 0, price: first.low };
  let started = false;
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    if (!c) break;
    if (c.high > pivotHigh.price) pivotHigh = { idx: i, price: c.high };
    if (c.low < pivotLow.price) pivotLow = { idx: i, price: c.low };
    if (pivotHigh.price >= pivotLow.price * (1 + ratio)) {
      // 低点先确立 → 上升趋势开始于低点
      trend = 1;
      out.push({ time: pivotLow.idx === 0 ? first.time : (candles[pivotLow.idx]?.time ?? first.time), value: pivotLow.price });
      pivotHigh = { idx: i, price: c.high };
      started = true;
      break;
    }
    if (pivotLow.price <= pivotHigh.price * (1 - ratio)) {
      // 高点先确立 → 下降趋势开始于高点
      trend = -1;
      out.push({ time: pivotHigh.idx === 0 ? first.time : (candles[pivotHigh.idx]?.time ?? first.time), value: pivotHigh.price });
      pivotLow = { idx: i, price: c.low };
      started = true;
      break;
    }
  }
  if (!started) return out;

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    if (!c) continue;
    if (trend === 1) {
      if (c.high >= pivotHigh.price) {
        pivotHigh = { idx: i, price: c.high };
      } else if (c.low <= pivotHigh.price * (1 - ratio)) {
        const pc = candles[pivotHigh.idx];
        if (pc) out.push({ time: pc.time, value: pivotHigh.price });
        trend = -1;
        pivotLow = { idx: i, price: c.low };
      }
    } else {
      if (c.low <= pivotLow.price) {
        pivotLow = { idx: i, price: c.low };
      } else if (c.high >= pivotLow.price * (1 + ratio)) {
        const pc = candles[pivotLow.idx];
        if (pc) out.push({ time: pc.time, value: pivotLow.price });
        trend = 1;
        pivotHigh = { idx: i, price: c.high };
      }
    }
  }
  // 尾部未确认的候选 pivot 一并画出（虚线感的实时段）
  const lastC = candles[candles.length - 1];
  if (lastC) {
    if (trend === 1 && pivotHigh.idx > 0) {
      const pc = candles[pivotHigh.idx];
      if (pc) out.push({ time: pc.time, value: pivotHigh.price });
    } else if (trend === -1 && pivotLow.idx > 0) {
      const pc = candles[pivotLow.idx];
      if (pc) out.push({ time: pc.time, value: pivotLow.price });
    }
  }
  return out.sort((a, b) => a.time - b.time);
}
