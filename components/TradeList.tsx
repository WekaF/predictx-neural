import React from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { BacktestTrade, ExecutedTrade } from '../types';

interface TradeListProps {
  trades: (BacktestTrade | ExecutedTrade)[];
}

const TradeList: React.FC<TradeListProps> = ({ trades }) => {
  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-slate-500">
        <p className="text-sm">No trades executed yet.</p>
      </div>
    );
  }

  // Sort trades by entry time (newest first) to ensure correct order
  const sortedTrades = [...trades].sort((a, b) => {
    const timeA = new Date(a.exitTime || a.entryTime).getTime();
    const timeB = new Date(b.exitTime || b.entryTime).getTime();
    return timeB - timeA; // Descending order (newest first)
  });

  // Format timestamp to readable format
  const formatTime = (timestamp: string | undefined): string => {
    if (!timestamp) return 'N/A';
    
    try {
      const date = new Date(timestamp);
      
      // Check if date is valid
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      
      return date.toLocaleString('id-ID', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error(`[TradeList] Error formatting timestamp: ${timestamp}`, error);
      return 'Invalid Date';
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead className="text-slate-500 bg-slate-900/50 uppercase font-bold border-b border-slate-800">
          <tr>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Asset</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Entry</th>
            <th className="px-4 py-3">Exit</th>
            <th className="px-4 py-3">PNL</th>
            <th className="px-4 py-3">Outcome</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {sortedTrades.map((trade) => (
            <tr key={trade.id} className="hover:bg-slate-800/30 transition-colors">
              <td className="px-4 py-3 font-mono text-slate-400">
                {formatTime(trade.exitTime || trade.entryTime)}
              </td>
              <td className="px-4 py-3 font-bold text-slate-300">
                {trade.symbol || 'BTC/USDT'}
              </td>
              <td className="px-4 py-3">
                <span className={`flex items-center gap-1 font-bold ${trade.type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {trade.type === 'BUY' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    {trade.type}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-400">
                {'source' in trade ? (trade as ExecutedTrade).source : 'SIMULATION'}
              </td>
              <td className="px-4 py-3 font-mono text-slate-300">
                {trade.entryPrice.toFixed(2)}
              </td>
              <td className="px-4 py-3 font-mono text-slate-300">
                {trade.exitPrice?.toFixed(2) || '-'}
              </td>
              <td className={`px-4 py-3 font-mono font-bold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toFixed(2)}
              </td>
              <td className="px-4 py-3">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    trade.outcome === 'WIN' ? 'bg-emerald-500/20 text-emerald-400' : 
                    trade.outcome === 'LOSS' ? 'bg-rose-500/20 text-rose-400' : 
                    'bg-blue-500/20 text-blue-400'
                }`}>
                    {trade.outcome}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TradeList;