import React, { useState, useEffect, useMemo } from 'react';
import { TradingLog, TradeSignal } from '../types';
import { storageService } from '../services/storageService';
import { BookOpen, TrendingUp, TrendingDown, Clock, Activity, Target, BrainCircuit, BarChart2, Microscope, ArrowRight, DollarSign, Calendar, User, Zap } from 'lucide-react';
import ModernCandleChart from './CandleChart';

export const TradingJournal: React.FC = () => {
    const [logs, setLogs] = useState<TradingLog[]>([]);
    const [selectedLog, setSelectedLog] = useState<TradingLog | null>(null);

    useEffect(() => {
        const loadedLogs = storageService.getTradingLogs();
        setLogs(loadedLogs);
        if (loadedLogs.length > 0) setSelectedLog(loadedLogs[0]);
    }, []);

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString('en-US', {
            month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    };

    const stats = useMemo(() => {
        const closedTrades = logs.filter(l => l.outcome);
        const wins = closedTrades.filter(l => l.outcome === 'WIN');
        const losses = closedTrades.filter(l => l.outcome === 'LOSS');
        
        const totalPnl = closedTrades.reduce((acc, curr) => acc + (curr.pnl || 0), 0);
        const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
        
        // Calculate Average Win/Loss
        const avgWin = wins.length > 0 ? wins.reduce((acc, curr) => acc + (curr.pnl || 0), 0) / wins.length : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((acc, curr) => acc + (curr.pnl || 0), 0) / losses.length : 0;

        return { 
            totalTrades: closedTrades.length, 
            winRate, 
            totalPnl, 
            winCount: wins.length, 
            lossCount: losses.length,
            avgWin,
            avgLoss
        };
    }, [logs]);

    // Reconstruct a TradeSignal-like object for the chart
    const getLogAsSignal = (log: TradingLog): TradeSignal => {
        return {
            id: log.tradeId,
            symbol: log.symbol,
            type: log.type === 'BUY' ? 'BUY' : 'SELL',
            entryPrice: log.items.snapshot.price,
            stopLoss: 0, 
            takeProfit: 0,
            confidence: log.items.aiConfidence,
            reasoning: log.items.aiReasoning,
            timestamp: log.timestamp,
            outcome: log.outcome || 'PENDING'
        };
    };

    return (
        <div className="flex h-full bg-gray-900/50 backdrop-blur-sm shadow-xl rounded-lg overflow-hidden border border-gray-800 flex-col">
            {/* Stats Bar */}
            <div className="bg-slate-900 border-b border-gray-800 p-4 grid grid-cols-2 md:grid-cols-5 gap-4 shrink-0">
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                    <div className="text-[10px] text-slate-400 uppercase font-bold text-center">Total PNL</div>
                    <div className={`text-xl font-bold text-center ${stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${stats.totalPnl.toFixed(2)}
                    </div>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                    <div className="text-[10px] text-slate-400 uppercase font-bold text-center">Win Rate</div>
                    <div className="text-xl font-bold text-blue-400 text-center">
                        {stats.winRate.toFixed(1)}%
                    </div>
                </div>
                 <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                    <div className="text-[10px] text-slate-400 uppercase font-bold text-center">Avg Win</div>
                    <div className="text-xl font-bold text-emerald-400 text-center">
                        ${stats.avgWin.toFixed(2)}
                    </div>
                </div>
                 <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
                    <div className="text-[10px] text-slate-400 uppercase font-bold text-center">Avg Loss</div>
                    <div className="text-xl font-bold text-rose-400 text-center">
                        ${stats.avgLoss.toFixed(2)}
                    </div>
                </div>
                <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700 hidden md:block">
                     <div className="text-[10px] text-slate-400 uppercase font-bold text-center">Total Trades</div>
                    <div className="text-xl font-bold text-white text-center">
                        {stats.totalTrades}
                    </div>
                </div>
            </div>

            <div className="flex flex-1 min-h-0">
                {/* Sidebar List */}
                <div className="w-full md:w-1/3 border-r border-gray-800 flex flex-col hidden md:flex min-h-0 bg-slate-900/50">
                    <div className="p-3 border-b border-gray-800 flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-400 uppercase">Trade History</span>
                        <span className="text-xs text-slate-500">{logs.length} entries</span>
                    </div>
                    <div className="overflow-y-auto flex-1">
                        {logs.length === 0 ? (
                             <div className="p-8 text-center text-gray-500">
                                No journal entries yet.
                             </div>
                        ) : (
                            logs.map(log => (
                                <div 
                                    key={log.id}
                                    onClick={() => setSelectedLog(log)}
                                    className={`p-4 border-b border-gray-800 cursor-pointer transition-colors hover:bg-gray-800/50 relative group ${selectedLog?.id === log.id ? 'bg-blue-900/10 border-l-2 border-l-blue-500' : 'border-l-2 border-l-transparent'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white text-sm">{log.symbol}</span>
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${log.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                                {log.type}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                             {log.outcome ? (
                                                <span className={`text-xs font-bold ${log.outcome === 'WIN' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {log.outcome === 'WIN' ? '+' : ''}{log.pnl?.toFixed(2)}
                                                </span>
                                             ) : (
                                                 <span className="text-[10px] text-yellow-500 bg-yellow-500/10 px-1 rounded">OPEN</span>
                                             )}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center">
                                         <span className="text-[10px] text-slate-500">{formatDate(log.timestamp)}</span>
                                         <span className="text-[10px] text-slate-400 truncate max-w-[100px]">{log.agent || 'Unknown Agent'}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Detail View */}
                <div className="flex-1 flex flex-col overflow-y-auto bg-gray-900/30 relative">
                    {selectedLog ? (
                        <div className="p-4 md:p-6 max-w-5xl mx-auto w-full space-y-6">
                            {/* Header */}
                            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                                <div>
                                    <div className="flex items-center gap-3 mb-1">
                                        <h1 className="text-2xl md:text-3xl font-bold text-white">
                                            {selectedLog.symbol}
                                        </h1>
                                        <span className={`px-3 py-1 rounded-lg text-sm font-bold ${selectedLog.type === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                            {selectedLog.type}
                                        </span>
                                        {selectedLog.outcome && (
                                            <span className={`px-3 py-1 rounded-lg text-sm font-bold border ${selectedLog.outcome === 'WIN' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
                                                {selectedLog.outcome}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-gray-400 flex items-center gap-2 text-xs">
                                        <Clock className="w-3 h-3" /> 
                                        Entry: {new Date(selectedLog.timestamp).toLocaleString()}
                                    </p>
                                     {selectedLog.exitTimestamp && (
                                        <p className="text-gray-400 flex items-center gap-2 text-xs mt-1">
                                            <Clock className="w-3 h-3" /> 
                                            Exit: {new Date(selectedLog.exitTimestamp).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                                
                                <div className="flex gap-4">
                                    <div className="text-right">
                                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">Entry Price</div>
                                        <div className="text-lg font-mono text-white">${selectedLog.items.snapshot.price}</div>
                                    </div>
                                    {selectedLog.exitPrice && (
                                        <div className="text-right">
                                            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Exit Price</div>
                                            <div className="text-lg font-mono text-white">${selectedLog.exitPrice}</div>
                                        </div>
                                    )}
                                    {selectedLog.pnl !== undefined && (
                                        <div className="text-right">
                                            <div className="text-[10px] text-gray-500 uppercase tracking-wider">PNL</div>
                                            <div className={`text-xl font-bold font-mono ${selectedLog.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {selectedLog.pnl >= 0 ? '+' : ''}{selectedLog.pnl.toFixed(2)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Agent Info Banner */}
                            <div className="bg-slate-800/40 border border-slate-700 rounded-lg p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-500/20 rounded-lg">
                                        <BrainCircuit className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <div className="text-[10px] text-slate-400 uppercase font-bold">Trading Agent</div>
                                        <div className="text-sm font-bold text-white max-w-[200px] md:max-w-none truncate">{selectedLog.agent || 'Unknown AI'}</div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[10px] text-slate-400 uppercase font-bold">Confidence</div>
                                    <div className="text-sm font-bold text-purple-400">{Math.round(selectedLog.items.aiConfidence || 0)}%</div>
                                </div>
                            </div>

                            {/* Chart Visualization */}
                            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl h-[250px] md:h-[350px] relative">
                                 {selectedLog.items.chartHistory && selectedLog.items.chartHistory.length > 0 ? (
                                    <ModernCandleChart 
                                        data={selectedLog.items.chartHistory}
                                        activeTrade={getLogAsSignal(selectedLog)}
                                    />
                                 ) : (
                                     <div className="flex items-center justify-center h-full text-gray-500 gap-2">
                                         <BarChart2 className="w-8 h-8 opacity-50"/>
                                         <span>No Chart History Available</span>
                                     </div>
                                 )}
                            </div>

                            {/* Analysis Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Left: Setup Analysis */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                                        <Microscope className="w-4 h-4 text-blue-400" />
                                        Market Condition
                                    </h3>
                                    <div className="bg-gray-800/30 p-4 rounded-lg border border-gray-700 space-y-3">
                                        <div className="flex justify-between items-center border-b border-gray-700/50 pb-2">
                                            <span className="text-gray-400 text-xs">Trend</span>
                                            <span className={`text-xs font-bold ${selectedLog.items.snapshot.trend === 'UP' ? 'text-emerald-400' : selectedLog.items.snapshot.trend === 'DOWN' ? 'text-rose-400' : 'text-yellow-400'}`}>
                                                {selectedLog.items.snapshot.trend}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center border-b border-gray-700/50 pb-2">
                                            <span className="text-gray-400 text-xs">RSI</span>
                                            <div className="text-right">
                                                <span className="text-xs font-bold text-white mr-2">{selectedLog.items.snapshot.rsi.toFixed(1)}</span>
                                                <span className="text-[10px] text-gray-500">{selectedLog.items.snapshot.condition}</span>
                                            </div>
                                        </div>
                                         <div className="flex justify-between items-center">
                                            <span className="text-gray-400 text-xs">Sentiment</span>
                                            <span className={`text-xs font-bold ${selectedLog.items.snapshot.newsSentiment > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                {selectedLog.items.snapshot.newsSentiment > 0.1 ? 'Bullish' : selectedLog.items.snapshot.newsSentiment < -0.1 ? 'Bearish' : 'Neutral'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Reasoning */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-amber-400" />
                                        AI Reasoning
                                    </h3>
                                    <div className="bg-slate-800/30 p-4 rounded-lg border border-slate-700 h-full">
                                        <p className="text-xs text-slate-300 italic leading-relaxed">
                                            "{selectedLog.items.aiReasoning}"
                                        </p>
                                        {selectedLog.notes && (
                                            <div className="mt-4 pt-3 border-t border-slate-700/50">
                                                <div className="text-[10px] text-slate-500 uppercase mb-1 flex items-center gap-1">
                                                    <User className="w-3 h-3"/> User Notes
                                                </div>
                                                <p className="text-xs text-slate-400">
                                                    {selectedLog.notes}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <BookOpen className="w-16 h-16 mb-4 opacity-20" />
                            <p>Select a trade to view analysis.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
