import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  LineWidth,
  TickMarkType,
  createChart,
  createSeriesMarkers,
} from 'lightweight-charts';
import type {
  CandlestickData,
  HistogramData,
  IChartApi,
  IPriceLine,
  IPriceScaleApi,
  ISeriesApi,
  ISeriesMarkersPluginApi,
  LineData,
  LogicalRange,
  MouseEventHandler,
  SeriesMarker,
  Time,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Candle, Timeframe } from '../types/market';
import { TIME_FRAME_MS } from '../types/market';
import type { ClosedTrade, Position } from '../types/trading';
import type { MagnetMode, ToolId as DrawingTool } from '../drawing';
import { DrawingEngine, makeStorageKey } from '../drawing';
import { ema, sma } from '../utils/indicators';
import { nearestIndexByTime, formatCandleDate, formatISODateTime } from '../utils/candleUtils';
import { formatPrice, formatVolume } from '../utils/tradingCalculations';
import { DrawingToolbar } from './chart/DrawingToolbar';
import { DrawingSettingsPanel } from './chart/DrawingSettingsPanel';
import {
  ArrowRightToLine,
  CalendarSearch,
  CandlestickChart,
  Eye,
  Plus,
  EyeOff,
  LineChart,
  ScanSearch,
  Settings2,
  X,
} from 'lucide-react';
import type { IndicatorInstance } from '../indicators/config';
import { INDICATOR_REGISTRY, createInstance, defOf, instanceLabel } from '../indicators/config';
import { zigzag as computeZigzag } from '../indicators/zigzag';

interface TradingChartProps {
  candles: Candle[];
  timeframe: Timeframe;
  symbol: string;
  decimals: number;
  currentPrice: number;
  positions: Position[];
  closedTrades?: ClosedTrade[];
  replayActive: boolean;
  visibleStartIndex: number;
  currentReplayIndex: number;
  isSelecting: boolean;
  selectedIndex: number | null;
  replayStartIndex: number | null;
  onSelectCandle: (index: number) => void;
  isPlaying: boolean;
  autoFollow: boolean;
  followSignal: number;
  indicators: IndicatorInstance[];
  onUpdateIndicators: (next: IndicatorInstance[]) => void;
  invertPriceScale?: boolean;
  onUpdatePositionLevels?: (id: string, levels: { stopLoss?: number | null; takeProfit?: number | null }) => void;
  /** 变化时视图跳到该时间（秒），用于历史成交点击跳转 */
  focusTimeSignal?: number;
  onChartReady?: (chart: IChartApi | null) => void;
}

const COLORS = {
  up: '#22c55e',
  down: '#ef4444',
  text: '#9aa6bd',
  grid: 'rgba(148, 163, 184, 0.08)',
  volumeUp: 'rgba(34, 197, 94, 0.35)',
  volumeDown: 'rgba(239, 68, 68, 0.35)',
  ema: '#eab308',
  sma: '#4f8cff',
  accent: '#4f8cff',
};

function toChartTime(time: number): Time {
  return time as Time;
}

/**
 * Manually fit a price scale so that `slice` fills its visible range (with a
 * small pad for wicks). Used instead of the library autoscale, because
 * `autoScale: true` disables TradingView-style vertical drag-panning.
 */
