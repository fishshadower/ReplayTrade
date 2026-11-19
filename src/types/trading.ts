export type Direction = 'long' | 'short';

export type ExitReason = 'manual' | 'stop-loss' | 'take-profit' | 'replay-ended';

export interface Position {
  id: string;
  symbol: string;
  direction: Direction;
  entryPrice: number;
  quantity: number;
  stopLoss: number | null;
  takeProfit: number | null;
  openedAt: number;
  /** remaining open quantity (for partial closes) */
  remaining: number;
}

export interface ClosedTrade {
  id: string;
  symbol: string;
  direction: Direction;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  /** signed P&L in currency */
  pnl: number;
  /** percentage return on the position size */
  returnPct: number;
  /** risk at the time of close (|entry - SL| * remaining), null when no SL */
  risk: number | null;
  /** P&L expressed in units of risk (R), null when no SL */
  rMultiple: number | null;
  exitReason: ExitReason;
  openedAt: number;
  closedAt: number;
  /** 平仓后账户余额 */
  balanceAfter?: number;
  /** 平仓时刻生效的止损价（记录当时值，之后改动不影响） */
  exitStopLoss?: number | null;
  /** 平仓时刻生效的止盈价 */
  exitTakeProfit?: number | null;
  /** 自由备注（如成功/失败原因） */
  note?: string;
  /** 复盘标签（四维度+结论，固定清单见 utils/tradeTags.ts） */
  tags?: string[];
}

export interface TradingState {
  startingBalance: number;
  balance: number;
  realizedPnl: number;
  positions: Position[];
  history: ClosedTrade[];
  /** all-time high equity watermark, used to compute max drawdown */
  peakEquity: number;
  maxDrawdown: number;
}

export interface OrderDraft {
  direction: Direction;
  quantity: number;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
}

export interface OrderPreview {
  positionValue: number;
  estimatedRisk: number;
  potentialReward: number;
  riskRewardRatio: number | null;
}
