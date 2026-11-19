import type { Candle } from '../types/market';

/**
 * ZigZag（反转百分比法）：标记显著的高低位转折点，过滤小于 deviationPct% 的波动。
 * 标准流式实现：从第一根起双向跟踪极值，方向未确认前（trend=0）双向检测，
 * 任何长度的数据都有输出（尾部/头部未确认段也会画出），回放小窗口同样可见。
 */
export function zigzag(
  candles: Candle[],
  deviationPct: number,
): Array<{ time: number; value: number }> {
  const out: Array<{ time: number; value: number }> = [];
  if (candles.length === 0 || deviationPct <= 0) return out;

  const ratio = deviationPct / 100;
  const first = candles[0];
  if (!first) return out;

  let trend: 0 | 1 | -1 = 0;
  let hi = { idx: 0, price: first.high };
  let lo = { idx: 0, price: first.low };

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (!c) continue;
    if (trend >= 0 && c.high >= hi.price) hi = { idx: i, price: c.high };
    if (trend <= 0 && c.low <= lo.price) lo = { idx: i, price: c.low };
    if (trend >= 0 && c.low <= hi.price * (1 - ratio)) {
      // 上升中的高点被回撤确认
      const pc = candles[hi.idx];
      if (pc) out.push({ time: pc.time, value: hi.price });
      trend = -1;
      lo = { idx: i, price: c.low };
    } else if (trend <= 0 && c.high >= lo.price * (1 + ratio)) {
      // 下降中的低点被反弹确认
      const pc = candles[lo.idx];
      if (pc) out.push({ time: pc.time, value: lo.price });
      trend = 1;
      hi = { idx: i, price: c.high };
    }
  }

  // 尾部未确认的候选 pivot：一并画出（实时延伸段）
  if (trend === 1) {
    const pc = candles[hi.idx];
    if (pc && hi.idx > 0) out.push({ time: pc.time, value: hi.price });
  } else if (trend === -1) {
    const pc = candles[lo.idx];
    if (pc && lo.idx > 0) out.push({ time: pc.time, value: lo.price });
  } else if (hi.idx !== lo.idx) {
    // 数据从未达到阈值：至少把极值段连出来，保证可见（极小波动窗口的降级显示）
    const ph = candles[hi.idx];
    const pl = candles[lo.idx];
    if (ph && pl) {
      if (hi.idx < lo.idx) {
        out.push({ time: ph.time, value: hi.price }, { time: pl.time, value: lo.price });
      } else {
        out.push({ time: pl.time, value: lo.price }, { time: ph.time, value: hi.price });
      }
    }
  }

  // 严格升序去重：lightweight-charts 的 setData 不允许重复时间戳（会抛异常导致白屏）
  const sorted = out.sort((a, b) => a.time - b.time);
  const dedup: Array<{ time: number; value: number }> = [];
  for (const p of sorted) {
    const last = dedup[dedup.length - 1];
    if (!last || p.time > last.time) dedup.push(p);
  }
  return dedup;
}
