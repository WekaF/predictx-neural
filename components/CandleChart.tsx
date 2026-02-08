import React from 'react';
import { Candle, TradeSignal, BacktestTrade, TechnicalIndicators } from '../types';

interface CandleChartProps {
  data: Candle[];
  pendingSignal?: TradeSignal | null;
  activeTrade?: TradeSignal | null;
  trades?: BacktestTrade[];
  fibLevels?: TechnicalIndicators['fibLevels'];
}

const ModernCandleChart: React.FC<CandleChartProps> = ({ data, pendingSignal, activeTrade, trades = [], fibLevels }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [hoveredCandle, setHoveredCandle] = React.useState<Candle | null>(null);

  if (data.length === 0) return <div className="h-64 flex items-center justify-center text-slate-500">Loading Market Data...</div>;

  const maxPrice = Math.max(...data.map(c => c.high));
  const minPrice = Math.min(...data.map(c => c.low));
  const priceRange = maxPrice - minPrice;
  const padding = priceRange * 0.1;

  const getY = (price: number) => {
    return 100 - ((price - (minPrice - padding)) / (priceRange + padding * 2)) * 100;
  };

  // Helper to find X coordinate for a specific time string
  const getXForTime = (time: string) => {
    const index = data.findIndex(c => c.time === time);
    return index !== -1 ? index * 10 : -1;
  };

  return (
    <div className="relative w-full h-full min-h-[300px] bg-slate-950 border border-slate-800 rounded-lg overflow-hidden select-none" ref={containerRef}>
      {/* Grid Lines */}
      <div className="absolute inset-0 flex flex-col justify-between p-4 opacity-10 pointer-events-none">
        {[0, 1, 2, 3, 4].map(i => <div key={i} className="w-full h-px bg-slate-400"></div>)}
      </div>

      <svg className="w-full h-full p-4" viewBox={`0 0 ${data.length * 10} 100`} preserveAspectRatio="none">
        
        {/* Fibonacci Levels */}
        {fibLevels && Object.entries(fibLevels).map(([level, val]) => {
           const price = val as number;
           const y = getY(price);
           if (y < -10 || y > 110) return null; // Don't draw if far off screen
           
           // Format level name e.g. level618 -> 61.8%
           const label = level === 'level0' ? '0%' : 
                         level === 'level100' ? '100%' :
                         `${level.replace('level', '').replace(/(\d{2})(\d)/, '$1.$2')}%`;
            
           const isGolden = level === 'level618' || level === 'level500';

           return (
             <g key={level} opacity="0.6">
               <line 
                  x1="0" y1={y} x2={data.length * 10} y2={y} 
                  stroke={isGolden ? '#fbbf24' : '#64748b'} 
                  strokeWidth={isGolden ? 0.5 : 0.3} 
                  strokeDasharray="2 2" 
               />
               <text x={(data.length * 10) - 5} y={y - 1} textAnchor="end" fontSize="3" fill={isGolden ? '#fbbf24' : '#64748b'} fontWeight={isGolden ? 'bold' : 'normal'}>
                  {label} ({price.toFixed(2)})
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
          const color = isGreen ? '#10b981' : '#ef4444'; // emerald-500 : red-500

          return (
            <g key={`candle-${i}-${candle.time}`} 
               onMouseEnter={() => setHoveredCandle(candle)}
               className="hover:opacity-80 transition-opacity cursor-crosshair">
              {/* Wick */}
              <line x1={x + w/2} y1={yHigh} x2={x + w/2} y2={yLow} stroke={color} strokeWidth="0.5" />
              {/* Body */}
              <rect x={x} y={Math.min(yOpen, yClose)} width={w} height={Math.abs(yClose - yOpen) || 0.5} fill={color} />
            </g>
          );
        })}

        {/* Backtest Trades Visualization */}
        {trades.map((trade, i) => {
          const xEntry = getXForTime(trade.entryTime);
          const xExit = trade.exitTime ? getXForTime(trade.exitTime) : data.length * 10;
          
          if (xEntry === -1) return null;

          const yEntry = getY(trade.entryPrice);
          const yExit = trade.exitPrice ? getY(trade.exitPrice) : yEntry;
          
          const color = trade.outcome === 'WIN' ? '#10b981' : trade.outcome === 'LOSS' ? '#ef4444' : '#3b82f6';

          return (
            <g key={`trade-${i}`}>
              <circle cx={xEntry + 3} cy={yEntry} r="2" fill={trade.type === 'BUY' ? '#3b82f6' : '#f59e0b'} />
              {xExit > xEntry && (
                <line 
                    x1={xEntry + 3} y1={yEntry} x2={xExit + 3} y2={yExit} 
                    stroke={color} strokeWidth="0.5" strokeDasharray="1 1" opacity="0.8"
                />
              )}
              {trade.exitTime && <circle cx={xExit + 3} cy={yExit} r="2" fill={color} />}
            </g>
          );
        })}

        {/* PENDING Signal Overlay (Dashed, Lighter) */}
        {pendingSignal && (
            <g className="animate-pulse">
                <line x1="0" y1={getY(pendingSignal.entryPrice)} x2={data.length * 10} y2={getY(pendingSignal.entryPrice)} stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.7" />
                <line x1="0" y1={getY(pendingSignal.stopLoss)} x2={data.length * 10} y2={getY(pendingSignal.stopLoss)} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.7" />
                <line x1="0" y1={getY(pendingSignal.takeProfit)} x2={data.length * 10} y2={getY(pendingSignal.takeProfit)} stroke="#10b981" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.7" />
                
                <text x="5" y={getY(pendingSignal.entryPrice) - 2} fontSize="3" fill="#3b82f6" opacity="0.7">PENDING ENTRY</text>
                <text x="5" y={getY(pendingSignal.takeProfit) - 2} fontSize="3" fill="#10b981" opacity="0.7">TARGET</text>
            </g>
        )}

        {/* ACTIVE Trade Overlay (Solid, Bold) */}
        {activeTrade && activeTrade.outcome === 'PENDING' && (
            <g>
                <line x1="0" y1={getY(activeTrade.entryPrice)} x2={data.length * 10} y2={getY(activeTrade.entryPrice)} stroke="#3b82f6" strokeWidth="0.8" />
                <line x1="0" y1={getY(activeTrade.stopLoss)} x2={data.length * 10} y2={getY(activeTrade.stopLoss)} stroke="#ef4444" strokeWidth="0.8" />
                <line x1="0" y1={getY(activeTrade.takeProfit)} x2={data.length * 10} y2={getY(activeTrade.takeProfit)} stroke="#10b981" strokeWidth="0.8" />
                
                <text x={data.length * 10 - 5} y={getY(activeTrade.entryPrice) - 2} textAnchor="end" fontSize="3" fontWeight="bold" fill="#3b82f6">ACTIVE ENTRY</text>
                <text x={data.length * 10 - 5} y={getY(activeTrade.stopLoss) - 2} textAnchor="end" fontSize="3" fontWeight="bold" fill="#ef4444">STOP LOSS</text>
                <text x={data.length * 10 - 5} y={getY(activeTrade.takeProfit) - 2} textAnchor="end" fontSize="3" fontWeight="bold" fill="#10b981">TAKE PROFIT</text>
            </g>
        )}

      </svg>

      {/* Hover Info */}
      <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur border border-slate-700 p-2 rounded text-xs font-mono text-slate-300 pointer-events-none">
        {hoveredCandle ? (
          <div>
            <span className="mr-2 text-slate-400">{hoveredCandle.time}</span>
            <span className="mr-2">O: <span className="text-white">{hoveredCandle.open.toFixed(2)}</span></span>
            <span className="mr-2">H: <span className="text-white">{hoveredCandle.high.toFixed(2)}</span></span>
            <span className="mr-2">L: <span className="text-white">{hoveredCandle.low.toFixed(2)}</span></span>
            <span>C: <span className={hoveredCandle.close >= hoveredCandle.open ? "text-emerald-400" : "text-rose-400"}>{hoveredCandle.close.toFixed(2)}</span></span>
          </div>
        ) : (
          "Hover for OHLC"
        )}
      </div>
    </div>
  );
};

export default ModernCandleChart;