function fitPriceScaleToCandles(ps: IPriceScaleApi, slice: Candle[]): void {
  if (slice.length === 0) return;
  let min = Infinity;
  let max = -Infinity;
  for (const c of slice) {
    if (c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return;
  let span = max - min;
  if (span <= 0) span = 1;
  const pad = span * 0.02;
  ps.setVisibleRange({ from: min - pad, to: max + pad });
}

/** TradingView-style tick-mark labels (e.g. `14:35`, `Aug`, `'26`). */
function tickMarkFormatter(time: Time, tickMarkType: TickMarkType): string {
  const ts =
    typeof time === 'number'
      ? time
      : (time as { timestamp?: number; year?: number; month?: number; day?: number }).timestamp ??
        ((time as { year?: number; month?: number; day?: number }).year ?? 0);
  const d = new Date(ts * 1000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  switch (tickMarkType) {
    case TickMarkType.Year:
      return String(d.getFullYear());
    case TickMarkType.Month:
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    case TickMarkType.DayOfMonth:
      return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    case TickMarkType.Time:
      return `${hh}:${mm}`;
    case TickMarkType.TimeWithSeconds:
      return `${hh}:${mm}:${ss}`;
    default:
      return '';
  }
}

export function TradingChart({
  candles,
  timeframe,
  symbol,
  decimals,
  currentPrice,
  positions,
  closedTrades,
  replayActive,
  visibleStartIndex,
  currentReplayIndex,
  isSelecting,
  selectedIndex,
  replayStartIndex,
  onSelectCandle,
  isPlaying,
  autoFollow,
  followSignal,
  indicators,
  onUpdateIndicators,
  invertPriceScale = false,
  onUpdatePositionLevels,
  focusTimeSignal = 0,
  onChartReady,
}: TradingChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const timeframeRef = useRef(timeframe);
  timeframeRef.current = timeframe;
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const lineSeriesMapRef = useRef<Map<string, ISeriesApi<'Line'>>>(new Map());
  const currentPriceLineRef = useRef<IPriceLine | null>(null);
  const priceLineRefs = useRef<Map<string, IPriceLine[]>>(new Map());
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const areaSeriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const markersAreaRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const lastCountRef = useRef<number>(0);
  const lastDataKeyRef = useRef<string>('');
  const lastWindowStartRef = useRef<number | null>(null);
  const visibleLenRef = useRef(0);
  const atRightEdgeRef = useRef(true);
  // TradingView-style price-scale ownership: once the user drags/zooms the
  // price scale, the replay auto-refit backs off until the dataset changes or
  // the view window is recentered (so vertical panning is never yanked back).
  const priceScaleManualRef = useRef(false);
  const [priceScaleManual, setPriceScaleManual] = useState(false);
  const panStartRef = useRef<[number, number] | null>(null);

  const [hover, setHover] = useState<Candle | null>(null);
  const [tool, setTool] = useState<DrawingTool>('select');
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const [magnetMode, setMagnetMode] = useState<MagnetMode>('off');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [drawingsCount, setDrawingsCount] = useState(0);
  const drawingsCountRef = useRef(0);
  const [, setDrawTick] = useState(0);
  const [selectedDrawingId, setSelectedDrawingId] = useState<string | null>(null);
  const [awayFromEdge, setAwayFromEdge] = useState(false);
  const [gotoOpen, setGotoOpen] = useState(false);
  const [chartType, setChartType] = useState<'candles' | 'area'>('candles');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [gotoValue, setGotoValue] = useState('');
  const drawingEngineRef = useRef<DrawingEngine | null>(null);
  const drawingActiveRef = useRef(false);
  drawingActiveRef.current = tool !== 'select';

  // Refs for latest props, so the click subscription never needs re-creating.
  const selectingRef = useRef(isSelecting);
  selectingRef.current = isSelecting;
  const onSelectCandleRef = useRef(onSelectCandle);
  onSelectCandleRef.current = onSelectCandle;
  const candlesRef = useRef(candles);
  candlesRef.current = candles;
  const autoFollowRef = useRef(autoFollow);
  autoFollowRef.current = autoFollow;
  const positionsRef = useRef(positions);
  positionsRef.current = positions;
  const updateLevelsRef = useRef(onUpdatePositionLevels);
  updateLevelsRef.current = onUpdatePositionLevels;
  const [hoverLevel, setHoverLevel] = useState<{ id: string; kind: 'stop' | 'take'; y: number } | null>(null);
  const draggingLevelRef = useRef<{
    id: string;
    kind: 'stop' | 'take' | 'entry';
    /** 从开仓线拖出时：方向确定后本次拖拽固定写入的字段 */
    field?: 'stop' | 'take';
  } | null>(null);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const visible = useMemo(() => {
    if (!replayActive) return candles;
    const end = Math.min(candles.length - 1, currentReplayIndex);
    const start = Math.max(0, visibleStartIndex);
    return start <= end ? candles.slice(start, end + 1) : [];
  }, [candles, replayActive, visibleStartIndex, currentReplayIndex]);

  visibleLenRef.current = visible.length;

  // Create the chart exactly once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      width: container.clientWidth,
      height: container.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: '#0b0f19' },
        textColor: COLORS.text,
        fontSize: 13,
        fontFamily: "'Inter Variable', 'Inter', -apple-system, BlinkMacSystemFont, 'PingFang SC', sans-serif",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: COLORS.grid },
        horzLines: { color: COLORS.grid },
      },
      rightPriceScale: {
        borderColor: '#232c3f',
        borderVisible: true,
        // autoScale must stay OFF: with it on, lightweight-charts snaps the
        // price scale back on mouse drag, so vertical panning never works.
        // We refit the range manually at the right moments instead.
        autoScale: false,
        scaleMargins: { top: 0.08, bottom: 0.25 },
      },
      timeScale: {
        borderColor: '#232c3f',
        borderVisible: true,
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 4,
        barSpacing: 6,
        minBarSpacing: 1,
        tickMarkFormatter,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        // TradingView parity: dragging on the price axis zooms vertically.
        axisPressedMouseMove: true,
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: 'rgba(148,163,184,0.35)',
          width: 1 as LineWidth,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1a2233',
        },
        horzLine: {
          color: 'rgba(148,163,184,0.35)',
          width: 1 as LineWidth,
          style: LineStyle.Dashed,
          labelBackgroundColor: '#1a2233',
        },
      },
      localization: {
        priceFormatter: (p: number) => formatPrice(p, decimals),
        timeFormatter: (time: Time) =>
          typeof time === 'number' ? formatCandleDate(time, timeframeRef.current) : '',
      },
    });
    chartRef.current = chart;
    onChartReady?.(chart);

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.up,
      downColor: COLORS.down,
      wickUpColor: COLORS.up,
      wickDownColor: COLORS.down,
      borderVisible: false,
      priceLineVisible: false,
      priceFormat: { type: 'price', precision: decimals, minMove: 1 / 10 ** decimals },
    });
    candleSeriesRef.current = candleSeries;
    markersRef.current = createSeriesMarkers(candleSeries, []);

    const drawingEngine = new DrawingEngine(makeStorageKey(symbol, timeframe));
    drawingEngineRef.current = drawingEngine;
    candleSeries.attachPrimitive(drawingEngine);
    drawingEngine.setOptions({
      onChange: () => {
        setDrawTick((v) => v + 1);
        const n = drawingEngine.getDrawings().length;
        const grew = n > drawingsCountRef.current;
        drawingsCountRef.current = n;
        setDrawingsCount(n);
        // 画完一个新图形后自动切回选择/移动工具（TradingView 习惯），图形保留可编辑。
        // 例外：自由画笔连续绘制，右键才退出。
        if (grew && drawingActiveRef.current && toolRef.current !== 'path') {
          setTool('select');
          drawingEngine.setTool('select');
        }
      },
      onCursor: (cursor) => {
        if (container.style.cursor !== cursor) container.style.cursor = cursor;
      },
      onSelectionChange: (id) => {
        setSelectedDrawingId(id);
      },
      onHistoryChange: (undoable, redoable) => {
        setCanUndo(undoable);
        setCanRedo(redoable);
      },
    });

    const areaSeries = chart.addSeries(AreaSeries, {
      lineColor: COLORS.accent,
      topColor: 'rgba(79, 140, 255, 0.28)',
      bottomColor: 'rgba(79, 140, 255, 0.02)',
      lineWidth: 2,
      visible: false,
      priceLineVisible: false,
      lastValueVisible: false,
      priceFormat: { type: 'price', precision: decimals, minMove: 1 / 10 ** decimals },
    });
    areaSeriesRef.current = areaSeries;
    markersAreaRef.current = createSeriesMarkers(areaSeries, []);

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale('volume').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      visible: false,
    });
    volumeSeriesRef.current = volumeSeries;

    const priceLine = candleSeries.createPriceLine({
      price: 0,
      color: 'rgba(255,255,255,0.6)',
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      axisLabelVisible: true,
      title: '',
    });
    currentPriceLineRef.current = priceLine;

    const onResize = () => {
      if (containerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    const crosshairHandler: MouseEventHandler<Time> = (param) => {
      if (param.time === undefined) {
        setHover(null);
        return;
      }
      const idx = param.logical;
      if (idx === undefined || idx < 0) return;
      const seriesData = param.seriesData.get(candleSeries);
      if (seriesData) {
        const d = seriesData as CandlestickData;
        const candle: Candle = {
          time: d.time as number,
          open: d.open,
          high: d.high,
          low: d.low,
          close: d.close,
          volume: 0,
        };
        const volData = volumeSeries.dataByIndex(idx);
        if (volData) candle.volume = (volData as HistogramData).value ?? 0;
        setHover(candle);
      }
    };
    chart.subscribeCrosshairMove(crosshairHandler);

    const clickHandler: MouseEventHandler<Time> = (param) => {
      if (!selectingRef.current) return;
      if (drawingActiveRef.current) return;
      if (param.time === undefined) return;
      const idx = nearestIndexByTime(candlesRef.current, param.time as number);
      if (idx >= 0) onSelectCandleRef.current(idx);
    };
    chart.subscribeClick(clickHandler);

    return () => {
      ro.disconnect();
      chart.unsubscribeCrosshairMove(crosshairHandler);
      chart.unsubscribeClick(clickHandler);
      drawingEngineRef.current = null;
      container.style.cursor = '';
      if (candleSeriesRef.current) {
        priceLineRefs.current.forEach((lines) =>
          lines.forEach((l) => candleSeriesRef.current?.removePriceLine(l)),
        );
      }
      priceLineRefs.current.clear();
      chart.remove();
      chartRef.current = null;
      onChartReady?.(null);
      candleSeriesRef.current = null;
      areaSeriesRef.current = null;
      markersAreaRef.current = null;
      volumeSeriesRef.current = null;
      lineSeriesMapRef.current.clear();
      currentPriceLineRef.current = null;
      markersRef.current = null;
      lastCountRef.current = 0;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track whether the user has scrolled away from the right edge, so auto-follow
  // pauses while they study history (TradingView behaviour) and resumes at the edge.
  useEffect(() => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const onRange = (range: LogicalRange | null) => {
      if (!range) return;
      atRightEdgeRef.current = range.to >= visibleLenRef.current + 2;
      setAwayFromEdge(!atRightEdgeRef.current);
    };
    ts.subscribeVisibleLogicalRangeChange(onRange);
    return () => ts.unsubscribeVisibleLogicalRangeChange(onRange);
  }, []);

  // Keep price precision (axis + price lines) in sync when the symbol changes.
  useEffect(() => {
    chartRef.current?.applyOptions({
      localization: { priceFormatter: (p: number) => formatPrice(p, decimals) },
    });
    candleSeriesRef.current?.applyOptions({
      priceFormat: { type: 'price', precision: decimals, minMove: 1 / 10 ** decimals },
    });
  }, [decimals]);

  // Volume pane visibility toggle (TradingView parity).
  const volumeInst = indicators.find((i) => i.type === 'volume');
  useEffect(() => {
    volumeSeriesRef.current?.applyOptions({ visible: volumeInst ? volumeInst.visible : true });
  }, [volumeInst?.visible]);

  // 指标实例 series 同步：新增建线、移除删线、颜色/显隐即时应用
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const map = lineSeriesMapRef.current;
    const alive = new Set(indicators.filter((i) => i.type !== 'volume').map((i) => i.id));
    for (const [id, s] of map) {
      if (!alive.has(id)) {
        chart.removeSeries(s);
        map.delete(id);
      }
    }
    for (const inst of indicators) {
      if (inst.type === 'volume') continue;
      let s = map.get(inst.id);
      if (!s) {
        s = chart.addSeries(LineSeries, {
          color: inst.color,
          lineWidth: inst.type === 'zigzag' ? 2 : 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        map.set(inst.id, s);
      }
      s.applyOptions({ color: inst.color, visible: inst.visible });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators]);

  // Invert the price scale (TradingView parity): flips the chart vertically so
  // downtrends read as uptrends. Reset manual panning and refit so the flipped
  // view lands on the current window instead of a stale range.
  useEffect(() => {
    chartRef.current?.applyOptions({ rightPriceScale: { invertScale: invertPriceScale } });
    priceScaleManualRef.current = false;
    setPriceScaleManual(false);
    const cs = candleSeriesRef.current;
    if (!cs || visible.length === 0) return;
    const lr = chartRef.current?.timeScale().getVisibleLogicalRange();
    if (!lr) return;
    fitPriceScaleToCandles(cs.priceScale(), visible.slice(Math.max(0, Math.floor(lr.from))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invertPriceScale]);

  // 图表形态切换：蜡烛 ↔ 面积图（两套 series 平行喂数据，切 visible）
  useEffect(() => {
    candleSeriesRef.current?.applyOptions({ visible: chartType === 'candles' });
    areaSeriesRef.current?.applyOptions({ visible: chartType === 'area' });
  }, [chartType]);

  // 外部请求跳转（点击历史成交时间）：视图落到对应 K 线并适配价格
  useEffect(() => {
    if (!focusTimeSignal || focusTimeSignal <= 0) return;
    const idx = nearestIndexByTime(candles, focusTimeSignal);
    if (idx < 0) return;
    // 回放模式 series 只装已揭示切片：全量索引需换算成窗口内 logical 索引；
    // 目标早于揭示窗口则不跳（回放不看更早之外的未装载数据）
    const start = replayActive ? Math.max(0, visibleStartIndex) : 0;
    const logicalIdx = idx - start;
    if (logicalIdx < 0) return;
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const span = 160;
    ts.setVisibleLogicalRange({
      from: Math.max(0, logicalIdx - Math.floor(span * 0.5)),
      to: logicalIdx + Math.ceil(span * 0.5),
    });
    const cs = candleSeriesRef.current;
    if (cs) fitPriceScaleToCandles(cs.priceScale(), candles.slice(Math.max(start, idx - span), idx + 40));
    atRightEdgeRef.current = false;
    setAwayFromEdge(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTimeSignal]);

  // Data sync: only the visible (revealed) slice ever reaches the series.
  useEffect(() => {
    if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;

    const prevCount = lastCountRef.current;
    lastCountRef.current = visible.length;
    const dataKey = `${symbol}|${timeframe}|${candles.length}|${candles[candles.length - 1]?.time ?? ''}`;
    const dataChanged = lastDataKeyRef.current !== dataKey;
    lastDataKeyRef.current = dataKey;
    const c = candleSeriesRef.current;
    const v = volumeSeriesRef.current;
    const isAppend = prevCount > 0 && visible.length === prevCount + 1;
    // A "window jump": the visible slice's left edge moved (replay start, reset,
    // or a new start point). This must recenter + refit the price scale,
    // otherwise the price scale stays fitted to the old (full) window and the
    // graph appears squished off to the side.
    const windowStart = replayActive ? visibleStartIndex : 0;
    const windowJumped =
      lastWindowStartRef.current !== null && windowStart !== lastWindowStartRef.current;
    lastWindowStartRef.current = windowStart;

    if (isAppend && visible.length > 0) {
      const last = visible[visible.length - 1];
      if (!last) return;
      c.update({
        time: toChartTime(last.time),
        open: last.open,
        high: last.high,
        low: last.low,
        close: last.close,
      } as CandlestickData);
      v.update({
        time: toChartTime(last.time),
        value: last.volume,
        color: last.close >= last.open ? COLORS.volumeUp : COLORS.volumeDown,
      } as HistogramData);
      areaSeriesRef.current?.update({ time: toChartTime(last.time), value: last.close });
      // Replay autoscale: when the newly revealed candle breaks out of the
      // current price range, refit so it stays in view (like TradingView).
      // Backs off once the user has manually panned/zoomed the price scale.
      const ps = c.priceScale();
      const cur = ps.getVisibleRange();
      if (cur && !priceScaleManualRef.current && (last.high > cur.to || last.low < cur.from)) {
        const lr = chartRef.current.timeScale().getVisibleLogicalRange();
        if (lr) {
          fitPriceScaleToCandles(ps, visible.slice(Math.max(0, Math.floor(lr.from))));
        }
      }
    } else if (visible.length > 0) {
      c.setData(
        visible.map((k) => ({
          time: toChartTime(k.time),
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        })) as CandlestickData[],
      );
      v.setData(
        visible.map((k) => ({
          time: toChartTime(k.time),
          value: k.volume,
          color: k.close >= k.open ? COLORS.volumeUp : COLORS.volumeDown,
        })) as HistogramData[],
      );
      areaSeriesRef.current?.setData(
        visible.map((k) => ({ time: toChartTime(k.time), value: k.close })),
      );
      if (dataChanged) {
        // New dataset / timeframe / symbol: land on the latest bars like TradingView.
        // Fresh data re-engages price auto-fit (TradingView resets the scale).
        priceScaleManualRef.current = false;
        setPriceScaleManual(false);
        const rangeFrom = Math.max(0, visible.length - 160);
        chartRef.current.timeScale().setVisibleLogicalRange({ from: rangeFrom, to: visible.length + 4 });
        fitPriceScaleToCandles(c.priceScale(), visible.slice(rangeFrom));
        atRightEdgeRef.current = true;
      } else if (windowJumped) {
        // Replay just started / reset / start point changed: the visible window
        // moved to a different region of history, so land on the start candle
        // and refit the price scale to this window (TradingView parity). This
        // is what keeps the graph centered instead of squished to one side.
        priceScaleManualRef.current = false;
        setPriceScaleManual(false);
        const rangeFrom = Math.max(0, visible.length - 160);
        chartRef.current.timeScale().setVisibleLogicalRange({ from: rangeFrom, to: visible.length + 4 });
        fitPriceScaleToCandles(c.priceScale(), visible.slice(rangeFrom));
        atRightEdgeRef.current = true;
      } else {
        // Replay window moved: preserve the user's view, only clamp if it fell out of range.
        const r = chartRef.current.timeScale().getVisibleLogicalRange();
        if (r && (r.to > visible.length + 8 || r.from < 0)) {
          const rangeFrom = Math.max(0, visible.length - 160);
          chartRef.current.timeScale().setVisibleLogicalRange({
            from: rangeFrom,
            to: visible.length + 4,
          });
          // Recentering the window also re-engages price auto-fit so the new
          // window is shown coherently (covers replay reset / large skips).
          priceScaleManualRef.current = false;
          setPriceScaleManual(false);
          fitPriceScaleToCandles(c.priceScale(), visible.slice(rangeFrom));
          atRightEdgeRef.current = true;
        }
      }
    } else {
      c.setData([]);
      v.setData([]);
    }

    // 指标实例喂数（实例驱动：SMA/EMA/ZigZag 任意多实例）
    const lineMap = lineSeriesMapRef.current;
    const lineInstances = indicators.filter((i) => i.type !== 'volume' && i.visible);
    if (lineInstances.length > 0 && visible.length >= 2) {
      if (isAppend) {
        // 回放推进：均线只在 200 根尾窗上算最新值（SMA 精确、EMA 热身后无差）；ZigZag 全量 O(n) 重算
        const lastVisible = visible[visible.length - 1];
        if (lastVisible) {
          const tail = visible.slice(-200);
          for (const inst of lineInstances) {
            const s = lineMap.get(inst.id);
            if (!s) continue;
            if (inst.type === 'sma' || inst.type === 'ema') {
              const arr =
              inst.type === 'sma' ? sma(tail, inst.params.period ?? 20) : ema(tail, inst.params.period ?? 50);
              const v = arr[arr.length - 1];
              if (v !== null && v !== undefined) s.update({ time: toChartTime(lastVisible.time), value: v });
            }
          }
        }
        for (const inst of lineInstances) {
          if (inst.type !== 'zigzag') continue;
          const s = lineMap.get(inst.id);
          s?.setData(
            computeZigzag(visible, inst.params.deviationPct ?? 5).map((p) => ({
              time: toChartTime(p.time),
              value: p.value,
            })),
          );
        }
      } else {
        for (const inst of lineInstances) {
          const s = lineMap.get(inst.id);
          if (!s) continue;
          if (inst.type === 'sma' || inst.type === 'ema') {
            const arr = inst.type === 'sma'
            ? sma(visible, inst.params.period ?? 20)
            : ema(visible, inst.params.period ?? 50);
            s.setData(
              arr
                .map((val, i) =>
                  val === null || !visible[i] ? null : { time: toChartTime(visible[i].time), value: val },
                )
                .filter(Boolean) as LineData[],
            );
          } else if (inst.type === 'zigzag') {
            s.setData(
              computeZigzag(visible, inst.params.deviationPct ?? 5).map((p) => ({
                time: toChartTime(p.time),
                value: p.value,
              })),
            );
          }
        }
      }
    } else if (!isAppend) {
      lineMap.forEach((s) => s.setData([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, indicators]);

  // Drawing context: per-symbol storage + reveal-window for coordinate math.
  useEffect(() => {
    drawingEngineRef.current?.setContext(symbol, timeframe);
  }, [symbol, timeframe]);

  useEffect(() => {
    const engine = drawingEngineRef.current;
    if (!engine) return;
    const tfSec = TIME_FRAME_MS[timeframe] / 1000;
    const revealTime = replayActive ? (candles[currentReplayIndex]?.time ?? null) : null;
    engine.setData(candles, tfSec, revealTime, replayActive);
    engine.setDecimals(decimals);
  }, [candles, timeframe, decimals, currentReplayIndex, replayActive]);

  // Drawing shortcuts: Ctrl/Cmd+Z undo, Escape cancels an in-progress drawing,
  // Delete/Backspace deletes the selection, Arrow keys nudge selected drawing.
  useEffect(() => {
    const isTyping = (e: KeyboardEvent): boolean => {
      const target = e.target as HTMLElement;
      return !!target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
    };
    const onKey = (e: KeyboardEvent) => {
      const engine = drawingEngineRef.current;
      if (!engine) return;
      if (e.altKey && (e.key === 'g' || e.key === 'G')) {
        if (isTyping(e)) return;
        e.preventDefault();
        e.stopPropagation();
        setGotoOpen((v) => !v);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (isTyping(e)) return;
        e.preventDefault();
        e.stopPropagation();
        engine.undo();
        return;
      }
      if (e.key === 'Escape' && engine.cancel()) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && engine.getSelectedId()) {
        if (isTyping(e)) return;
        e.preventDefault();
        e.stopPropagation();
        engine.deleteSelected();
        return;
      }
      if (engine.getSelectedId()) {
        if (isTyping(e)) return;
        const step = e.shiftKey ? 5 : 1;
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          engine.nudgeSelected(0, -step);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          engine.nudgeSelected(0, step);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          e.stopPropagation();
          engine.nudgeSelected(-step, 0);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          e.stopPropagation();
          engine.nudgeSelected(step, 0);
        }
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  // Drawing interactions (click-drag to draw, drag to move, double-click to finish).
  useEffect(() => {
    const container = containerRef.current;
    const engine = drawingEngineRef.current;
    if (!container || !engine) return;

    const getPos = (e: PointerEvent): [number, number] => {
      const rect = container.getBoundingClientRect();
      return [e.clientX - rect.left, e.clientY - rect.top];
    };
    const hitTestLevel = (y: number): { id: string; kind: 'stop' | 'take' | 'entry' } | null => {
      const cs = candleSeriesRef.current;
      if (!cs) return null;
      for (const p of positionsRef.current) {
        if (typeof p.stopLoss === 'number' && p.stopLoss > 0) {
          const ly = cs.priceToCoordinate(p.stopLoss);
          if (ly !== null && Math.abs(ly - y) <= 6) return { id: p.id, kind: 'stop' };
        }
        if (typeof p.takeProfit === 'number' && p.takeProfit > 0) {
          const ly = cs.priceToCoordinate(p.takeProfit);
          if (ly !== null && Math.abs(ly - y) <= 6) return { id: p.id, kind: 'take' };
        }
        const ey = cs.priceToCoordinate(p.entryPrice);
        if (ey !== null && Math.abs(ey - y) <= 6) return { id: p.id, kind: 'entry' };
      }
      return null;
    };

    const onDown = (e: PointerEvent): void => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest?.('[data-level-del]')) return;
      const [x, y] = getPos(e);
      // SL/TP 线命中优先：进入拖拽，不进画图引擎
      const hit = hitTestLevel(y);
      if (hit) {
        e.preventDefault();
        draggingLevelRef.current = hit;
        panStartRef.current = null;
        if (!container.hasPointerCapture(e.pointerId)) {
          container.setPointerCapture(e.pointerId);
        }
        return;
      }
      panStartRef.current = [x, y];
      engine.onPointerDown(x, y, e.shiftKey);
      if (drawingActiveRef.current || engine.isDragging()) {
        if (!container.hasPointerCapture(e.pointerId)) {
          container.setPointerCapture(e.pointerId);
        }
      }
    };
    const onMove = (e: PointerEvent): void => {
      const [x, y] = getPos(e);
      const drag = draggingLevelRef.current;
      if (drag) {
        const cs = candleSeriesRef.current;
        if (cs) {
          const price = cs.coordinateToPrice(y);
          if (price !== null) {
            if (drag.kind === 'entry') {
              // 从开仓线拖出：按拖动方向确定生成止损还是止盈，确定后本次固定
              const pos = positionsRef.current.find((q) => q.id === drag.id);
              if (pos && Math.abs(y - (cs.priceToCoordinate(pos.entryPrice) ?? y)) > 3) {
                if (!drag.field) {
                  const below = price < pos.entryPrice;
                  const isLong = pos.direction === 'long';
                  drag.field =
                    below === isLong ? 'stop' : 'take'; // 多单往下=止损，往上=止盈；空单镜像
                }
                if (drag.field === 'stop') {
                  updateLevelsRef.current?.(drag.id, { stopLoss: price });
                } else {
                  updateLevelsRef.current?.(drag.id, { takeProfit: price });
                }
              }
            } else {
              updateLevelsRef.current?.(
                drag.id,
                drag.kind === 'stop' ? { stopLoss: price } : { takeProfit: price },
              );
            }
          }
          container.style.cursor = 'ns-resize';
        }
        return;
      }
      if (!drawingActiveRef.current && !engine.isDragging()) {
        const hover = hitTestLevel(y);
        if (hover) {
          container.style.cursor = 'ns-resize';
          setHoverLevel((prev) => {
            const next =
              hover.kind === 'entry' ? null : { id: hover.id, kind: hover.kind, y };
            if (prev && next && prev.id === next.id && prev.kind === next.kind && Math.abs(prev.y - next.y) < 0.5) {
              return prev;
            }
            return next;
          });
          return;
        }
      }
      setHoverLevel((prev) => (prev === null ? prev : null));
      const start = panStartRef.current;
      if (start) {
        const dx = x - start[0];
        const dy = y - start[1];
        if (Math.abs(dy) > 4 && !drawingActiveRef.current && !engine.isDragging()) {
          priceScaleManualRef.current = true;
          setPriceScaleManual(true);
        }
        if (dx * dx + dy * dy > 12) panStartRef.current = null;
      }
      engine.onPointerMove(x, y, e.shiftKey, e.buttons === 1);
    };
    const onUp = (): void => {
      draggingLevelRef.current = null;
      panStartRef.current = null;
      engine.onPointerUp();
    };
    const onCancel = (): void => {
      draggingLevelRef.current = null;
      panStartRef.current = null;
      engine.onPointerCancel();
    };
    const onDblClick = (): void => {
      engine.onDblClick();
    };

    const onLeave = (): void => {
      engine.onPointerLeave();
    };

    // 右键 = 取消进行中的绘制 / 切回选择工具（TradingView 肌肉记忆）
    const onContextMenu = (e: MouseEvent): void => {
      e.preventDefault();
      if (drawingActiveRef.current || engine.isDragging()) {
        // 右键 = 完成当前多点/自由画笔绘制（图形保存），其余（拖一半的）才丢弃
        if (!engine.finishDraft()) engine.cancel();
      }
      setTool('select');
      engine.setTool('select');
    };

    container.addEventListener('contextmenu', onContextMenu, true);
    container.addEventListener('pointerdown', onDown);
    container.addEventListener('pointermove', onMove);
    container.addEventListener('dblclick', onDblClick);
    container.addEventListener('pointerleave', onLeave);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      container.removeEventListener('contextmenu', onContextMenu, true);
      container.removeEventListener('pointerdown', onDown);
      container.removeEventListener('pointermove', onMove);
      container.removeEventListener('dblclick', onDblClick);
      container.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToolChange = (next: DrawingTool): void => {
    setTool(next);
    drawingEngineRef.current?.setTool(next);
  };

  const handleMagnetChange = (next: MagnetMode): void => {
    setMagnetMode(next);
    drawingEngineRef.current?.setMagnetMode(next);
  };

  // When entering replay-start selection, force the select tool back on
  useEffect(() => {
    if (!isSelecting) return;
    setTool('select');
    drawingEngineRef.current?.setTool('select');
  }, [isSelecting]);

  // While a drawing tool is active, take over touch gestures so drags draw
  // instead of scrolling/panning the page.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.style.touchAction = tool !== 'select' ? 'none' : 'auto';
  }, [tool]);

  // Auto-follow: keep the newest revealed candle centered (TradingView-style
  // playback). Uses the current visible span so zoom level is preserved, and
  // only refits toward the newest candle as the replay advances.
  useEffect(() => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const r = ts.getVisibleLogicalRange();
    const span = r && r.to > r.from ? r.to - r.from : 160;
    const last = Math.max(0, visible.length - 1);
    ts.setVisibleLogicalRange({
      from: Math.max(0, last - span / 2),
      to: last + span / 2,
    });
    atRightEdgeRef.current = true;
  }, [followSignal]);

  useEffect(() => {
    if (!autoFollowRef.current || !isPlayingRef.current) return;
    if (!atRightEdgeRef.current) return;
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    const r = ts.getVisibleLogicalRange();
    const span = r && r.to > r.from ? r.to - r.from : 160;
    const last = Math.max(0, visible.length - 1);
    ts.setVisibleLogicalRange({
      from: Math.max(0, last - span / 2),
      to: last + span / 2,
    });
  }, [visible.length]);

  // When picking a replay start, bring that candle into view so the marker is visible.
  useEffect(() => {
    if (!isSelecting || selectedIndex === null) return;
    const ts = chartRef.current?.timeScale();
    if (!ts) return;
    atRightEdgeRef.current = false;
    ts.setVisibleLogicalRange({
      from: Math.max(0, selectedIndex - 120),
      to: Math.min(candles.length - 1, selectedIndex + 80),
    });
  }, [isSelecting, selectedIndex, candles]);

  // Replay start / selection markers + trade entry/exit markers.
  useEffect(() => {
    const plugin = markersRef.current;
    if (!plugin) return;
    const markers: SeriesMarker<Time>[] = [];
    if (isSelecting && selectedIndex !== null && selectedIndex < candles.length) {
      const sel = candles[selectedIndex];
      if (!sel) return;
      markers.push({
        time: toChartTime(sel.time),
        position: 'belowBar',
        color: COLORS.accent,
        shape: 'circle',
        text: '回放起点',
        size: 1,
      });
    }
    if (replayActive && replayStartIndex !== null && replayStartIndex < candles.length) {
      const start = candles[replayStartIndex];
      if (!start) return;
      markers.push({
        time: toChartTime(start.time),
        position: 'belowBar',
        color: COLORS.accent,
        shape: 'circle',
        text: '回放起点',
        size: 1,
      });
    }
    if (!isSelecting) {
      // Entry/exit markers, only for bars currently in the revealed series.
      const visibleTimes = new Set(visible.map((c) => c.time));
      for (const p of positions) {
        if (visibleTimes.has(p.openedAt)) {
          markers.push({
            time: toChartTime(p.openedAt),
            position: p.direction === 'long' ? 'belowBar' : 'aboveBar',
            color: p.direction === 'long' ? COLORS.up : COLORS.down,
            shape: p.direction === 'long' ? 'arrowUp' : 'arrowDown',
            text: p.direction === 'long' ? 'L' : 'S',
            size: 1,
          });
        }
        // 同向加仓点：同向小箭头标 +
        for (const add of p.additions ?? []) {
          if (!visibleTimes.has(add.time)) continue;
          markers.push({
            time: toChartTime(add.time),
            position: p.direction === 'long' ? 'belowBar' : 'aboveBar',
            color: p.direction === 'long' ? COLORS.up : COLORS.down,
            shape: p.direction === 'long' ? 'arrowUp' : 'arrowDown',
            text: '+',
            size: 0.6,
          });
        }
      }
      for (const t of closedTrades ?? []) {
        // 进场标记（方向箭头），离场标记（X）——平仓后仍能看到进出两端
        if (visibleTimes.has(t.openedAt)) {
          markers.push({
            time: toChartTime(t.openedAt),
            position: t.direction === 'long' ? 'belowBar' : 'aboveBar',
            color: t.direction === 'long' ? COLORS.up : COLORS.down,
            shape: t.direction === 'long' ? 'arrowUp' : 'arrowDown',
            text: t.direction === 'long' ? 'L' : 'S',
            size: 1,
          });
        }
        if (visibleTimes.has(t.closedAt)) {
          markers.push({
            time: toChartTime(t.closedAt),
            position: t.direction === 'long' ? 'aboveBar' : 'belowBar',
            color: COLORS.text,
            shape: 'square',
            text: 'X',
            size: 1,
          });
        }
      }
    }
    plugin.setMarkers(markers);
    markersAreaRef.current?.setMarkers(markers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelecting, selectedIndex, replayActive, replayStartIndex, candles, visible, positions, closedTrades]);

  // Current price line + open-position SL/TP/entry price lines.
  useEffect(() => {
    if (!candleSeriesRef.current) return;
    const cs = candleSeriesRef.current;
    currentPriceLineRef.current?.applyOptions({
      price: currentPrice,
      title: '',
    });

    const currentIds = new Set(positions.map((p) => p.id));
    priceLineRefs.current.forEach((lines, id) => {
      if (!currentIds.has(id)) {
        lines.forEach((l) => cs.removePriceLine(l));
        priceLineRefs.current.delete(id);
      }
    });
    for (const p of positions) {
      const lines = priceLineRefs.current.get(p.id);
      const expected = [p.entryPrice, p.stopLoss, p.takeProfit].filter(
        (v): v is number => typeof v === 'number' && v > 0,
      ).length;
      if (!lines || lines.length !== expected) {
        priceLineRefs.current.get(p.id)?.forEach((l) => cs.removePriceLine(l));
        const newLines: IPriceLine[] = [];
        newLines.push(
          cs.createPriceLine({
            price: p.entryPrice,
            color: p.direction === 'long' ? '#93c5fd' : '#f9a8d4',
            lineWidth: 1,
            lineStyle: LineStyle.Solid,
            axisLabelVisible: true,
            title: `${p.direction === 'long' ? '多' : '空'}${(p.additions?.length ?? 0) > 0 ? '·均价' : ''}`,
          }),
        );
        if (p.stopLoss) {
          newLines.push(
            cs.createPriceLine({
              price: p.stopLoss,
              color: COLORS.down,
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: 'SL',
            }),
          );
        }
        if (p.takeProfit) {
          newLines.push(
            cs.createPriceLine({
              price: p.takeProfit,
              color: COLORS.up,
              lineWidth: 1,
              lineStyle: LineStyle.Dashed,
              axisLabelVisible: true,
              title: 'TP',
            }),
          );
        }
        priceLineRefs.current.set(p.id, newLines);
      } else if (lines) {
        // 已有线随最新值同步（拖动/改值后线跟手）
        lines[0]?.applyOptions({
          price: p.entryPrice,
          title: `${p.direction === 'long' ? '多' : '空'}${(p.additions?.length ?? 0) > 0 ? '·均价' : ''}`,
        });
        let i = 1;
        if (typeof p.stopLoss === 'number' && p.stopLoss > 0) {
          lines[i]?.applyOptions({ price: p.stopLoss, title: 'SL' });
          i += 1;
        }
        if (typeof p.takeProfit === 'number' && p.takeProfit > 0) {
          lines[i]?.applyOptions({ price: p.takeProfit, title: 'TP' });
          i += 1;
        }
      }
    }
  }, [currentPrice, positions, decimals]);

  const hovered = hover ?? visible[visible.length - 1];
  // 本根 K 线自身涨跌（vs 开盘，TradingView 图例口径）：点数 + 幅度
  const barOpen = hovered?.open ?? 0;
  const barChange = hovered ? hovered.close - barOpen : 0;
  const barChangePct = barOpen > 0 ? (barChange / barOpen) * 100 : 0;

  // Indicator values at the hovered bar (TradingView legend parity). The SMA/EMA
  // arrays are recomputed only when the revealed slice changes (not on every
  // crosshair hover), then indexed by the hovered bar.
  // 均线值缓存（hover 索引用）：per 实例，仅 visible 变化重算，hover 不重算
  const computedArrays = useMemo(() => {
    const map: Record<string, Array<number | null>> = {};
    for (const inst of indicators) {
      if (!inst.visible || (inst.type !== 'sma' && inst.type !== 'ema')) continue;
      map[inst.id] =
        inst.type === 'sma'
            ? sma(visible, inst.params.period ?? 20)
            : ema(visible, inst.params.period ?? 50);
    }
    return map;
  }, [visible, indicators]);

  const indicatorValues = useMemo(() => {
    if (!hovered) return null;
    const idx = visible.findIndex((c) => c.time === hovered.time);
    if (idx < 0) return null;
    const out: Record<string, number | null> = {};
    for (const [id, arr] of Object.entries(computedArrays)) {
      out[id] = arr[idx] ?? null;
    }
    return out;
  }, [computedArrays, hovered, visible]);

  const selectedDrawing = selectedDrawingId
    ? (drawingEngineRef.current?.getDrawings().find((d) => d.id === selectedDrawingId) ?? null)
    : null;

  return (
    <div className="relative h-full w-full min-h-0">
      <div ref={containerRef} className="h-full w-full" aria-label="行情图表" />
      <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center">
        <span className="select-none font-mono text-[56px] font-black uppercase leading-none tracking-widest text-white/[0.04]">
          {candles.length === 0 ? '无数据' : replayActive ? '回放' : symbol}
        </span>
      </div>
      <div className="absolute bottom-2 left-2 z-[70] flex max-w-[calc(100%-16px)] items-start gap-2">
        <DrawingToolbar
          tool={tool}
          onToolChange={handleToolChange}
          magnetMode={magnetMode}
          onMagnetChange={handleMagnetChange}
          canUndo={canUndo}
          canRedo={canRedo}
          hasSelection={selectedDrawingId != null}
          hasDrawings={drawingsCount > 0}
          onUndo={() => drawingEngineRef.current?.undo()}
          onRedo={() => drawingEngineRef.current?.redo()}
          onDelete={() => drawingEngineRef.current?.deleteSelected()}
          onClear={() => drawingEngineRef.current?.clearAll()}
        />
        {selectedDrawingId != null && selectedDrawing && (
          <DrawingSettingsPanel
            drawing={selectedDrawing}
            decimals={decimals}
            onUpdateStyle={(partial) => {
              if (selectedDrawingId) {
                drawingEngineRef.current?.updateStyle(selectedDrawingId, partial);
              }
            }}
            onApplyPreset={(p) => {
              if (selectedDrawingId) {
                drawingEngineRef.current?.applyPreset(selectedDrawingId, p);
              }
            }}
            onSetText={(text) => {
              if (selectedDrawingId) {
                drawingEngineRef.current?.setText(selectedDrawingId, text);
              }
            }}
            onDuplicate={() => drawingEngineRef.current?.duplicateSelected()}
            onDelete={() => drawingEngineRef.current?.deleteSelected()}
            onLock={() => drawingEngineRef.current?.toggleLockSelected()}
            onHide={() => drawingEngineRef.current?.toggleVisibilitySelected()}
            onLayer={(dir) => {
              const engine = drawingEngineRef.current;
              if (!engine) return;
              if (dir === 'front') engine.toFrontSelected();
              else if (dir === 'back') engine.toBackSelected();
              else if (dir === 'forward') engine.bringForwardSelected();
              else if (dir === 'backward') engine.sendBackwardSelected();
            }}
            onClose={() => setSelectedDrawingId(null)}
          />
        )}
      </div>
      {/* SL/TP 线删除按钮：悬停线时浮出（交易所式） */}
      {hoverLevel && (
        <button
          type="button"
          data-level-del
          title={hoverLevel.kind === 'stop' ? '删除止损线' : '删除止盈线'}
          aria-label="删除该线"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            updateLevelsRef.current?.(
              hoverLevel.id,
              hoverLevel.kind === 'stop' ? { stopLoss: null } : { takeProfit: null },
            );
            setHoverLevel(null);
          }}
          className="absolute right-[72px] z-30 flex h-5 w-5 items-center justify-center rounded-sm border border-down/60 bg-bg-panel text-down shadow-neo-sm transition-colors hover:bg-down hover:text-white"
          style={{ top: Math.max(6, hoverLevel.y - 10) }}
        >
          <X size={11} />
        </button>
      )}

      {/* Top-right chart tools: go-to-time + price-scale reset (TradingView parity). */}
      <div className="absolute right-2 top-2 z-20 flex flex-col gap-1">
        <button
          type="button"
          title={chartType === 'candles' ? '切换为面积图' : '切换为蜡烛图'}
          aria-label="切换图表形态"
          aria-pressed={chartType === 'area'}
          onClick={() => setChartType((t) => (t === 'candles' ? 'area' : 'candles'))}
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-bg-border bg-bg-panel/95 text-text-secondary shadow-neo-sm transition-colors hover:border-accent hover:text-text-primary"
        >
          {chartType === 'candles' ? <CandlestickChart size={16} /> : <LineChart size={16} />}
        </button>
        <button
          type="button"
          title="跳转到时间 (Alt+G)"
          aria-label="跳转到时间"
          onClick={() => {
            const last = visible[visible.length - 1] ?? candles[candles.length - 1];
            if (last) {
              const d = new Date(last.time * 1000);
              const p = (n: number) => String(n).padStart(2, '0');
              setGotoValue(
                `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`,
              );
            }
            setGotoOpen(true);
          }}
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-bg-border bg-bg-panel/95 text-text-secondary shadow-neo-sm transition-colors hover:border-accent hover:text-text-primary"
        >
          <CalendarSearch size={14} />
        </button>
        {priceScaleManual && visible.length > 0 && (
          <button
            type="button"
            title="重置价格刻度"
            aria-label="重置价格刻度为自适应"
            onClick={() => {
              const cs = candleSeriesRef.current;
              if (!cs) return;
              const ps = cs.priceScale();
              const lr = chartRef.current?.timeScale().getVisibleLogicalRange();
              priceScaleManualRef.current = false;
              setPriceScaleManual(false);
              if (lr) fitPriceScaleToCandles(ps, visible.slice(Math.max(0, Math.floor(lr.from))));
            }}
            className="flex h-7 w-7 items-center justify-center rounded-sm border border-bg-border bg-bg-panel/95 text-text-secondary shadow-neo-sm transition-colors hover:border-accent hover:text-text-primary"
          >
            <ScanSearch size={14} />
          </button>
        )}
      </div>
      {gotoOpen && (
        <div
          className="absolute right-2 top-11 z-30 w-[264px] rounded-md border border-bg-border bg-bg-panel/95 p-3 shadow-neo backdrop-blur-sm animate-fade-in"
          onPointerDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="跳转到时间"
        >
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-bold text-text-primary">跳转到时间</span>
            <button
              type="button"
              onClick={() => setGotoOpen(false)}
              aria-label="关闭"
              className="text-text-muted hover:text-text-primary"
            >
              <X size={14} />
            </button>
          </div>
          <input
            type="datetime-local"
            value={gotoValue}
            onChange={(e) => setGotoValue(e.target.value)}
            aria-label="目标时间"
            className="h-8 w-full rounded-sm border border-bg-border bg-bg-elevated px-2 font-mono text-[13px] text-text-primary outline-none focus:border-accent"
          />
          {(() => {
            const first = candles[0];
            const last = candles[candles.length - 1];
            if (!first || !last) return null;
            return (
              <p className="mt-1.5 font-mono text-[11px] leading-snug text-text-muted">
                数据范围：{formatISODateTime(first.time)} ~ {formatISODateTime(last.time)}
              </p>
            );
          })()}
          <button
            type="button"
            onClick={() => {
              const ms = new Date(gotoValue).getTime();
              if (!Number.isFinite(ms)) return;
              const idx = nearestIndexByTime(candles, Math.floor(ms / 1000));
              if (idx < 0) return;
              const ts = chartRef.current?.timeScale();
              if (!ts) return;
              const span = 160;
              ts.setVisibleLogicalRange({
                from: Math.max(0, idx - Math.floor(span * 0.75)),
                to: idx + Math.ceil(span * 0.25),
              });
              const cs = candleSeriesRef.current;
              if (cs) fitPriceScaleToCandles(cs.priceScale(), candles.slice(Math.max(0, idx - span), idx + 40));
              atRightEdgeRef.current = false;
              setAwayFromEdge(true);
              setGotoOpen(false);
            }}
            autoFocus
            className="mt-2 w-full rounded-sm bg-accent px-3 py-2 text-[13px] font-bold text-white transition-colors hover:bg-accent-hover"
          >
            跳转
          </button>
        </div>
      )}
      {/* Back-to-latest: shown while scrolled away from the newest bar (TradingView parity). */}
      {awayFromEdge && visible.length > 0 && (
        <button
          title="回到最新 K 线"
          onClick={() => {
              const ts = chartRef.current?.timeScale();
              if (!ts) return;
              const r = ts.getVisibleLogicalRange();
              const span = r && r.to > r.from ? r.to - r.from : 160;
              const last = Math.max(0, visible.length - 1);
              atRightEdgeRef.current = true;
              ts.setVisibleLogicalRange({
                from: Math.max(0, last - span / 2),
                to: last + span / 2,
              });
            }}
          aria-label="跳到最新 K 线"
          className="absolute bottom-10 right-2 z-20 flex h-7 w-7 items-center justify-center rounded-sm border border-bg-border bg-bg-panel/95 text-text-secondary shadow-neo-sm transition-colors hover:border-accent hover:text-text-primary"
        >
          <ArrowRightToLine size={14} />
        </button>
      )}
      {/* Legend overlay */}
      <div
        className={`pointer-events-none absolute left-2 z-10 font-mono text-[13px] leading-relaxed text-text-secondary ${
          replayActive ? 'top-2 lg:top-[96px]' : 'top-2'
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text-primary">{symbol}</span>
          <span className="rounded-sm bg-bg-elevated px-1.5 py-px text-[12px] text-text-secondary">
            {timeframe}
          </span>
        </div>
        {hovered && (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
            <span>
              <span className="text-text-muted">开</span>{' '}
              <span className="text-text-primary">{formatPrice(hovered.open, decimals)}</span>
            </span>
            <span>
              <span className="text-text-muted">高</span>{' '}
              <span className="text-text-primary">{formatPrice(hovered.high, decimals)}</span>
            </span>
            <span>
              <span className="text-text-muted">低</span>{' '}
              <span className="text-text-primary">{formatPrice(hovered.low, decimals)}</span>
            </span>
            <span>
              <span className="text-text-muted">收</span>{' '}
              <span className={barChange >= 0 ? 'text-up' : 'text-down'}>
                {formatPrice(hovered.close, decimals)}
              </span>
            </span>
            <span>
              <span className="text-text-muted">量</span>{' '}
              <span className="text-text-primary">{formatVolume(hovered.volume)}</span>
            </span>
            <span className="text-text-muted">{formatCandleDate(hovered.time, timeframe)}</span>
            {hovered && (
              <span className={barChange >= 0 ? 'text-up' : 'text-down'}>
                {barChange >= 0 ? '▲' : '▼'}
                {' '}{barChange >= 0 ? '+' : '-'}
                {Math.abs(barChange).toFixed(decimals)} ({barChange >= 0 ? '+' : ''}
                {barChangePct.toFixed(2)}%)
              </span>
            )}
          </div>
        )}
        {/* 指标行（TradingView 式）：实例驱动，眼睛显隐 / 齿轮调参换色 / ✕ 删除 */}
        <div className="pointer-events-auto mt-1.5 flex flex-col items-start gap-0.5 text-[12px]">
          {indicators.map((inst) => {
            const def = defOf(inst.type);
            return (
              <IndRow
                key={inst.id}
                label={instanceLabel(inst)}
                value={def.showValue ? indicatorValues?.[inst.id] ?? null : undefined}
                rawValue={inst.type === 'volume' && hovered ? formatVolume(hovered.volume) : undefined}
                decimals={decimals}
                color={inst.color}
                visible={inst.visible}
                onToggle={() =>
                  onUpdateIndicators(
                    indicators.map((x) => (x.id === inst.id ? { ...x, visible: !x.visible } : x)),
                  )
                }
                onRemove={
                  def.max === 1
                    ? undefined
                    : () => onUpdateIndicators(indicators.filter((x) => x.id !== inst.id))
                }
                gear={
                  def.paramDefs.length === 0 && inst.type === 'volume' ? null : (
                    <span className="flex flex-wrap items-center gap-1">
                      {def.paramDefs.map((pd) => (
                        <ParamInput
                          key={pd.key}
                          label={pd.label}
                          value={inst.params[pd.key] ?? def.defaultParams[pd.key] ?? pd.min}
                          min={pd.min}
                          max={pd.max}
                          onCommit={(v) =>
                            onUpdateIndicators(
                              indicators.map((x) =>
                                x.id === inst.id ? { ...x, params: { ...x.params, [pd.key]: v } } : x,
                              ),
                            )
                          }
                        />
                      ))}
                      <span className="ml-1 flex items-center gap-1">
                        {(def.palette.length > 1 ? def.palette : ['#4f8cff', '#eab308', '#a855f7', '#22d3ee', '#f97316', '#ec4899']).map((c) => (
                          <button
                            key={c}
                            type="button"
                            title={`颜色 ${c}`}
                            aria-label={`颜色 ${c}`}
                            onClick={() =>
                              onUpdateIndicators(
                                indicators.map((x) => (x.id === inst.id ? { ...x, color: c } : x)),
                              )
                            }
                            className={`h-3.5 w-3.5 rounded-full border ${
                              inst.color === c ? 'border-white' : 'border-black/40'
                            } transition-transform hover:scale-110`}
                            style={{ backgroundColor: c }}
                          />
                        ))}
                      </span>
                    </span>
                  )
                }
              />
            );
          })}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="mt-0.5 flex items-center gap-1 rounded-sm px-1 py-px font-mono text-[11px] font-semibold text-accent transition-colors hover:bg-accent-dim"
          >
            <Plus size={11} /> 指标
          </button>
        </div>
      </div>

      {/* 指标选择器 */}
      {pickerOpen && (
        <div
          className="absolute left-2 top-24 z-30 w-[240px] rounded-md border border-bg-border bg-bg-panel/95 p-2 shadow-neo backdrop-blur-sm animate-fade-in"
          onPointerDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="添加指标"
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[13px] font-bold text-text-primary">添加指标</span>
            <button
              type="button"
              onClick={() => setPickerOpen(false)}
              aria-label="关闭"
              className="text-text-muted hover:text-text-primary"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex flex-col">
            {INDICATOR_REGISTRY.map((def) => {
              const count = indicators.filter((i) => i.type === def.type).length;
              const full = def.max !== undefined && count >= def.max;
              return (
                <button
                  key={def.type}
                  type="button"
                  disabled={full}
                  onClick={() => {
                    onUpdateIndicators([...indicators, createInstance(def.type, indicators)]);
                    setPickerOpen(false);
                  }}
                  className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: def.defaultColor }} />
                  <span className="flex-1">{def.name}</span>
                  <span className="text-[11px] text-text-muted">
                    {full ? '已添加' : def.max === 1 ? '' : '可多个'}
                  </span>
                  <Plus size={12} />
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-text-muted">
            同一指标可添加多个实例，参数与颜色独立。
          </p>
        </div>
      )}
    </div>
  );
}


function IndRow({
  label,
  value,
  rawValue,
  decimals,
  color,
  visible,
  onToggle,
  onRemove,
  gear,
}: {
  label: string;
  /** 数值型指标值（均线等） */
  value?: number | null;
  /** 已格式化的原始值（成交量等） */
  rawValue?: string | null;
  decimals?: number;
  color: string;
  visible: boolean;
  onToggle: () => void;
  onRemove?: () => void;
  gear: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-1 rounded-sm px-1 py-px transition-colors hover:bg-bg-hover/60">
      <button
        type="button"
        onClick={onToggle}
        title={visible ? '隐藏' : '显示'}
        className={`flex items-center gap-1 font-mono font-semibold ${visible ? '' : 'opacity-40'}`}
        style={{ color }}
      >
        {visible ? <Eye size={11} /> : <EyeOff size={11} />}
        {label}
      </button>
      {value !== undefined && (
        <span className="font-mono text-text-primary">
          {value !== null && value !== undefined && decimals !== undefined ? formatPrice(value, decimals) : '—'}
        </span>
      )}
      {rawValue !== undefined && <span className="font-mono text-text-primary">{rawValue ?? '—'}</span>}
      {gear && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="参数设置"
          className={`rounded-sm p-0.5 text-text-muted transition-colors hover:text-text-primary ${open ? 'text-accent' : ''}`}
        >
          <Settings2 size={11} />
        </button>
      )}
      {gear && open && gear}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title="删除该指标"
          aria-label="删除该指标"
          className="rounded-sm p-0.5 text-text-muted transition-colors hover:text-down"
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}

function ParamInput({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);
  return (
    <label className="ml-1 flex items-center gap-1 text-[11px] text-text-muted">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={focused ? draft : String(value)}
        onFocus={() => {
          setFocused(true);
          setDraft(String(value));
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setFocused(false);
          const n = Math.round(Number(draft));
          if (Number.isFinite(n) && n >= min) onCommit(Math.min(max, n));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className="h-6 w-[64px] rounded-sm border border-bg-border bg-bg-elevated px-1 font-mono text-[12px] text-text-primary outline-none focus:border-accent"
      />
    </label>
  );
}
