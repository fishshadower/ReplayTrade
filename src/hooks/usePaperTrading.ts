import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Candle } from '../types/market';
import type { ClosedTrade, OrderDraft, Position, TradingState } from '../types/trading';
import type { ReplaySessionRecord } from '../utils/sessionStore';
import {
  availableBalance,
  closePosition,
  equity,
  positionPnl,
  processCandle,
  validateOrder,
} from '../utils/tradingCalculations';

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

let sessionSeq = 0;

function freshState(startingBalance: number): TradingState {
  return {
    startingBalance,
    balance: startingBalance,
    realizedPnl: 0,
    positions: [],
    history: [],
    peakEquity: startingBalance,
    maxDrawdown: 0,
  };
}

export const DEFAULT_BALANCE = 10_000;
export const BALANCE_PRESETS = [1_000, 5_000, 10_000, 50_000];

/**
 * Local paper-trading simulator. All money is simulated; nothing leaves the
 * browser and no real trades are ever placed.
 *
 * The source of truth is a mutable ref so sequential candle processing
 * (e.g. skipping several candles at once) evaluates SL/TP correctly in order.
 */
export function usePaperTrading(symbol: string) {
  const [state, setState] = useState<TradingState>(() => freshState(DEFAULT_BALANCE));
  const [currentPrice, setCurrentPrice] = useState<number>(0);

  const storeRef = useRef<TradingState>(state);
  const priceRef = useRef<number>(0);
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;
  const archivedRef = useRef(false);
  const startedAtRef = useRef<number>(Date.now());

  const sync = useCallback(() => {
    setState({ ...storeRef.current });
  }, []);

  const commitEquityWatermark = useCallback(
    (price: number) => {
      const st = storeRef.current;
      const eq = equity(st, price);
      const peak = Math.max(st.peakEquity, eq);
      const dd = peak > 0 ? ((peak - eq) / peak) * 100 : 0;
      if (peak !== st.peakEquity || dd > st.maxDrawdown) {
        storeRef.current = { ...st, peakEquity: peak, maxDrawdown: Math.max(st.maxDrawdown, dd) };
        sync();
      }
    },
    [sync],
  );

  const startSession = useCallback(
    (startingBalance: number) => {
      storeRef.current = freshState(startingBalance);
      priceRef.current = 0;
      archivedRef.current = false;
      startedAtRef.current = Date.now();
      setCurrentPrice(0);
      sync();
    },
    [sync],
  );

  /**
   * 归档当前会话为一批回放记录（有成交且未归档过才产生）。
   * 在开始新回放 / 回放完成 / 退出回放时调用；同批只归档一次。
   */
  const archiveSession = useCallback(
    (meta: { symbol: string; timeframe: string; replayStartTime: number | null }): ReplaySessionRecord | null => {
      const st = storeRef.current;
      if (archivedRef.current || st.history.length === 0) return null;
      archivedRef.current = true;
      sessionSeq += 1;
      const totalPnl = st.history.reduce((s, t) => s + t.pnl, 0);
      return {
        id: `session-${Date.now()}-${sessionSeq}`,
        symbol: meta.symbol,
        timeframe: meta.timeframe,
        startedAt: startedAtRef.current,
        endedAt: Date.now(),
        replayStartTime: meta.replayStartTime,
        startingBalance: st.startingBalance,
        finalBalance: st.balance,
        totalPnl,
        trades: st.history,
      };
    },
    [],
  );

  const openPosition = useCallback(
    (draft: OrderDraft, openedAt?: number): { ok: boolean; errors: string[]; position?: Position } => {
      const st = storeRef.current;
      const validation = validateOrder(draft, availableBalance(st));
      if (!validation.valid) return { ok: false, errors: validation.errors };

      const position: Position = {
        id: nextId('pos'),
        symbol: symbolRef.current,
        direction: draft.direction,
        entryPrice: draft.entryPrice,
        quantity: draft.quantity,
        stopLoss: draft.stopLoss ?? null,
        takeProfit: draft.takeProfit ?? null,
        openedAt: openedAt ?? Math.floor(Date.now() / 1000),
        remaining: draft.quantity,
      };

      storeRef.current = { ...storeRef.current, positions: [...storeRef.current.positions, position] };
      sync();
      return { ok: true, errors: [], position };
    },
    [sync],
  );

  const applyClose = useCallback(
    (trade: ClosedTrade, nextPositions?: Position[]) => {
      const st = storeRef.current;
      const balance = st.balance + trade.pnl;
      const positions = nextPositions ?? st.positions.filter((p) => p.id !== trade.id.split('-c-')[0]);
      storeRef.current = {
        ...st,
        balance,
        realizedPnl: balance - st.startingBalance,
        positions,
        history: [...st.history, { ...trade, balanceAfter: balance }],
      };
      commitEquityWatermark(priceRef.current);
      sync();
    },
    [commitEquityWatermark, sync],
  );

  const closePositionById = useCallback(
    (id: string, closedAt?: number): ClosedTrade | null => {
      const st = storeRef.current;
      const price = priceRef.current;
      const pos = st.positions.find((p) => p.id === id);
      if (!pos || price <= 0) return null;
      const trade = closePosition(pos, price, 'manual', closedAt ?? Math.floor(Date.now() / 1000));
      applyClose(trade);
      return trade;
    },
    [applyClose],
  );

  const closeHalf = useCallback(
    (id: string, closedAt?: number): ClosedTrade | null => {
      const st = storeRef.current;
      const price = priceRef.current;
      const pos = st.positions.find((p) => p.id === id);
      if (!pos || price <= 0 || pos.remaining <= 0) return null;

      const closeQty = pos.remaining / 2;
      const partial = { ...pos, remaining: closeQty };
      const trade = closePosition(partial, price, 'manual', closedAt ?? Math.floor(Date.now() / 1000));

      const positions = st.positions.map((p) =>
        p.id === id ? { ...p, remaining: p.remaining - closeQty } : p,
      );
      storeRef.current = { ...storeRef.current, positions };
      applyClose(trade, positions);
      return trade;
    },
    [applyClose],
  );

  const closeAllAtPrice = useCallback(
    (price: number, reason: ClosedTrade['exitReason'] = 'replay-ended', closedAt?: number): ClosedTrade[] => {
      const st = storeRef.current;
      const trades: ClosedTrade[] = [];
      let balance = st.balance;
      const exitTime = closedAt ?? Math.floor(Date.now() / 1000);
      for (const pos of st.positions) {
        const t = closePosition(pos, price, reason, exitTime);
        balance += t.pnl;
        trades.push({ ...t, balanceAfter: balance });
      }
      if (trades.length === 0) return trades;
      storeRef.current = {
        ...storeRef.current,
        balance,
        realizedPnl: balance - st.startingBalance,
        positions: [],
        history: [...st.history, ...trades],
      };
      commitEquityWatermark(price);
      sync();
      return trades;
    },
    [commitEquityWatermark, sync],
  );

  const moveStopToEntry = useCallback(
    (id: string) => {
      storeRef.current = {
        ...storeRef.current,
        positions: storeRef.current.positions.map((p) =>
          p.id === id ? { ...p, stopLoss: p.entryPrice } : p,
        ),
      };
      sync();
    },
    [sync],
  );

  /** 编辑某笔已平仓成交的备注。 */
  const updateTradeNote = useCallback(
    (tradeId: string, note: string) => {
      storeRef.current = {
        ...storeRef.current,
        history: storeRef.current.history.map((t) =>
          t.id === tradeId ? { ...t, note: note.trim() || undefined } : t,
        ),
      };
      sync();
    },
    [sync],
  );

  /** 编辑某笔已平仓成交的复盘标签（整体替换）。 */
  const updateTradeTags = useCallback(
    (tradeId: string, tags: string[]) => {
      storeRef.current = {
        ...storeRef.current,
        history: storeRef.current.history.map((t) =>
          t.id === tradeId ? { ...t, tags: tags.length > 0 ? tags : undefined } : t,
        ),
      };
      sync();
    },
    [sync],
  );

  /** 手动拖动修改持仓的止损/止盈，安全侧钳制后写回（多单 SL ≤ min(开仓,现价) 等）。 */
  const updatePositionLevels = useCallback(
    (id: string, levels: { stopLoss?: number | null; takeProfit?: number | null }) => {
      const st = storeRef.current;
      const p = st.positions.find((x) => x.id === id);
      if (!p) return;
      let stopLoss = levels.stopLoss;
      let takeProfit = levels.takeProfit;
      const mark = priceRef.current;
      if (stopLoss !== undefined && stopLoss !== null && stopLoss > 0) {
        if (p.direction === 'long') {
          stopLoss = Math.min(stopLoss, p.entryPrice, mark > 0 ? mark : stopLoss);
        } else {
          stopLoss = Math.max(stopLoss, p.entryPrice, mark > 0 ? mark : stopLoss);
        }
      }
      if (takeProfit !== undefined && takeProfit !== null && takeProfit > 0) {
        if (p.direction === 'long') takeProfit = Math.max(takeProfit, p.entryPrice);
        else takeProfit = Math.min(takeProfit, p.entryPrice);
      }
      storeRef.current = {
        ...st,
        positions: st.positions.map((x) =>
          x.id === id
            ? {
                ...x,
                stopLoss: stopLoss === undefined ? x.stopLoss : stopLoss,
                takeProfit: takeProfit === undefined ? x.takeProfit : takeProfit,
              }
            : x,
        ),
      };
      sync();
    },
    [sync],
  );

  /**
   * Advance the market by one candle. Evaluates SL/TP for open positions and
   * returns any trades closed by the market on this candle.
   */
  const processTick = useCallback(
    (candle: Candle): { closedTrades: ClosedTrade[] } => {
      priceRef.current = candle.close;
      setCurrentPrice(candle.close);
      const st = storeRef.current;
      if (st.positions.length === 0) {
        commitEquityWatermark(candle.close);
        return { closedTrades: [] };
      }
      const { state: next, closedTrades } = processCandle(st, candle);
      storeRef.current = next;
      sync();
      return { closedTrades };
    },
    [commitEquityWatermark, sync],
  );

  const updatePrice = useCallback(
    (price: number) => {
      priceRef.current = price;
      setCurrentPrice(price);
      commitEquityWatermark(price);
    },
    [commitEquityWatermark],
  );

  const reset = useCallback(() => {
    storeRef.current = freshState(storeRef.current.startingBalance);
    priceRef.current = 0;
    setCurrentPrice(0);
    sync();
  }, [sync]);

  useEffect(() => {
    symbolRef.current = symbol;
  }, [symbol]);

  const unrealizedPnl = useMemo(() => {
    let total = 0;
    for (const p of state.positions) total += positionPnl(p, currentPrice);
    return total;
  }, [state.positions, currentPrice]);

  const totalPnl = useMemo(
    () => state.realizedPnl + unrealizedPnl,
    [state.realizedPnl, unrealizedPnl],
  );

  const eq = useMemo(() => equity(state, currentPrice), [state, currentPrice]);
  const avail = useMemo(() => availableBalance(state), [state]);
  const openValue = useMemo(
    () => state.positions.reduce((s, p) => s + p.remaining * currentPrice, 0),
    [state.positions, currentPrice],
  );

  return {
    state,
    currentPrice,
    unrealizedPnl,
    totalPnl,
    equity: eq,
    available: avail,
    openValue,
    startSession,
    openPosition,
    closePositionById,
    closeHalf,
    closeAllAtPrice,
    moveStopToEntry,
    updatePositionLevels,
    updateTradeNote,
    updateTradeTags,
    archiveSession,
    processTick,
    updatePrice,
    reset,
  };
}

export type PaperTrading = ReturnType<typeof usePaperTrading>;
