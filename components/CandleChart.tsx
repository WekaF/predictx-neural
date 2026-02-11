import React, { useState, useRef, useEffect } from 'react';
import { Candle, TradeSignal, BacktestTrade, TechnicalIndicators, SMCAnalysis } from '../types';

interface CandleChartProps {
  data: Candle[];
  pendingSignal?: TradeSignal | null;
  activeTrade?: TradeSignal | null;
  trades?: BacktestTrade[];
  fibLevels?: TechnicalIndicators['fibLevels'];
  smcAnalysis?: SMCAnalysis;
}

const ModernCandleChart: React.FC<CandleChartProps> = ({ data, pendingSignal, activeTrade, trades = [], fibLevels, smcAnalysis }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [cursorPos, setCursorPos] = useState<{x: number, y: number} | null>(null);

  if (data.length === 0) return <div className="h-64 flex items-center justify-center text-slate-500">Loading Market Data...</div>;

  const validData = data.filter(c => !isNaN(c.high) && !isNaN(c.low) && !isNaN(c.open) && !isNaN(c.close));

  if (validData.length === 0) return <div className="h-64 flex items-center justify-center text-slate-500">Invalid Data</div>;

  const maxPrice = Math.max(...validData.map(c => c.high));
  const minPrice = Math.min(...validData.map(c => c.low));
  const maxVolume = Math.max(...validData.map(c => c.volume));
  
  // Prevent division by zero if price range is huge or zero
  const priceRange = maxPrice === minPrice ? maxPrice * 0.1 : maxPrice - minPrice;
  const padding = priceRange * 0.1;

  // Chart dimensions in percentage (SVG viewbox 0-100)
  const CHART_HEIGHT = 80;
  const VOLUME_HEIGHT = 20;

  const getY = (price: number) => {
    if (isNaN(price) || price === undefined || price === null || priceRange === 0) return 0;
    const y = CHART_HEIGHT - ((price - (minPrice - padding)) / (priceRange + padding * 2)) * CHART_HEIGHT;
    return isNaN(y) ? 0 : y;
  };

  const getXForTime = (time: string) => {
    const index = data.findIndex(c => c.time === time);
    return index !== -1 ? index * 10 + 5 : -1; // Center of candle
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Calculate index from x
    const candleWidth = rect.width / data.length;
    const index = Math.floor(x / candleWidth);
    
    if (index >= 0 && index < data.length) {
      setHoveredCandle(data[index]);
    }
    setCursorPos({ x, y });
  };

  const handleMouseLeave = () => {
    setHoveredCandle(null);
    setCursorPos(null);
  };

  // Generate Y-axis labels (Price)
  const yLabels = Array.from({ length: 6 }, (_, i) => {
    const price = minPrice + (priceRange * (i / 5));
    return { y: getY(price), price };
  });

  // Generate X-axis labels (Time) - Show every 20th candle
  const xLabels = data.filter((_, i) => i % 20 === 0).map((c, i) => ({
    x: (data.indexOf(c) * 10) + 5,
    time: c.time
  }));

  return (
    <div 
      className="relative w-full h-full min-h-[300px] bg-slate-950 border border-slate-800 rounded-lg overflow-hidden select-none cursor-crosshair" 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      
      {/* SVG CHART */}
      <svg className="w-full h-full" viewBox={`0 0 ${data.length * 10} 100`} preserveAspectRatio="none">
        
        {/* Grid Lines (Horizontal) */}
        {yLabels.map((label, i) => (
            <line key={`grid-y-${i}`} x1="0" y1={label.y} x2={data.length * 10} y2={label.y} stroke="#334155" strokeWidth="0.1" strokeDasharray="2 2" />
        ))}

        {/* Volume Bars (Bottom) */}
        {data.map((candle, i) => {
            const x = i * 10;
            const height = (candle.volume / maxVolume) * VOLUME_HEIGHT;
            const y = 100 - height;
            const isGreen = candle.close >= candle.open;
            return (
                <rect key={`vol-${i}`} x={x + 1} y={y} width="8" height={height} fill={isGreen ? '#10b981' : '#ef4444'} opacity="0.2" />
            );
        })}

        {/* Fibonacci Levels */}
        {fibLevels && Object.entries(fibLevels).map(([level, val]) => {
           const price = val as number;
           const y = getY(price);
           if (y < 0 || y > CHART_HEIGHT) return null;
           
           const isGolden = level === 'level618' || level === 'level500';

           return (
             <g key={level}>
               <line 
                  x1="0" y1={y} x2={data.length * 10} y2={y} 
                  stroke={isGolden ? '#fbbf24' : '#64748b'} 
                  strokeWidth={isGolden ? 0.3 : 0.1} 
                  strokeDasharray="2 2" 
                  opacity="0.5"
               />
               <text x={(data.length * 10) - 2} y={y - 1} textAnchor="end" fontSize="2.5" fill={isGolden ? '#fbbf24' : '#64748b'}>
                  {level.replace('level', '')}
               </text>
             </g>
           )
        })}

        {/* Candles */}
        {data.map((candle, i) => {
          const x = i * 10;
          const w = 6;
          const yHigh = getY(candle.high);
          const yLow = getY(candle.low);
          const yOpen = getY(candle.open);
          const yClose = getY(candle.close);
          const isGreen = candle.close >= candle.open;
          const color = isGreen ? '#10b981' : '#ef4444'; 

          return (
            <g key={`candle-${i}`}>
              <line x1={x + 5} y1={yHigh} x2={x + 5} y2={yLow} stroke={color} strokeWidth="0.5" />
              <rect x={x + 2} y={Math.min(yOpen, yClose)} width={w} height={Math.abs(yClose - yOpen) || 0.5} fill={color} />
            </g>
          );
        })}

        {/* SMC: Order Blocks */}
        {smcAnalysis && smcAnalysis.orderBlocks.map((ob, i) => {
             let startIndex = data.findIndex(c => new Date(c.time).getTime() === ob.timestamp);
             
             if (startIndex === -1) {
                 if (data.length > 0 && ob.timestamp < new Date(data[0].time).getTime()) startIndex = 0;
                 else return null;
             }

             const x = startIndex * 10;
             const width = (data.length * 10) - x;
             const yTop = getY(ob.top);
             const yBottom = getY(ob.bottom);
             const height = Math.abs(yBottom - yTop);
             
             return (
                 <g key={`ob-${i}`}>
                    <rect 
                        x={x} 
                        y={Math.min(yTop, yBottom)} 
                        width={width} 
                        height={height} 
                        fill={ob.type === 'BULLISH' ? '#10b981' : '#ef4444'} 
                        opacity={ob.type === 'BULLISH' ? "0.15" : "0.1"} 
                    />
                    {startIndex >= 0 && startIndex < data.length - 10 && (
                        <text x={x + 2} y={Math.min(yTop, yBottom) - 2} fontSize="2" fill={ob.type === 'BULLISH' ? '#10b981' : '#ef4444'} opacity="0.7">
                            {ob.type === 'BULLISH' ? 'Bullish OB' : 'Bearish OB'}
                        </text>
                    )}
                 </g>
             );
        })}

        {/* SMC: Fair Value Gaps */}
        {smcAnalysis && smcAnalysis.fairValueGaps.map((fvg, i) => {
             let startIndex = data.findIndex(c => new Date(c.time).getTime() === fvg.timestamp);
             
             if (startIndex === -1) {
                 if (data.length > 0 && fvg.timestamp < new Date(data[0].time).getTime()) startIndex = 0;
                 else return null;
             }

             const x = startIndex * 10;
             const width = (data.length * 10) - x;
             const yTop = getY(fvg.top);
             const yBottom = getY(fvg.bottom);
             const height = Math.abs(yBottom - yTop);
             
             return (
                 <rect 
                    key={`fvg-${i}`} 
                    x={x} 
                    y={Math.min(yTop, yBottom)} 
                    width={width} 
                    height={height} 
                    fill={fvg.type === 'BULLISH' ? '#fbbf24' : '#fbbf24'} 
                    opacity="0.08" 
                 />
             );
        })}

        {/* Pending Signal */}
        {pendingSignal && (
            <g>
                <line x1="0" y1={getY(pendingSignal.entryPrice)} x2={data.length * 10} y2={getY(pendingSignal.entryPrice)} stroke="#3b82f6" strokeWidth="0.4" strokeDasharray="4 4" />
                <line x1="0" y1={getY(pendingSignal.stopLoss)} x2={data.length * 10} y2={getY(pendingSignal.stopLoss)} stroke="#ef4444" strokeWidth="0.4" strokeDasharray="4 4" />
                <line x1="0" y1={getY(pendingSignal.takeProfit)} x2={data.length * 10} y2={getY(pendingSignal.takeProfit)} stroke="#10b981" strokeWidth="0.4" strokeDasharray="4 4" />
            </g>
        )}

        {/* Active Trade */}
        {activeTrade && activeTrade.outcome === 'PENDING' && (
            <g>
                <line x1="0" y1={getY(activeTrade.entryPrice)} x2={data.length * 10} y2={getY(activeTrade.entryPrice)} stroke="#3b82f6" strokeWidth="0.5" />
                <line x1="0" y1={getY(activeTrade.stopLoss)} x2={data.length * 10} y2={getY(activeTrade.stopLoss)} stroke="#ef4444" strokeWidth="0.5" />
                <line x1="0" y1={getY(activeTrade.takeProfit)} x2={data.length * 10} y2={getY(activeTrade.takeProfit)} stroke="#10b981" strokeWidth="0.5" />
            </g>
        )}
      </svg>
      
      {/* OVERLAY ELEMENTS (HTML) for clearer text */}
      
      {/* Price Axis (Right) */}
      <div className="absolute top-0 right-0 bottom-0 w-12 flex flex-col justify-between pointer-events-none text-[9px] font-mono text-slate-500 py-4 border-l border-slate-800/50 bg-slate-900/20">
         {yLabels.map((lbl, i) => (
             <span key={i} className="absolute right-1" style={{ top: `${(lbl.y / 100) * 100}%`, transform: 'translateY(-50%)' }}>
                 {lbl.price.toFixed(2)}
             </span>
         ))}
      </div>

      {/* Time Axis (Bottom) */}
      <div className="absolute bottom-0 left-0 right-12 h-6 flex pointer-events-none text-[9px] font-mono text-slate-500 border-t border-slate-800/50 bg-slate-900/20 overflow-hidden">
         {xLabels.map((lbl, i) => (
             <span key={i} className="absolute bottom-1 transform -translate-x-1/2 whitespace-nowrap" style={{ left: `${(data.indexOf(data.find(c => c.time === lbl.time)!) / data.length) * 100}%` }}>
                 {new Date(lbl.time).getHours()}:{String(new Date(lbl.time).getMinutes()).padStart(2, '0')}
             </span>
         ))}
      </div>

      {/* Crosshair & Tooltip */}
      {hoveredCandle && cursorPos && (
        <>
            {/* Horizontal Line (Price) */}
            <div className="absolute left-0 right-0 border-t border-white/20 border-dashed pointer-events-none" style={{ top: cursorPos.y }} />
            {/* Vertical Line (Time) */}
            <div className="absolute top-0 bottom-0 border-l border-white/20 border-dashed pointer-events-none" style={{ left: cursorPos.x }} />
            
            {/* Hover Tooltip */}
            <div className="absolute top-2 left-2 z-20 bg-slate-900/90 backdrop-blur border border-slate-700 p-2 rounded shadow-xl pointer-events-none">
                <div className="text-[10px] text-slate-400 mb-1 font-mono">{hoveredCandle.time}</div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs font-mono">
                    <span className="text-slate-500">Open:</span> <span className="text-slate-200">{hoveredCandle.open.toFixed(2)}</span>
                    <span className="text-slate-500">High:</span> <span className="text-emerald-400">{hoveredCandle.high.toFixed(2)}</span>
                    <span className="text-slate-500">Low:</span> <span className="text-rose-400">{hoveredCandle.low.toFixed(2)}</span>
                    <span className="text-slate-500">Close:</span> <span className={hoveredCandle.close >= hoveredCandle.open ? "text-emerald-400" : "text-rose-400"}>{hoveredCandle.close.toFixed(2)}</span>
                    <span className="text-slate-500">Vol:</span> <span className="text-yellow-400">{hoveredCandle.volume.toLocaleString()}</span>
                </div>
            </div>
            
            {/* Price Cursor Label on Axis */}
           {/* We can calculate the price at cursor Y, but simple visual crosshair is good for now */}
        </>
      )}

      {/* Signal Badges */}
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

export default ModernCandleChart;