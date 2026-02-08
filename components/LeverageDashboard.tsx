/**
 * Leverage Trading Dashboard Component
 * UI for importing historical data, training AI, and viewing performance
 */

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Zap, RefreshCw, Database, Brain, Target, AlertCircle, CheckCircle, BarChart3, Coins } from 'lucide-react';
import { 
    importHistoricalData, 
    fetchLeverageTrades, 
    getLeverageStats,
    fetchBestPatterns,
    LeverageTrade 
} from '../services/leverageTradeService';
import { 
    batchTrainWithLeverageTrades, 
    trainUntilTargetConfidence,
    getTrainingStats,
    TrainingProgress,
    LeverageTrainingResult 
} from '../services/leverageTrainingService';

export const LeverageDashboard: React.FC = () => {
    const [trades, setTrades] = useState<LeverageTrade[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [trainingStats, setTrainingStats] = useState<any>(null);
    const [patterns, setPatterns] = useState<any[]>([]);
    
    const [isImporting, setIsImporting] = useState(false);
    const [isTraining, setIsTraining] = useState(false);
    const [trainingProgress, setTrainingProgress] = useState<TrainingProgress | null>(null);
    const [trainingResult, setTrainingResult] = useState<LeverageTrainingResult | null>(null);
    
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    // Load data on mount
    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const tradesData = await fetchLeverageTrades();
        setTrades(tradesData);
        
        const statsData = await getLeverageStats();
        setStats(statsData);
        
        const trainingStatsData = await getTrainingStats();
        setTrainingStats(trainingStatsData);
        
        const patternsData = await fetchBestPatterns(10);
        setPatterns(patternsData);
    };

    const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 5000);
    };

    const handleImportData = async () => {
        setIsImporting(true);
        const result = await importHistoricalData();
        setIsImporting(false);
        
        if (result.success) {
            showNotification(`✅ Successfully imported ${result.count} historical trades`, 'success');
            loadData();
        } else {
            showNotification(`❌ Import failed: ${result.error}`, 'error');
        }
    };

    const handleBatchTrain = async () => {
        setIsTraining(true);
        setTrainingProgress(null);
        
        const result = await batchTrainWithLeverageTrades((progress) => {
            setTrainingProgress(progress);
        });
        
        setIsTraining(false);
        setTrainingResult(result);
        
        if (result.success) {
            showNotification(`✅ Training complete! Win rate: ${result.win_rate.toFixed(1)}%, Confidence: ${result.final_confidence.toFixed(1)}%`, 'success');
            loadData();
        } else {
            showNotification(`❌ Training failed: ${result.error}`, 'error');
        }
    };

    const handleIterativeTrain = async () => {
        setIsTraining(true);
        setTrainingProgress(null);
        
        const result = await trainUntilTargetConfidence(70, 10, (iteration, confidence, winRate) => {
            setTrainingProgress({
                current: iteration,
                total: 10,
                confidence,
                win_rate: winRate,
                status: `Iteration ${iteration}/10`
            });
        });
        
        setIsTraining(false);
        setTrainingResult(result);
        
        if (result.success) {
            showNotification(`✅ Target reached! Final confidence: ${result.final_confidence.toFixed(1)}%`, 'success');
            loadData();
        } else {
            showNotification(`⚠️ Training stopped at ${result.final_confidence.toFixed(1)}% confidence`, 'info');
            loadData();
        }
    };

    return (
        <div className="h-full overflow-y-auto bg-slate-950 p-6">
            {/* Notification */}
            {notification && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-2xl flex items-center gap-2 ${
                    notification.type === 'success' ? 'bg-emerald-500' : 
                    notification.type === 'error' ? 'bg-rose-500' : 
                    'bg-blue-500'
                } text-white`}>
                    {notification.type === 'success' && <CheckCircle className="w-5 h-5" />}
                    {notification.type === 'error' && <AlertCircle className="w-5 h-5" />}
                    {notification.type === 'info' && <AlertCircle className="w-5 h-5" />}
                    {notification.message}
                </div>
            )}

            {/* Header */}
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Coins className="w-8 h-8 text-amber-400" />
                    Leverage Trading System (10x)
                </h1>
                <p className="text-slate-400 mt-2">Train AI with historical trades and leverage calculations</p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <button
                    onClick={handleImportData}
                    disabled={isImporting || trades.length > 0}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                    <Database className="w-5 h-5" />
                    {isImporting ? 'Importing...' : trades.length > 0 ? 'Data Imported' : 'Import Historical Data'}
                </button>

                <button
                    onClick={handleBatchTrain}
                    disabled={isTraining || trades.length === 0}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                    <Brain className="w-5 h-5" />
                    {isTraining ? 'Training...' : 'Batch Train'}
                </button>

                <button
                    onClick={handleIterativeTrain}
                    disabled={isTraining || trades.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                    <Target className="w-5 h-5" />
                    {isTraining ? 'Training...' : 'Train to 70% Confidence'}
                </button>
            </div>

            {/* Training Progress */}
            {trainingProgress && (
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-blue-400" />
                        Training in Progress...
                    </h3>
                    <div className="space-y-3">
                        <div>
                            <div className="flex justify-between text-sm text-slate-400 mb-1">
                                <span>{trainingProgress.status}</span>
                                <span>{trainingProgress.current}/{trainingProgress.total}</span>
                            </div>
                            <div className="w-full bg-slate-800 rounded-full h-2">
                                <div 
                                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${(trainingProgress.current / trainingProgress.total) * 100}%` }}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-slate-400">Confidence:</span>
                                <span className="text-white font-semibold ml-2">{trainingProgress.confidence.toFixed(1)}%</span>
                            </div>
                            <div>
                                <span className="text-slate-400">Win Rate:</span>
                                <span className="text-white font-semibold ml-2">{trainingProgress.win_rate.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Training Result */}
            {trainingResult && !isTraining && (
                <div className={`border rounded-lg p-6 mb-6 ${
                    trainingResult.success ? 'bg-emerald-900/20 border-emerald-500' : 'bg-amber-900/20 border-amber-500'
                }`}>
                    <h3 className="text-lg font-semibold text-white mb-4">Training Results</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <div className="text-slate-400">Trades Trained</div>
                            <div className="text-2xl font-bold text-white">{trainingResult.total_trained}</div>
                        </div>
                        <div>
                            <div className="text-slate-400">Win Rate</div>
                            <div className="text-2xl font-bold text-emerald-400">{trainingResult.win_rate.toFixed(1)}%</div>
                        </div>
                        <div>
                            <div className="text-slate-400">Confidence</div>
                            <div className="text-2xl font-bold text-blue-400">{trainingResult.final_confidence.toFixed(1)}%</div>
                        </div>
                        <div>
                            <div className="text-slate-400">Patterns Found</div>
                            <div className="text-2xl font-bold text-purple-400">{trainingResult.patterns_discovered}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Statistics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {/* Total Trades */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-sm">Total Trades</span>
                        <BarChart3 className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="text-2xl font-bold text-white">{trainingStats?.total_trades || 0}</div>
                    <div className="text-xs text-slate-500 mt-1">
                        {trainingStats?.filled_trades || 0} filled, {trainingStats?.not_filled || 0} not filled
                    </div>
                </div>

                {/* Win Rate */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-sm">Win Rate</span>
                        <Target className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">{trainingStats?.win_rate.toFixed(1) || 0}%</div>
                    <div className="text-xs text-slate-500 mt-1">
                        {trainingStats?.wins || 0}W / {trainingStats?.losses || 0}L
                    </div>
                </div>

                {/* Average PNL */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-sm">Avg PNL</span>
                        {(trainingStats?.avg_pnl || 0) >= 0 ? 
                            <TrendingUp className="w-5 h-5 text-emerald-400" /> : 
                            <TrendingDown className="w-5 h-5 text-rose-400" />
                        }
                    </div>
                    <div className={`text-2xl font-bold ${(trainingStats?.avg_pnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        ${trainingStats?.avg_pnl.toFixed(2) || '0.00'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                        Total: ${trainingStats?.total_pnl.toFixed(2) || '0.00'}
                    </div>
                </div>

                {/* Best/Worst */}
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-sm">Best / Worst</span>
                        <Zap className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="text-sm">
                        <div className="text-emerald-400 font-semibold">+{trainingStats?.best_trade.toFixed(1) || 0}%</div>
                        <div className="text-rose-400 font-semibold">{trainingStats?.worst_trade.toFixed(1) || 0}%</div>
                    </div>
                </div>
            </div>

            {/* Best Patterns */}
            {patterns.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Best Performing Patterns</h3>
                    <div className="space-y-2">
                        {patterns.slice(0, 5).map((pattern, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
                                <div className="flex-1">
                                    <div className="text-white font-medium">{pattern.pattern_name}</div>
                                    <div className="text-xs text-slate-400">
                                        {pattern.win_count}W / {pattern.loss_count}L • Avg PNL: ${pattern.avg_pnl?.toFixed(2)}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-emerald-400 font-semibold">{pattern.win_rate?.toFixed(0)}%</div>
                                    <div className="text-xs text-slate-500">Confidence</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Recent Trades Table */}
            {trades.length > 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Historical Trades</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-800">
                                    <th className="text-left text-slate-400 pb-3">Date</th>
                                    <th className="text-left text-slate-400 pb-3">Type</th>
                                    <th className="text-right text-slate-400 pb-3">Open</th>
                                    <th className="text-right text-slate-400 pb-3">Close</th>
                                    <th className="text-right text-slate-400 pb-3">PNL %</th>
                                    <th className="text-right text-slate-400 pb-3">Balance</th>
                                    <th className="text-center text-slate-400 pb-3">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {trades.slice(0, 15).map((trade, idx) => (
                                    <tr key={idx} className="border-b border-slate-800/50">
                                        <td className="py-3 text-slate-300">{trade.trade_date}</td>
                                        <td className="py-3">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                                trade.order_type === 'SHORT' ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                                            }`}>
                                                {trade.order_type}
                                            </span>
                                        </td>
                                        <td className="py-3 text-right text-slate-300">${trade.open_price.toFixed(2)}</td>
                                        <td className="py-3 text-right text-slate-300">
                                            {trade.close_price ? `$${trade.close_price.toFixed(2)}` : '-'}
                                        </td>
                                        <td className={`py-3 text-right font-semibold ${
                                            (trade.pnl_percent || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                        }`}>
                                            {trade.pnl_percent ? `${trade.pnl_percent > 0 ? '+' : ''}${trade.pnl_percent.toFixed(2)}%` : '-'}
                                        </td>
                                        <td className="py-3 text-right text-slate-300">${trade.balance.toFixed(2)}</td>
                                        <td className="py-3 text-center">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                                trade.status === 'FILLED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'
                                            }`}>
                                                {trade.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Empty State */}
            {trades.length === 0 && (
                <div className="bg-slate-900 border border-slate-800 rounded-lg p-12 text-center">
                    <Database className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No Data Yet</h3>
                    <p className="text-slate-400 mb-6">Import historical trades to start training the AI model</p>
                    <button
                        onClick={handleImportData}
                        disabled={isImporting}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 text-white px-6 py-3 rounded-lg font-semibold inline-flex items-center gap-2"
                    >
                        <Database className="w-5 h-5" />
                        {isImporting ? 'Importing...' : 'Import Historical Data'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default LeverageDashboard;
