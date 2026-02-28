import React, { useState } from 'react';
import { ArrowDown, ArrowUp, X, Clock, Filter } from 'lucide-react';
import { BacktestTrade, ExecutedTrade } from '../types';

interface TradeListProps {
  trades: (BacktestTrade | ExecutedTrade)[];
}

const TradeList: React.FC<TradeListProps> = React.memo(({ trades }) => {
  // Filter out ANY trades that are not WIN or LOSS
  const filteredTrades = trades.filter(t => t.outcome === 'WIN' || t.outcome === 'LOSS');

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-slate-500">
        <p className="text-sm">No trades executed yet.</p>
      </div>
    );
  }

  // Sort trades by entry time (newest first) to ensure correct order
  const sortedTrades = [...filteredTrades].sort((a, b) => {
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
        second: '2-digit',
        hour12: false
      });
    } catch (error) {
      console.error(`[TradeList] Error formatting timestamp: ${timestamp}`, error);
      return 'Invalid Date';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter Controls (Removed 'Show Pending' as per user request to ALWAYS hide open trades) */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/50 border-b border-slate-800">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Filter className="w-3 h-3" />
          <span>Filtered: Positive PnL & Closed Trades Only</span>
        </div>
      </div>

      {/* Trade Table */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-xs text-left">
          <thead className="text-slate-500 bg-slate-900/50 uppercase font-bold border-b border-slate-800 sticky top-0">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Asset</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Entry</th>
              <th className="px-4 py-3">Exit</th>
              <th className="px-4 py-3">PNL</th>
              <th className="px-4 py-3">Outcome</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {sortedTrades.map((trade) => {
              
              return (
                <tr 
                  key={trade.id} 
                  className={`hover:bg-slate-800/30 transition-colors`}
                >
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
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        trade.outcome === 'WIN' ? 'bg-emerald-500/20 text-emerald-400' : 
                        trade.outcome === 'LOSS' ? 'bg-rose-500/20 text-rose-400' : 
                        trade.outcome === 'EXPIRED' ? 'bg-orange-500/20 text-orange-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                          {trade.outcome}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default TradeList;