import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { Candle } from '../types';

interface RealtimePriceDisplayProps {
  symbol: string;
  candles: Candle[];
  trend?: 'UP' | 'DOWN' | 'SIDEWAYS';
  rsi?: number;
  sma200?: number;
}

export const RealtimePriceDisplay: React.FC<RealtimePriceDisplayProps> = ({ 
  symbol, 
  candles, 
  trend,
  rsi,
  sma200 
}) => {
  const [priceChange, setPriceChange] = useState<number>(0);
  const [priceChangePercent, setPriceChangePercent] = useState<number>(0);
  const [prevPrice, setPrevPrice] = useState<number>(0);
  const [flashColor, setFlashColor] = useState<string>('');

  const currentCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const currentPrice = currentCandle?.close || 0;
  const high24h = candles.length > 0 ? Math.max(...candles.slice(-96).map(c => c.high)) : 0; // Last 24h (assuming 15m candles)
  const low24h = candles.length > 0 ? Math.min(...candles.slice(-96).map(c => c.low)) : 0;
  const volume24h = candles.length > 0 ? candles.slice(-96).reduce((sum, c) => sum + c.volume, 0) : 0;

  // Calculate 24h change
  useEffect(() => {
    if (candles.length >= 96) {
      const price24hAgo = candles[candles.length - 96].close;
      const change = currentPrice - price24hAgo;
      const changePercent = (change / price24hAgo) * 100;
      setPriceChange(change);
      setPriceChangePercent(changePercent);
    }
  }, [candles, currentPrice]);

  // Flash effect on price change
  useEffect(() => {
    if (prevPrice > 0 && currentPrice !== prevPrice) {
      if (currentPrice > prevPrice) {
        setFlashColor('bg-emerald-500/20');
      } else {
        setFlashColor('bg-rose-500/20');
      }
      
      setTimeout(() => setFlashColor(''), 300);
    }
    setPrevPrice(currentPrice);
  }, [currentPrice]);

  if (!currentCandle) {
    return (
      <div className="flex items-center justify-center h-full text-slate-500">
        <Activity className="w-8 h-8 animate-pulse" />
        <span className="ml-2">Loading market data...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Main Price Display */}
      <div className={`flex-1 flex flex-col items-center justify-center transition-colors duration-300 ${flashColor}`}>
        <div className="text-center">
          <div className="text-slate-400 text-sm mb-2">{symbol}</div>
          <div className="text-5xl md:text-6xl font-bold text-white mb-2 font-mono">
            ${currentPrice.toFixed(2)}
          </div>
          <div className={`flex items-center justify-center gap-2 text-lg ${priceChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {priceChangePercent >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            <span className="font-bold">
              {priceChangePercent >= 0 ? '+' : ''}{priceChange.toFixed(2)} ({priceChangePercent.toFixed(2)}%)
            </span>
            <span className="text-slate-500 text-sm">24h</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-800">
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-slate-500 text-xs mb-1">24h High</div>
          <div className="text-emerald-400 font-bold font-mono">${high24h.toFixed(2)}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-slate-500 text-xs mb-1">24h Low</div>
          <div className="text-rose-400 font-bold font-mono">${low24h.toFixed(2)}</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-slate-500 text-xs mb-1">24h Volume</div>
          <div className="text-blue-400 font-bold font-mono">{(volume24h / 1000000).toFixed(2)}M</div>
        </div>
        <div className="bg-slate-800/50 rounded-lg p-3">
          <div className="text-slate-500 text-xs mb-1">Trend</div>
          <div className={`font-bold ${trend === 'UP' ? 'text-emerald-400' : trend === 'DOWN' ? 'text-rose-400' : 'text-slate-400'}`}>
            {trend || 'SIDEWAYS'}
          </div>
        </div>
      </div>

      {/* Technical Indicators */}
      {(rsi !== undefined || sma200 !== undefined) && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          {rsi !== undefined && (
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-slate-500 text-xs mb-1">RSI (14)</div>
              <div className={`font-bold font-mono ${rsi > 70 ? 'text-rose-400' : rsi < 30 ? 'text-emerald-400' : 'text-slate-200'}`}>
                {rsi.toFixed(1)}
              </div>
            </div>
          )}
          {sma200 !== undefined && (
            <div className="bg-slate-800/50 rounded-lg p-3">
              <div className="text-slate-500 text-xs mb-1">SMA 200</div>
              <div className="text-slate-200 font-bold font-mono">${sma200.toFixed(2)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
