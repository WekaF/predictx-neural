import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Candle, TradeSignal, BacktestTrade, TechnicalIndicators } from '../types';
import { calculateSeriesSMA, calculateSeriesEMA, calculateSeriesBollinger, calculateSeriesRSI, calculateSeriesMACD, calculateSeriesKDJ } from '../utils/technical';
import { Activity, BarChart2, Layers } from 'lucide-react';

interface CandleChartProps {
  data: Candle[];
  pendingSignal?: TradeSignal | null;
  activeTrade?: TradeSignal | null;
  trades?: BacktestTrade[];
  fibLevels?: TechnicalIndicators['fibLevels'];
}

type OverlayType = 'MA' | 'EMA' | 'BOLL' | 'NONE';
type OscillatorType = 'VOL' | 'RSI' | 'MACD' | 'KDJ';

// --- INTERNAL MEMOIZED COMPONENTS ---

const StaticChartPlot = React.memo<{
    visibleData: Candle[];
    yLabels: { y: number; price: number }[];
    xLabels: { x: number; time: string }[];
    indicators: any;
    activeOverlay: OverlayType;
    activeOscillator: OscillatorType;
    fibLevels: any;
    maxVolume: number;
    pendingSignal: TradeSignal | null | undefined;
    activeTrade: TradeSignal | null | undefined;
    CHART_HEIGHT: number;
    OSCILLATOR_TOP: number;
    OSCILLATOR_HEIGHT: number;
    getY: (p: number) => number;
    getOscillatorY: (v: number, min: number, max: number) => number;
}>(({ 
    visibleData, yLabels, xLabels, indicators, activeOverlay, activeOscillator, 
    fibLevels, maxVolume, pendingSignal, activeTrade, CHART_HEIGHT, 
    OSCILLATOR_TOP, OSCILLATOR_HEIGHT, getY, getOscillatorY 
}) => {
    
    const drawLine = (values: (number | null)[], color: string, width: string = "0.5", yFn = getY) => {
        const points = values.map((v, i) => {
            if (v === null) return null;
            return `${i * 10 + 5},${yFn(v)}`;
        }).filter(p => p !== null).join(' ');
        return <polyline points={points} fill="none" stroke={color} strokeWidth={width} />;
    };

    return (
        <>
            {/* SVG CHART */}
            <svg className="w-full h-full" viewBox={`0 0 ${visibleData.length * 10} 100`} preserveAspectRatio="none">
                {/* Grid Lines (Horizontal) */}
                {yLabels.map((label, i) => (
                    <line key={`grid-y-${i}`} x1="0" y1={label.y} x2={visibleData.length * 10} y2={label.y} stroke="#334155" strokeWidth="0.1" strokeDasharray="2 2" />
                ))}
                {/* Oscillator Separator */}
                <line x1="0" y1={OSCILLATOR_TOP} x2={visibleData.length * 10} y2={OSCILLATOR_TOP} stroke="#334155" strokeWidth="0.2" />

                {/* --- MAIN CHART OVERLAYS --- */}
                {activeOverlay === 'MA' && (
                    <>
                        {drawLine(indicators.ma7, '#fbbf24', "0.4")}
                        {drawLine(indicators.ma25, '#8b5cf6', "0.4")}
                        {drawLine(indicators.ma99, '#06b6d4', "0.4")}
                    </>
                )}
                {activeOverlay === 'EMA' && (
                    <>
                        {drawLine(indicators.ema7, '#fbbf24', "0.4")}
                        {drawLine(indicators.ema25, '#8b5cf6', "0.4")}
                    </>
                )}
                {activeOverlay === 'BOLL' && (
                    <>
                        {drawLine(indicators.boll.upper, '#60a5fa', "0.3")}
                        {drawLine(indicators.boll.middle, '#fbbf24', "0.3")}
                        {drawLine(indicators.boll.lower, '#60a5fa', "0.3")}
                    </>
                )}

                {/* --- OSCILLATORS --- */}
                {activeOscillator === 'VOL' && visibleData.map((candle, i) => {
                    const x = i * 10;
                    const height = (candle.volume / maxVolume) * OSCILLATOR_HEIGHT;
                    const y = 100 - height;
                    const isGreen = candle.close >= candle.open;
                    return (
                        <rect key={`vol-${i}`} x={x + 1} y={y} width="8" height={height} fill={isGreen ? '#10b981' : '#ef4444'} opacity="0.3" />
                    );
                })}

                {/* RSI */}
                {activeOscillator === 'RSI' && (
                    <>
                        <rect x="0" y={getOscillatorY(70, 0, 100)} width={visibleData.length * 10} height={getOscillatorY(30, 0, 100) - getOscillatorY(70, 0, 100)} fill="#8b5cf6" opacity="0.1" />
                        <line x1="0" y1={getOscillatorY(70, 0, 100)} x2={visibleData.length * 10} y2={getOscillatorY(70, 0, 100)} stroke="#8b5cf6" strokeWidth="0.1" strokeDasharray="2 2" />
                        <line x1="0" y1={getOscillatorY(30, 0, 100)} x2={visibleData.length * 10} y2={getOscillatorY(30, 0, 100)} stroke="#8b5cf6" strokeWidth="0.1" strokeDasharray="2 2" />
                        {drawLine(indicators.rsi, '#c084fc', "0.4", (v) => getOscillatorY(v, 0, 100))}
                    </>
                )}

                {/* MACD */}
                {activeOscillator === 'MACD' && (
                    <>
                        <line x1="0" y1={getOscillatorY(0, -500, 500)} x2={visibleData.length * 10} y2={getOscillatorY(0, -500, 500)} stroke="#475569" strokeWidth="0.1" />
                        {(() => {
                            const allVals = [...indicators.macd.macd, ...indicators.macd.signal, ...indicators.macd.histogram].filter(v => v !== null) as number[];
                            const maxM = Math.max(...allVals, 0.0001);
                            const minM = Math.min(...allVals, -0.0001);
                            const absMax = Math.max(Math.abs(maxM), Math.abs(minM)) * 1.1;
                            const macdY = (v: number) => getOscillatorY(v, -absMax, absMax);
                            return (
                                <>
                                    {indicators.macd.histogram.map((h: any, i: number) => {
                                        if (h === null) return null;
                                        const y0 = macdY(0);
                                        const yVal = macdY(h);
                                        const height = Math.abs(yVal - y0);
                                        const y = Math.min(y0, yVal);
                                        const isGreen = h >= 0;
                                        return <rect key={`hist-${i}`} x={i*10 + 2} y={y} width="6" height={height} fill={isGreen ? '#10b981' : '#ef4444'} opacity="0.4" />
                                    })}
                                    {drawLine(indicators.macd.macd, '#ffffff', "0.3", macdY)}
                                    {drawLine(indicators.macd.signal, '#fbbf24', "0.3", macdY)}
                                </>
                            );
                        })()}
                    </>
                )}

                {/* KDJ */}
                {activeOscillator === 'KDJ' && (
                    <>
                        {drawLine(indicators.kdj.k, '#ffffff', "0.3", (v) => getOscillatorY(v, 0, 100))}
                        {drawLine(indicators.kdj.d, '#fbbf24', "0.3", (v) => getOscillatorY(v, 0, 100))}
                        {drawLine(indicators.kdj.j, '#c084fc', "0.3", (v) => getOscillatorY(v, 0, 100))}
                    </>
                )}

                {/* Fibonacci Levels */}
                {fibLevels && Object.entries(fibLevels).map(([level, val]) => {
                    const price = val as number;
                    const y = getY(price);
                    if (y < 0 || y > CHART_HEIGHT) return null;
                    const isGolden = level === 'level618' || level === 'level500';
                    return (
                        <g key={level}>
                            <line x1="0" y1={y} x2={visibleData.length * 10} y2={y} stroke={isGolden ? '#fbbf24' : '#64748b'} strokeWidth={isGolden ? 0.3 : 0.1} strokeDasharray="2 2" opacity="0.5" />
                            <text x={(visibleData.length * 10) - 2} y={y - 1} textAnchor="end" fontSize="2.5" fill={isGolden ? '#fbbf24' : '#64748b'}>{level.replace('level', '')}</text>
                        </g>
                    )
                })}

                {/* Candles */}
                {visibleData.map((candle, i) => {
                    const x = i * 10;
                    const yHigh = getY(candle.high);
                    const yLow = getY(candle.low);
                    const yOpen = getY(candle.open);
                    const yClose = getY(candle.close);
                    const color = candle.close >= candle.open ? '#10b981' : '#ef4444'; 
                    return (
                        <g key={`candle-${i}`}>
                            <line x1={x + 5} y1={yHigh} x2={x + 5} y2={yLow} stroke={color} strokeWidth="0.5" />
                            <rect x={x + 2} y={Math.min(yOpen, yClose)} width={6} height={Math.abs(yClose - yOpen) || 0.5} fill={color} />
                        </g>
                    );
                })}

                {/* Signals */}
                {pendingSignal && (
                    <g>
                        <line x1="0" y1={getY(pendingSignal.entryPrice)} x2={visibleData.length * 10} y2={getY(pendingSignal.entryPrice)} stroke="#3b82f6" strokeWidth="0.4" strokeDasharray="4 4" />
                        <line x1="0" y1={getY(pendingSignal.stopLoss)} x2={visibleData.length * 10} y2={getY(pendingSignal.stopLoss)} stroke="#ef4444" strokeWidth="0.4" strokeDasharray="4 4" />
                        <line x1="0" y1={getY(pendingSignal.takeProfit)} x2={visibleData.length * 10} y2={getY(pendingSignal.takeProfit)} stroke="#10b981" strokeWidth="0.4" strokeDasharray="4 4" />
                    </g>
                )}
                {activeTrade && activeTrade.outcome === 'PENDING' && (
                    <g>
                        <line x1="0" y1={getY(activeTrade.entryPrice)} x2={visibleData.length * 10} y2={getY(activeTrade.entryPrice)} stroke="#3b82f6" strokeWidth="0.5" />
                        <line x1="0" y1={getY(activeTrade.stopLoss)} x2={visibleData.length * 10} y2={getY(activeTrade.stopLoss)} stroke="#ef4444" strokeWidth="0.5" />
                        <line x1="0" y1={getY(activeTrade.takeProfit)} x2={visibleData.length * 10} y2={getY(activeTrade.takeProfit)} stroke="#10b981" strokeWidth="0.5" />
                    </g>
                )}
            </svg>

            {/* Price Axis */}
            <div className="absolute top-0 right-0 bottom-0 w-12 flex flex-col justify-between pointer-events-none text-[9px] font-mono text-slate-500 py-4 border-l border-slate-800/50 bg-slate-900/20">
                {yLabels.map((lbl, i) => (
                    <span key={i} className="absolute right-1" style={{ top: `${(lbl.y / 100) * 100}%`, transform: 'translateY(-50%)' }}>
                        {lbl.price.toFixed(2)}
                    </span>
                ))}
            </div>

            {/* Time Axis */}
            <div className="absolute bottom-0 left-0 right-12 h-6 flex pointer-events-none text-[9px] font-mono text-slate-500 border-t border-slate-800/50 bg-slate-900/20 overflow-hidden">
                {xLabels.map((lbl, i) => {
                    const visibleIndex = visibleData.indexOf(visibleData.find(c => c.time === lbl.time)!);
                    if (visibleIndex === -1) return null;
                    return (
                        <span key={i} className="absolute bottom-1 transform -translate-x-1/2 whitespace-nowrap" style={{ left: `${(visibleIndex / visibleData.length) * 100}%` }}>
                            {new Date(Number(lbl.time)).getHours()}:{String(new Date(Number(lbl.time)).getMinutes()).padStart(2, '0')}
                        </span>
                    );
                })}
            </div>
        </>
    );
});

