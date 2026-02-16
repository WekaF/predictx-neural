import React, { useEffect, useState } from 'react';
import { RefreshCw, Trash2, ExternalLink, AlertCircle, Layers, List, XCircle } from 'lucide-react';
import binanceTradingService from '../services/binanceTradingService';

interface OpenOrder {
  orderId: number;
  symbol: string;
  status: string;
  type: string;
  side: string;
  price: string;
  origQty: string;
  executedQty: string;
  time: number;
}

interface Position {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  marginType: string;
  isolatedWallet: string;
}

interface OpenOrdersProps {
  onTradeClosed?: (trade: any) => void;
}

export const OpenOrders: React.FC<OpenOrdersProps> = ({ onTradeClosed }) => {
  const [activeTab, setActiveTab] = useState<'positions' | 'orders'>('positions');
  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch both orders and positions in parallel
      const [ordersData, positionsData] = await Promise.all([
        binanceTradingService.getOpenOrders(),
        binanceTradingService.getPositions()
      ]);
      
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setPositions(Array.isArray(positionsData) ? positionsData : []);
      
    } catch (err: any) {
      console.error('Failed to fetch trading data:', err);
      const detailedError = err.response?.data?.msg ? `API Error: ${err.response.data.msg}` : err.message;
      setError(`Error: ${detailedError}. Please check "Paper Trading" toggle.`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (symbol: string, orderId: number) => {
    if (!confirm('Cancel this order?')) return;
    try {
      await binanceTradingService.cancelOrder(symbol, orderId);
      fetchData(); 
    } catch (err) {
      alert('Failed to cancel order');
    }
  };

  const handleClosePosition = async (symbol: string, amount: string) => {
    if (!confirm(`Close ${symbol} position? This will execute a MARKET order.`)) return;
    try {
      await binanceTradingService.closePosition(symbol, amount);
      
      // Wait a bit for order to fill, then refresh and capture history
      setTimeout(async () => {
          fetchData();
          
          // Capture trade for history
          if (onTradeClosed) {
             try {
                 console.log(`[OpenOrders] Fetching latest trade for ${symbol} to save history...`);
                 const trades = await binanceTradingService.getTradeHistory(symbol, 1);
                 
                 if (trades && trades.length > 0) {
                     const lastTrade = trades[0];
                     console.log('[OpenOrders] Latest trade found:', lastTrade);
                     
                     // Check if it's very recent (within last 15 seconds) to avoid duping old trades
                     // Binance timestamps are in ms
                     const timeDiff = Date.now() - lastTrade.time;
                     if (timeDiff < 15000) {
                         onTradeClosed(lastTrade);
                     } else {
                         console.log(`[OpenOrders] Trade too old (${timeDiff}ms), skipping history save.`);
                     }
                 }
             } catch (e) {
                 console.error("Failed to fetch trade history after close:", e);
             }
          }
      }, 1500); // 1.5s delay to ensure fill
      
    } catch (err: any) {
       console.error(err);
       alert(`Failed to close position.`);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5s for realtime-ish updates
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-500 rounded-lg flex items-center gap-2 text-red-400 text-sm mb-4">
        <AlertCircle className="w-4 h-4" />
        {error}
        <button onClick={fetchData} className="ml-auto underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden flex flex-col h-full">
      {/* Header & Tabs */}
      <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 flex justify-between items-center">
        <div className="flex gap-4">
            <button 
                onClick={() => setActiveTab('positions')}
                className={`flex items-center gap-2 text-sm font-bold transition-colors ${
                    activeTab === 'positions' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
                }`}
            >
                <Layers className="w-4 h-4" />
                Positions ({positions.length})
            </button>
            <button 
                onClick={() => setActiveTab('orders')}
                className={`flex items-center gap-2 text-sm font-bold transition-colors ${
                    activeTab === 'orders' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
                }`}
            >
                <List className="w-4 h-4" />
                Open Orders ({orders.length})
            </button>
        </div>

        <button 
          onClick={fetchData} 
          disabled={loading}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-400 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="overflow-x-auto">
        {activeTab === 'positions' ? (
            /* POSITIONS TABLE */
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900/30 text-slate-500 font-medium uppercase">
                 <tr>
                   <th className="px-4 py-2">Symbol</th>
                   <th className="px-4 py-2 text-right">Size (Notional)</th>
                   <th className="px-4 py-2 text-right">Entry Price</th>
                   <th className="px-4 py-2 text-right">Mark Price</th>
                   <th className="px-4 py-2 text-right">Margin</th>
                   <th className="px-4 py-2 text-right">Liq. Price</th>
                   <th className="px-4 py-2 text-right">PNL (ROE)</th>
                   <th className="px-4 py-2 text-center">Action</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                 {positions.map((pos, idx) => {
                     const size = parseFloat(pos.positionAmt);
                     const entryPrice = parseFloat(pos.entryPrice);
                     const markPrice = parseFloat(pos.markPrice);
                     const leverage = parseFloat(pos.leverage);
                     const pnl = parseFloat(pos.unRealizedProfit);
                     
                     // Notional Value = Size * Mark Price
                     const notionalValue = Math.abs(size) * markPrice;
                     
                     // Initial Margin = Notional / Leverage
                     // For Isolated, might use isolatedWallet, but for ROE calculation standard is usually based on required margin
                     const initialMargin = notionalValue / leverage;
                     
                     // ROE %
                     const roe = initialMargin > 0 ? (pnl / initialMargin) * 100 : 0;
                     const isLong = size > 0;

                     return (
                       <tr key={`${pos.symbol}-${idx}`} className="hover:bg-slate-800/20 transition-colors">
                         <td className="px-4 py-2">
                             <div className="font-bold text-slate-300">{pos.symbol}</div>
                             <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                 <span className={`font-bold px-1 rounded ${isLong ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                     {isLong ? 'LONG' : 'SHORT'}
                                 </span>
                                 <span className="bg-slate-800 px-1 rounded">{pos.leverage}x</span>
                                 <span>{pos.marginType === 'isolated' ? 'Isolated' : 'Cross'}</span>
                             </div>
                         </td>
                         <td className={`px-4 py-2 text-right font-mono ${isLong ? 'text-emerald-400' : 'text-rose-400'}`}>
                             <div>{size}</div>
                             <div className="text-[10px] text-slate-500">{notionalValue.toLocaleString(undefined, {maximumFractionDigits:0})} USDT</div>
                         </td>
                         <td className="px-4 py-2 text-right font-mono text-slate-300">
                             {entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                         </td>
                         <td className="px-4 py-2 text-right font-mono text-slate-400">
                             {markPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                         </td>
                         <td className="px-4 py-2 text-right font-mono text-slate-300">
                             {initialMargin.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDT
                         </td>
                         <td className="px-4 py-2 text-right font-mono text-orange-400">
                             {parseFloat(pos.liquidationPrice) === 0 ? '-' : parseFloat(pos.liquidationPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                         </td>
                         <td className={`px-4 py-2 text-right font-mono font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                             <div>{pnl > 0 ? '+' : ''}{pnl.toFixed(2)} USDT</div>
                             <div className="text-[10px] opacity-80">{roe.toFixed(2)}%</div>
                         </td>
                         <td className="px-4 py-2 text-center">
                            <button 
                                onClick={() => handleClosePosition(pos.symbol, pos.positionAmt)}
                                className="flex items-center justify-center gap-1 px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 rounded transition-colors text-[10px] font-bold"
                                title="Close Position (Market)"
                            >
                                <XCircle className="w-3.5 h-3.5" />
                                Close
                            </button>
                         </td>
                       </tr>
                     );
                 })}
                 {positions.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                         No active positions
                      </td>
                    </tr>
                 )}
              </tbody>
            </table>
        ) : (
            /* ORDERS TABLE */
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-900/30 text-slate-500 font-medium uppercase">
                 <tr>
                   <th className="px-4 py-2">Symbol</th>
                   <th className="px-4 py-2">Type</th>
                   <th className="px-4 py-2 text-right">Price</th>
                   <th className="px-4 py-2 text-right">Amount</th>
                   <th className="px-4 py-2 text-right">Filled</th>
                   <th className="px-4 py-2 text-center">Action</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                 {orders.map(order => (
                   <tr key={order.orderId} className="hover:bg-slate-800/20 transition-colors">
                     <td className="px-4 py-2">
                         <div className="font-bold text-slate-300">{order.symbol}</div>
                         <div className={`text-[10px] font-bold inline-block px-1 rounded ${
                             order.side === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                         }`}>
                             {order.side}
                         </div>
                     </td>
                     <td className="px-4 py-2 text-slate-400">{order.type}</td>
                     <td className="px-4 py-2 text-right font-mono">{parseFloat(order.price) > 0 ? parseFloat(order.price).toFixed(2) : 'Market'}</td>
                     <td className="px-4 py-2 text-right font-mono">{order.origQty}</td>
                     <td className="px-4 py-2 text-right font-mono text-slate-400">
                        {((parseFloat(order.executedQty) / parseFloat(order.origQty)) * 100).toFixed(1)}%
                     </td>
                     <td className="px-4 py-2 text-center">
                       <button 
                         onClick={() => handleCancelOrder(order.symbol, order.orderId)}
                         className="p-1 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 rounded transition-colors"
                         title="Cancel Order"
                       >
                         <Trash2 className="w-3.5 h-3.5" />
                       </button>
                     </td>
                   </tr>
                 ))}
                 {orders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                         No active orders
                      </td>
                    </tr>
                 )}
              </tbody>
            </table>
        )}
      </div>
    </div>
  );
};
