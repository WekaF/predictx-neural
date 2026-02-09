import React, { useEffect, useState, useRef } from 'react';
import { ArrowDown, ArrowUp, Activity } from 'lucide-react';
import { connectOrderBookStream } from '../services/binanceService';

interface OrderBookProps {
  symbol: string;
}

interface OrderBookEntry {
  price: string;
  amount: string;
  total: number; // calculated total for depth visualization
}

export const OrderBook: React.FC<OrderBookProps> = ({ symbol }) => {
  const [bids, setBids] = useState<string[][]>([]);
  const [asks, setAsks] = useState<string[][]>([]);
  const [lastPrice, setLastPrice] = useState<number>(0);
  const [priceDirection, setPriceDirection] = useState<'UP' | 'DOWN'>('UP');

  useEffect(() => {
    let ws: WebSocket | null = null;
    let isActive = true;

    // Connect to WebSocket directly - no initial REST fetch needed
    // The @depth10@100ms stream provides snapshots, so we just update state
    ws = connectOrderBookStream(symbol, (data) => {
        if (!isActive) return;
        
        // Binance partial depth stream returns full lists for finite depth
        if (data.bids && data.bids.length > 0) setBids(data.bids);
        if (data.asks && data.asks.length > 0) setAsks(data.asks);
    });

    return () => {
        isActive = false;
        if (ws && typeof ws.close === 'function') ws.close();
    };
  }, [symbol]);

  // Update last price direction based on spread mid-point or top bid/ask
  useEffect(() => {
    if (bids.length > 0 && asks.length > 0) {
        const bestBid = parseFloat(bids[0][0]);
        const bestAsk = parseFloat(asks[0][0]);
        const mid = (bestBid + bestAsk) / 2;
        if (mid > lastPrice) setPriceDirection('UP');
        else if (mid < lastPrice) setPriceDirection('DOWN');
        setLastPrice(mid);
    }
  }, [bids, asks]);

  const maxTotal = Math.max(
      ...bids.slice(0, 10).map(b => parseFloat(b[1])),
      ...asks.slice(0, 10).map(a => parseFloat(a[1]))
  );

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-[300px]">
      <div className="p-2 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
        <h3 className="text-xs font-bold text-slate-400 flex items-center gap-1">
          <Activity className="w-3 h-3" /> ORDER BOOK
        </h3>
        <span className={`text-xs font-mono font-bold ${priceDirection === 'UP' ? 'text-emerald-400' : 'text-rose-400'}`}>
           {lastPrice.toFixed(2)} {priceDirection === 'UP' ? '↑' : '↓'}
        </span>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative text-[10px] font-mono">
        {/* ASKS (Sells) - Red - Reverse Order (Lowest Ask at bottom) */}
        <div className="flex-1 overflow-hidden flex flex-col justify-end pb-1 border-b border-slate-800/50">
             {asks.slice(0, 8).reverse().map((ask, i) => {
                 const price = parseFloat(ask[0]);
                 const amount = parseFloat(ask[1]);
                 const percent = (amount / maxTotal) * 100;
                 return (
                     <div key={`ask-${i}`} className="flex justify-between items-center px-2 py-0.5 relative group">
                         <div className="absolute right-0 top-0 bottom-0 bg-rose-500/10 transition-all duration-300" style={{ width: `${percent}%` }} />
                         <span className="text-rose-400 z-10 font-medium group-hover:text-rose-300">{price.toFixed(2)}</span>
                         <span className="text-slate-500 z-10">{amount.toFixed(4)}</span>
                     </div>
                 );
             })}
        </div>

        {/* BIDS (Buys) - Green */}
        <div className="flex-1 overflow-hidden flex flex-col pt-1">
             {bids.slice(0, 8).map((bid, i) => {
                 const price = parseFloat(bid[0]);
                 const amount = parseFloat(bid[1]);
                 const percent = (amount / maxTotal) * 100;
                 return (
                     <div key={`bid-${i}`} className="flex justify-between items-center px-2 py-0.5 relative group">
                         <div className="absolute right-0 top-0 bottom-0 bg-emerald-500/10 transition-all duration-300" style={{ width: `${percent}%` }} />
                         <span className="text-emerald-400 z-10 font-medium group-hover:text-emerald-300">{price.toFixed(2)}</span>
                         <span className="text-slate-500 z-10">{amount.toFixed(4)}</span>
                     </div>
                 );
             })}
        </div>
      </div>
    </div>
  );
};
