import type { ClosedTrade } from '../types/trading';
import { combinePerformance } from './tradingCalculations';
import type { TradeStats } from './tradingCalculations';

/** 一次回放的归档记录（有成交才建档），持久化在 localStorage。 */
export interface ReplaySessionRecord {
  id: string;
  symbol: string;
  timeframe: string;
  /** 本批开始时刻（开始回放时，ms） */
  startedAt: number;
  /** 封批时刻（ms） */
  endedAt: number;
  /** 回放起点 K 线时间（秒），可能为 null */
  replayStartTime: number | null;
  startingBalance: number;
  finalBalance: number;
  totalPnl: number;
  trades: ClosedTrade[];
  /** 自由备注（可选） */
  note?: string;
}

const STORAGE_KEY = 'replaytrade:sessions';
const MAX_SESSIONS = 200;

function safeParse(raw: string | null): ReplaySessionRecord[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter((r) => r && typeof r.id === 'string' && Array.isArray(r.trades));
  } catch {
    return [];
  }
}

export function loadSessions(): ReplaySessionRecord[] {
  try {
    return safeParse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function persist(sessions: ReplaySessionRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, MAX_SESSIONS)));
  } catch {
    /* 存储满等异常静默忽略，不影响当前会话 */
  }
}

/** 新增一批（新的在前），返回新列表。 */
export function addSession(rec: ReplaySessionRecord): ReplaySessionRecord[] {
  const next = [rec, ...loadSessions()].slice(0, MAX_SESSIONS);
  persist(next);
  return next;
}

export function deleteSession(id: string): ReplaySessionRecord[] {
  const next = loadSessions().filter((r) => r.id !== id);
  persist(next);
  return next;
}

export function clearSessions(): ReplaySessionRecord[] {
  persist([]);
  return [];
}

/** 更新某批的备注。 */
export function updateSessionNote(id: string, note: string): ReplaySessionRecord[] {
  const next = loadSessions().map((r) => (r.id === id ? { ...r, note: note.trim() || undefined } : r));
  persist(next);
  return next;
}

/** 列表行标题：`BTC/USDT · 5m · 08-01→11-18 · 12 笔 · +3.2R` */
export function sessionTitle(rec: ReplaySessionRecord): string {
  const first = rec.replayStartTime ?? rec.trades[0]?.openedAt ?? Math.floor(rec.endedAt / 1000);
  const last = rec.trades[rec.trades.length - 1]?.closedAt ?? first;
  const p = (n: number) => String(n).padStart(2, '0');
  const fmt = (t: number) => {
    const d = new Date(t * 1000);
    return `${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const totalR = rec.trades.reduce((s, t) => s + (t.rMultiple ?? 0), 0);
  return `${rec.symbol} · ${rec.timeframe} · ${fmt(first)}→${fmt(last)} · ${rec.trades.length} 笔 · ${
    totalR >= 0 ? '+' : ''
  }${totalR.toFixed(1)}R`;
}

/** 从成交序列离线重算本批统计（与统计面板同一套公式）。 */
export function computeSessionStats(rec: ReplaySessionRecord): {
  perf: TradeStats;
  equitySeries: number[];
  maxDrawdown: number;
} {
  const trades = [...rec.trades].sort((a, b) => a.closedAt - b.closedAt);
  let eq = rec.startingBalance;
  let peak = eq;
  let dd = 0;
  const equitySeries = [eq];
  for (const t of trades) {
    eq += t.pnl;
    equitySeries.push(eq);
    peak = Math.max(peak, eq);
    dd = Math.max(dd, peak > 0 ? ((peak - eq) / peak) * 100 : 0);
  }
  return { perf: combinePerformance(trades, dd), equitySeries, maxDrawdown: dd };
}

/** 导出一批成交为 CSV（UTF-8 BOM，Excel 直开不乱码）。 */
export function exportSessionCsv(rec: ReplaySessionRecord): void {
  const REASON: Record<string, string> = {
    manual: '手动',
    'stop-loss': '止损',
    'take-profit': '止盈',
    'replay-ended': '回放结束',
  };
  const header = ['序号', '代码', '方向', '数量', '开仓价', '开仓时间', '平仓价', '平仓时间', '盈亏', '收益率(%)', 'R', '平仓原因'];
  const p = (n: number) => String(n).padStart(2, '0');
  const fmt = (t: number) => {
    const d = new Date(t * 1000);
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };
  const rows = rec.trades.map((t, i) => [
    String(i + 1),
    t.symbol,
    t.direction === 'long' ? '多' : '空',
    String(t.quantity),
    String(t.entryPrice),
    fmt(t.openedAt),
    String(t.exitPrice),
    fmt(t.closedAt),
    t.pnl.toFixed(2),
    t.returnPct.toFixed(2),
    t.rMultiple !== null ? t.rMultiple.toFixed(2) : '',
    REASON[t.exitReason] ?? t.exitReason,
  ]);
  const csv =
    '\ufeff' +
    [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  const first = rec.replayStartTime ?? rec.trades[0]?.openedAt ?? Math.floor(rec.endedAt / 1000);
  const last = rec.trades[rec.trades.length - 1]?.closedAt ?? first;
  const fname = `replaytrade_${rec.symbol.replace('/', '')}_${rec.timeframe}_${fmt(first).slice(0, 10).replace(/-/g, '')}-${fmt(last).slice(0, 10).replace(/-/g, '')}.csv`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fname;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
