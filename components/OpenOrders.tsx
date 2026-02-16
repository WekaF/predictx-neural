import React, { useEffect, useState } from 'react';
import { RefreshCw, Trash2, ExternalLink, AlertCircle } from 'lucide-react';
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

export const OpenOrders: React.FC = () => {
  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch open orders for all symbols (or filter if needed, but API supports all)
      // Note: Futures API might require symbol, but we can iterate or use a specific one if needed.
      // For now, let's try strict "current asset" or "all". 
      // binanceTradingService.getOpenOrders() without symbol *might* fail on some endpoints if not supported globally.
      // Let's safe-guard by using the service's behavior.
      const data = await binanceTradingService.getOpenOrders(); 
      
      // Filter out only NEW or PARTIALLY_FILLED
      const active = Array.isArray(data) ? data : [];
      setOrders(active);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error('Failed to fetch open orders:', err);
      const detailedError = err.response?.data?.msg ? `API Error: ${err.response.data.msg}` : err.message;
      setError(`Error: ${detailedError}. Please check "Paper Trading" toggle.`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (symbol: string, orderId: number) => {
    if (!confirm('Cancel this order?')) return;
    
    try {
      await binanceTradingService.cancelOrder(symbol, orderId);
      fetchOrders(); // Refresh
    } catch (err) {
      alert('Failed to cancel order');
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000); // 10s polling
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="p-4 bg-red-900/20 border border-red-500 rounded-lg flex items-center gap-2 text-red-400 text-sm">
        <AlertCircle className="w-4 h-4" />
        {error}
        <button onClick={fetchOrders} className="ml-auto underline">Retry</button>
      </div>
    );
  }

  if (orders.length === 0 && !loading) {
    return null; // Don't show if empty to save space, or show placeholder?
  }

  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-slate-900/80 border-b border-slate-800 flex justify-between items-center">
        <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
          <ExternalLink className="w-4 h-4 text-blue-400" />
          Active Orders ({orders.length})
        </h3>
        <button 
          onClick={fetchOrders} 
          disabled={loading}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-400 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-900/30 text-slate-500 font-medium uppercase">
             <tr>
               <th className="px-4 py-2">Symbol</th>
               <th className="px-4 py-2">Date</th>
               <th className="px-4 py-2">Side</th>
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
                 <td className="px-4 py-2 font-bold text-slate-300">{order.symbol}</td>
                 <td className="px-4 py-2 text-slate-400">{new Date(order.time).toLocaleString()}</td>
                 <td className="px-4 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      order.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}>
                      {order.side}
                    </span>
                 </td>
                 <td className="px-4 py-2 text-slate-400">{order.type}</td>
                 <td className="px-4 py-2 text-right font-mono">{parseFloat(order.price) > 0 ? parseFloat(order.price).toFixed(2) : 'Market'}</td>
                 <td className="px-4 py-2 text-right font-mono">{order.origQty}</td>
                 <td className="px-4 py-2 text-right font-mono text-slate-400">
                    {((parseFloat(order.executedQty) / parseFloat(order.origQty)) * 100).toFixed(1)}%
                 </td>
                 <td className="px-4 py-2 text-center">
                   <button 
                     onClick={() => handleCancel(order.symbol, order.orderId)}
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
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                     No active orders
                  </td>
                </tr>
             )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