const ModernCandleChart: React.FC<CandleChartProps> = ({ data, pendingSignal, activeTrade, trades = [], fibLevels }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState({ start: 0, count: 100, yOffset: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{x: number, y: number, start: number, yOffset: number} | null>(null);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);
  const [activeOverlay, setActiveOverlay] = useState<OverlayType>('MA');
  const [activeOscillator, setActiveOscillator] = useState<OscillatorType>('VOL');

  useEffect(() => {
    if (data.length > 0) {
        setViewState(prev => ({ ...prev, start: Math.max(0, data.length - prev.count) }));
    }
  }, [data.length]);

  const visibleData = useMemo(() => {
    if (data.length === 0) return [];
    const end = Math.min(data.length, viewState.start + viewState.count);
    return data.slice(viewState.start, end);
  }, [data, viewState.start, viewState.count]);

  const fullIndicators = useMemo(() => {
    if (data.length === 0) return null;
    const prices = data.map(c => c.close);
    return {
      ma7: calculateSeriesSMA(prices, 7),
      ma25: calculateSeriesSMA(prices, 25),
      ma99: calculateSeriesSMA(prices, 99),
      ema7: calculateSeriesEMA(prices, 7),
      ema25: calculateSeriesEMA(prices, 25),
      boll: calculateSeriesBollinger(prices, 20, 2),
      rsi: calculateSeriesRSI(prices, 14),
      macd: calculateSeriesMACD(prices, 12, 26, 9),
      kdj: calculateSeriesKDJ(data, 9, 3, 3)
    };
  }, [data]);

  const indicators = useMemo(() => {
      if (!fullIndicators) return { ma7: [], ma25: [], ma99: [], ema7: [], ema25: [], boll: { upper: [], middle: [], lower: [] }, rsi: [], macd: { macd: [], signal: [], histogram: [] }, kdj: { k: [], d: [], j: [] } };
      const sliceInd = (arr: (number | null)[]) => arr.slice(viewState.start, viewState.start + viewState.count);
      return {
          ma7: sliceInd(fullIndicators.ma7), ma25: sliceInd(fullIndicators.ma25), ma99: sliceInd(fullIndicators.ma99),
          ema7: sliceInd(fullIndicators.ema7), ema25: sliceInd(fullIndicators.ema25),
          boll: { upper: sliceInd(fullIndicators.boll.upper), middle: sliceInd(fullIndicators.boll.middle), lower: sliceInd(fullIndicators.boll.lower) },
          rsi: sliceInd(fullIndicators.rsi),
          macd: { macd: sliceInd(fullIndicators.macd.macd), signal: sliceInd(fullIndicators.macd.signal), histogram: sliceInd(fullIndicators.macd.histogram) },
          kdj: { k: sliceInd(fullIndicators.kdj.k), d: sliceInd(fullIndicators.kdj.d), j: sliceInd(fullIndicators.kdj.j) }
      };
  }, [fullIndicators, viewState.start, viewState.count]);

  // Calculate chart metrics (must be done before useMemo hooks)
  const maxPrice = visibleData.length > 0 ? Math.max(...visibleData.map(c => c.high)) : 0;
  const minPrice = visibleData.length > 0 ? Math.min(...visibleData.map(c => c.low)) : 0;
  const maxVolume = visibleData.length > 0 ? Math.max(...visibleData.map(c => c.volume)) : 1;
  
  const rawPriceRange = maxPrice - minPrice;
  const basePadding = rawPriceRange * 0.5; 
  const effectiveMin = (minPrice - basePadding) + viewState.yOffset;
  const effectiveMax = (maxPrice + basePadding) + viewState.yOffset;
  const effectiveRange = effectiveMax - effectiveMin || 1;

  const CHART_HEIGHT = 75; 
  const OSCILLATOR_HEIGHT = 20;
  const OSCILLATOR_TOP = 80;

  const getY = (price: number) => CHART_HEIGHT - ((price - effectiveMin) / effectiveRange) * CHART_HEIGHT;
  const getOscillatorY = (val: number, min: number, max: number) => {
      if (val === null || isNaN(val)) return OSCILLATOR_TOP + OSCILLATOR_HEIGHT;
      const range = max - min || 1;
      return OSCILLATOR_TOP + OSCILLATOR_HEIGHT - ((val - min) / range) * OSCILLATOR_HEIGHT;
  };

  // All useMemo hooks must be called before any conditional returns
  const yLabels = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const price = effectiveMin + (effectiveRange * (i / 5));
    return { y: getY(price), price };
  }), [effectiveMin, effectiveRange]);

  const xLabels = useMemo(() => data.filter((_, i) => i % 20 === 0).map((c) => ({
    x: (data.indexOf(c) * 10) + 5,
    time: c.time
  })), [data]);

  // Early return AFTER all hooks have been called
  if (data.length === 0) return <div className="h-64 flex items-center justify-center text-slate-500">Loading Market Data...</div>;

  const handleWheel = (e: React.WheelEvent) => {
      if (Math.abs(e.deltaY) < 1) return;
      e.preventDefault();
      const zoomSpeed = 0.05;
      const delta = Math.sign(e.deltaY);
      let change = Math.max(1, Math.floor(viewState.count * zoomSpeed)) * delta;
      let newCount = Math.min(Math.max(10, viewState.count + change), 1000);
      let newStart = Math.max(0, Math.min(viewState.start + (viewState.count - newCount), data.length - newCount));
      setViewState(prev => ({ ...prev, start: newStart, count: newCount }));
  };

  const handleZoom = (direction: 'in' | 'out') => {
      const zoomSpeed = 0.2;
      const delta = direction === 'out' ? 1 : -1;
      let change = Math.max(1, Math.floor(viewState.count * zoomSpeed)) * delta;
      let newCount = Math.min(Math.max(10, viewState.count + change), 1000);
      let newStart = Math.max(0, Math.min(viewState.start + (viewState.count - newCount), data.length - newCount));
      setViewState(prev => ({ ...prev, start: newStart, count: newCount }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY, start: viewState.start, yOffset: viewState.yOffset });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (isDragging && dragStart) {
          const deltaX = e.clientX - dragStart.x;
          const pixelPerCandle = rect.width / viewState.count;
          const candlesMoved = Math.round(deltaX / pixelPerCandle);
          let newStart = Math.max(0, Math.min(dragStart.start - candlesMoved, data.length - viewState.count));
          const deltaY = e.clientY - dragStart.y;
          const pricePerPixel = effectiveRange / (rect.height * 0.75);
          const newYOffset = dragStart.yOffset + (deltaY * pricePerPixel * 1.5);
          setViewState(prev => ({ ...prev, start: newStart, yOffset: newYOffset }));
          return; 
      }
      
      const candleWidth = rect.width / visibleData.length;
      const index = Math.floor(x / candleWidth);
      if (index >= 0 && index < visibleData.length) setHoveredCandle(visibleData[index]);
      setCursorPos({ x, y });
  };

  const handleMouseUp = () => { setIsDragging(false); setDragStart(null); };
  const handleMouseLeave = () => {
    if (isDragging) { setIsDragging(false); setDragStart(null); }
    setHoveredCandle(null); setCursorPos(null);
  };

  return (
    <div 
      className={`relative w-full h-full min-h-[300px] bg-slate-950 border border-slate-800 rounded-lg overflow-hidden select-none group ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    >
      <div className="absolute top-2 left-2 z-30 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="flex gap-1 bg-slate-900/80 p-1 rounded backdrop-blur">
             <button onClick={() => handleZoom('in')} className="text-[9px] px-1.5 py-0.5 rounded font-bold text-slate-400 hover:text-white hover:bg-slate-700">+</button>
             <button onClick={() => handleZoom('out')} className="text-[9px] px-1.5 py-0.5 rounded font-bold text-slate-400 hover:text-white hover:bg-slate-700">−</button>
          </div>
          <div className="flex gap-1 bg-slate-900/80 p-1 rounded backdrop-blur">
             {(['MA', 'EMA', 'BOLL'] as OverlayType[]).map(type => (
                 <button key={type} onClick={() => setActiveOverlay(activeOverlay === type ? 'NONE' : type)} className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${activeOverlay === type ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>{type}</button>
             ))}
          </div>
          <div className="flex gap-1 bg-slate-900/80 p-1 rounded backdrop-blur">
             {(['VOL', 'RSI', 'MACD', 'KDJ'] as OscillatorType[]).map(type => (
                 <button key={type} onClick={() => setActiveOscillator(type)} className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${activeOscillator === type ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}>{type}</button>
             ))}
          </div>
      </div>

      {/* MEMOIZED STATIC PLOT - This will NOT re-render on mouse moves! */}
      <StaticChartPlot 
        visibleData={visibleData}
        yLabels={yLabels}
        xLabels={xLabels}
        indicators={indicators}
        activeOverlay={activeOverlay}
        activeOscillator={activeOscillator}
        fibLevels={fibLevels}
        maxVolume={maxVolume}
        pendingSignal={pendingSignal}
        activeTrade={activeTrade}
        CHART_HEIGHT={CHART_HEIGHT}
        OSCILLATOR_TOP={OSCILLATOR_TOP}
        OSCILLATOR_HEIGHT={OSCILLATOR_HEIGHT}
        getY={getY}
        getOscillatorY={getOscillatorY}
      />
      
      {/* Interaction Overlay (Re-renders on mouse move, but it's tiny lines) */}
      {hoveredCandle && cursorPos && (
        <>
            <div className="absolute left-0 right-0 border-t border-white/20 border-dashed pointer-events-none" style={{ top: cursorPos.y }} />
            <div className="absolute top-0 bottom-0 border-l border-white/20 border-dashed pointer-events-none" style={{ left: cursorPos.x }} />
            <div className="absolute top-2 left-2 z-20 bg-slate-900/90 backdrop-blur border border-slate-700 p-2 rounded shadow-xl pointer-events-none mt-8">
                <div className="text-[10px] text-slate-400 mb-1 font-mono">{new Date(Number(hoveredCandle.time)).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs font-mono">
                    <span className="text-slate-500">Open:</span> <span>{hoveredCandle.open.toFixed(2)}</span>
                    <span className="text-slate-500">High:</span> <span className="text-emerald-400">{hoveredCandle.high.toFixed(2)}</span>
                    <span className="text-slate-500">Low:</span> <span className="text-rose-400">{hoveredCandle.low.toFixed(2)}</span>
                    <span className="text-slate-500">Close:</span> <span className={hoveredCandle.close >= hoveredCandle.open ? "text-emerald-400" : "text-rose-400"}>{hoveredCandle.close.toFixed(2)}</span>
                    <span className="text-slate-500">Vol:</span> <span className="text-yellow-400">{hoveredCandle.volume.toLocaleString()}</span>
                </div>
            </div>
        </>
      )}

      {activeTrade && activeTrade.outcome === 'PENDING' && (
          <div className="absolute top-1/2 right-14 transform -translate-y-1/2 flex flex-col items-end gap-1 pointer-events-none opacity-80">
              <span className="bg-emerald-500/20 text-emerald-400 text-[9px] px-1 rounded border border-emerald-500/30">TP: {activeTrade.takeProfit}</span>
              <span className="bg-blue-500/20 text-blue-400 text-[9px] px-1 rounded border border-blue-500/30">ENTRY: {activeTrade.entryPrice}</span>
              <span className="bg-rose-500/20 text-rose-400 text-[9px] px-1 rounded border border-rose-500/30">SL: {activeTrade.stopLoss}</span>
          </div>
      )}
    </div>
  );
};

export default React.memo(ModernCandleChart);