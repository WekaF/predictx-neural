import React, { useState, useEffect } from 'react';
import { TradingLog, TradeSignal } from '../types';
import { storageService } from '../services/storageService';
import { BookOpen, TrendingUp, TrendingDown, Clock, Activity, Target, BrainCircuit, BarChart2, Microscope, ArrowRight } from 'lucide-react';
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

    // Reconstruct a TradeSignal-like object for the chart to show entry line
    const getLogAsSignal = (log: any): TradeSignal => {
        const items = log.items || {};
        const snapshot = items.snapshot || {};
        
        return {
            id: log.tradeId || log.id,
            symbol: log.symbol,
            type: log.type === 'BUY' ? 'BUY' : 'SELL',
            entryPrice: snapshot.price || log.entryPrice || 0,
            stopLoss: log.stopLoss || 0,
            takeProfit: log.takeProfit || 0,
            confidence: items.aiConfidence || log.aiConfidence || 0,
            reasoning: items.aiReasoning || log.aiReasoning || '',
            timestamp: log.timestamp || (log.entryTime ? new Date(log.entryTime).getTime() : Date.now()),
            outcome: log.outcome || 'PENDING'
        };
    };

    return (
        <div className="flex h-full bg-gray-900/50 backdrop-blur-sm shadow-xl rounded-lg overflow-hidden border border-gray-800">
            {/* Sidebar List */}
            <div className="w-1/3 border-r border-gray-800 flex flex-col hidden md:flex">
                <div className="p-4 border-b border-gray-800 bg-gray-900/80">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                        <BookOpen className="w-5 h-5 text-blue-400" />
                        Trading Journal
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">{logs.length} entries captured</p>
                </div>
                <div className="overflow-y-auto flex-1">
                    {logs.length === 0 ? (
                         <div className="p-8 text-center text-gray-500">
                            No journal entries yet.
                            <br/><span className="text-xs">Take a trade to see it here.</span>
                         </div>
                    ) : (
                        logs.map(log => (
                            <div 
                                key={log.id}
                                onClick={() => setSelectedLog(log)}
                                className={`p-4 border-b border-gray-800 cursor-pointer transition-colors hover:bg-gray-800/50 ${selectedLog?.id === log.id ? 'bg-blue-900/20 border-l-4 border-l-blue-500' : ''}`}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-white">{log.symbol}</span>
                                    <span className="text-xs text-gray-500">{formatDate(log.timestamp)}</span>
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                     <span className={`px-2 py-0.5 rounded text-xs font-bold ${log.type === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {log.type}
                                    </span>
                                    <span className="text-xs text-gray-400 ml-auto">
                                        Conf: {Math.round((log.items?.aiConfidence || log.aiConfidence || 0))}%
                                    </span>
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                    {log.items?.aiPrediction || log.aiPrediction || log.notes || "No notes"}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Detail View */}
            <div className="flex-1 flex flex-col overflow-y-auto bg-gray-900/30">
                {selectedLog ? (
                    <div className="p-4 md:p-8 max-w-5xl mx-auto w-full space-y-6">
                        {/* Header */}
                        <div className="flex justify-between items-start">
                            <div>
                                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center gap-3">
                                    {selectedLog.symbol}
                                    <span className={`px-3 py-1 rounded-lg text-lg ${selectedLog.type === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                        {selectedLog.type}
                                    </span>
                                </h1>
                                <p className="text-gray-400 flex items-center gap-2 text-sm">
                                    <Clock className="w-4 h-4" /> 
                                    {new Date(selectedLog.timestamp).toLocaleString()}
                                </p>
                            </div>
                            <div className="text-right">
                                <div className="text-xs text-gray-400 uppercase tracking-wider">Entry Price</div>
                                <div className="text-2xl font-mono text-white">${selectedLog.items?.snapshot?.price || selectedLog.entryPrice || 0}</div>
                            </div>
                        </div>

                        {/* Chart Visualization */}
                        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-2xl h-[300px] md:h-[400px] relative">
                             {selectedLog.items.chartHistory && selectedLog.items.chartHistory.length > 0 ? (
                                <ModernCandleChart 
                                    data={selectedLog.items.chartHistory}
                                    activeTrade={getLogAsSignal(selectedLog)}
                                />
                             ) : (
                                 <div className="flex items-center justify-center h-full text-gray-500 gap-2">
                                     <BarChart2 className="w-8 h-8 opacity-50"/>
                                     <span>No Chart History Available for this trade.</span>
                                 </div>
                             )}
                        </div>

                        {/* Analysis Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left: Setup Analysis */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <Microscope className="w-5 h-5 text-blue-400" />
                                    Entry Analysis
                                </h3>
                                <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700 space-y-3">
                                    <div className="flex justify-between items-center border-b border-gray-700/50 pb-2">
                                        <span className="text-gray-400 text-sm">Market Trend</span>
                                        <span className={`font-bold ${(selectedLog.items?.snapshot?.trend || selectedLog.marketContext?.trend) === 'UP' ? 'text-green-400' : (selectedLog.items?.snapshot?.trend || selectedLog.marketContext?.trend) === 'DOWN' ? 'text-red-400' : 'text-yellow-400'}`}>
                                            {selectedLog.items?.snapshot?.trend || selectedLog.marketContext?.trend || 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-gray-700/50 pb-2">
                                        <span className="text-gray-400 text-sm">RSI Indicator</span>
                                        <div className="text-right">
                                            <div className="font-bold text-white">{(selectedLog.items?.snapshot?.rsi || selectedLog.marketContext?.rsi || 0).toFixed(1)}</div>
                                            <div className="text-[10px] text-gray-500">{selectedLog.items?.snapshot?.condition || ''}</div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center border-b border-gray-700/50 pb-2">
                                        <span className="text-gray-400 text-sm">News Sentiment</span>
                                        <span className={`font-bold ${(selectedLog.items?.snapshot?.newsSentiment || 0) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {(selectedLog.items?.snapshot?.newsSentiment || 0) > 0 ? 'Bullish' : 'Bearish'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-400 text-sm">AI Confidence</span>
                                        <span className="font-bold text-purple-400">{Math.round(selectedLog.items?.aiConfidence || selectedLog.aiConfidence || 0)}%</span>
                                    </div>
                                </div>
                            </div>

                            {/* Right: AI Feedback Loop */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <BrainCircuit className="w-5 h-5 text-purple-400" />
                                    AI Reasoning & Learning
                                </h3>
                                <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 p-4 rounded-lg border border-indigo-500/30 h-full">
                                    <div className="text-sm text-gray-300 leading-relaxed mb-4 italic">
                                        "{selectedLog.items?.aiReasoning || selectedLog.aiReasoning || 'No reasoning captured'}"
                                    </div>
                                    
                                    <div className="mt-4 pt-4 border-t border-indigo-500/20">
                                        <h4 className="text-xs font-bold text-indigo-300 uppercase mb-2">Post-Trade Review</h4>
                                        <p className="text-xs text-indigo-200/70 mb-3">
                                            Analyze the outcome of this trade to improve future predictions.
                                        </p>
                                        <button className="w-full py-2 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 rounded border border-indigo-500/50 transition-colors text-xs font-bold flex items-center justify-center gap-2">
                                            <BrainCircuit className="w-3 h-3" />
                                            Generate AI Post-Mortem
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Notes Section */}
                         <div className="bg-gray-800/30 p-6 rounded-lg border border-gray-700">
                            <h3 className="text-lg font-bold text-white mb-4">Trader's Notes</h3>
                            <textarea 
                                className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-gray-300 focus:outline-none focus:border-blue-500 h-24 resize-none text-sm"
                                placeholder="Log your emotions, mistakes, or key learnings here..."
                                defaultValue={selectedLog.notes}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <BookOpen className="w-16 h-16 mb-4 opacity-20" />
                        <p>Select a log entry from the list to analyze.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
