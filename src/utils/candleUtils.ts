import type { Candle } from '../types/market';

/** Remove duplicate timestamps, sort ascending, drop invalid candles. */
export function normalizeCandles(candles: Candle[]): Candle[] {
  const seen = new Set<number>();
  const out: Candle[] = [];
  for (const c of [...candles].sort((a, b) => a.time - b.time)) {
    if (seen.has(c.time)) continue;
    seen.add(c.time);
    if (Number.isFinite(c.time) && c.open > 0 && c.high >= c.low) out.push(c);
  }
  return out;
}

/** Binary search for the index of the candle closest to the given timestamp. */
export function nearestIndexByTime(candles: Candle[], time: number): number {
  if (candles.length === 0) return -1;
  const first = candles[0];
  const last = candles[candles.length - 1];
  if (!first || !last) return -1;
  if (time <= first.time) return 0;
  if (time >= last.time) return candles.length - 1;
  let lo = 0;
  let hi = candles.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const c = candles[mid];
    if (!c) return lo;
    if (c.time < time) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  const left = lo > 0 ? candles[lo - 1] : candles[lo];
  const right = candles[lo];
  if (!left || !right) return lo;
  return Math.abs(time - left.time) <= Math.abs(right.time - time) ? Math.max(0, lo - 1) : lo;
}

const WEEKDAY_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** `2026-11-09 22:12` */
export function formatISODateTime(time: number): string {
  const d = new Date(time * 1000);
  const ymd = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return `${ymd} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** `周三 2026-11-09 22:12`（日线周期不带时分） */
export function formatCandleDate(time: number, timeframe: string): string {
  const d = new Date(time * 1000);
  const ymd = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  if (timeframe === '1d') {
    return `${WEEKDAY_LABELS[d.getDay()]} ${ymd}`;
  }
  return `${WEEKDAY_LABELS[d.getDay()]} ${ymd} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** `2026-11-09` */
export function formatShortDate(time: number): string {
  const d = new Date(time * 1000);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
