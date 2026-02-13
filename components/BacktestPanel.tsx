import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, BarChart2, TrendingUp, Settings, AlertTriangle, ChevronDown, List, Brain, RefreshCw, Zap } from 'lucide-react';
import { Candle, BacktestTrade, BacktestStats, TrainingData, TechnicalIndicators, BacktestConfig } from '../types';
import { calculateRSI, calculateFibonacci, analyzeTrend, calculateSMA, calculateEMA, findSupportResistance } from '../utils/technical';
import { analyzeMarketWithLocalML, trainModel, getPatternStats, resetModel, trainUntilConfident } from '../services/mlService';
import { calculateAdvancedStats } from '../utils/analytics';
import { storageService } from '../services/storageService';
import ModernCandleChart from './CandleChart';
import TradeList from './TradeList';

interface BacktestPanelProps {
    candles: Candle[];
    symbol: string;
    timeframe: string;
    initialBalance?: number; // Optional, default 10000
}

interface LogEntry {
    time: string;
    msg: string;
    type: 'info' | 'trade' | 'error' | 'success';
}

const BacktestPanel: React.FC<BacktestPanelProps> = ({
    candles,
    symbol,
    timeframe,
    initialBalance = 10000
}) => {
    const [isRunning, setIsRunning] = useState(false);
    const [isTraining, setIsTraining] = useState(false); // Toggle for training mode
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [trades, setTrades] = useState<BacktestTrade[]>([]);
    const [visibleCandles, setVisibleCandles] = useState<Candle[]>([]);
    const [visibleIndicators, setVisibleIndicators] = useState<TechnicalIndicators | undefined>(undefined);
    const [activeTab, setActiveTab] = useState<'console' | 'trades'>('console');

    // AI Stats
    const [aiStats, setAiStats] = useState({ avgConfidence: 50, patternCount: 0 });

    // Parameters
    // const [initialBalance] = useState(10000); // Fixed simulation balance (Now via prop)
    const [currentBalance, setCurrentBalance] = useState(initialBalance);
    const [riskPercent] = useState(2); // Strict 2% rule based on history
    // const [interval] = useState(1); // Check every candle (Now via prop) 

    /* Config Management Removed as per user request for history-based simulation */

    const stopRef = useRef(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Load stats on mount
    useEffect(() => {
        updateAiStats();
    }, []);

    const updateAiStats = () => {
        const stats = getPatternStats();
        setAiStats({
            avgConfidence: stats.avgConfidence,
            patternCount: stats.totalPatterns
        });
    };

    // Stats Calculation using advanced analytics utility
    const stats = React.useMemo(() => {
        // Import dynamically to avoid circular dependencies if any, or just use standard import
        // For now, we assume calc logic is imported
        return calculateAdvancedStats(trades, initialBalance, currentBalance, candles);
    }, [trades, currentBalance, initialBalance, candles]);

    const [strategy, setStrategy] = useState<'SCALP' | 'SWING'>('SCALP');

    const addLog = (msg: string, type: LogEntry['type'] = 'info') => {
        const logEntry = {
            time: new Date().toLocaleTimeString(),
            msg,
            type
        };

        setLogs(prev => [logEntry, ...prev].slice(0, 100));

        // Save to Supabase
        storageService.saveBacktestLog({
            ...logEntry,
            backtestId: `${symbol}_${timeframe}_${Date.now()}`
        }).catch(err => {
            console.error('[Backtest] Failed to save log to Supabase:', err);
        });
    };

    // Simulation Loop
    useEffect(() => {
        if (!isRunning) return;

        let currentIndex = progress === 0 ? 50 : progress; // Start with 50 candles context

        const runLoop = async () => {
            let allTrades: BacktestTrade[] = [...trades]; // Capture existing state if resuming, or empty

            while (currentIndex < candles.length && !stopRef.current) {
                // 1. Update Visible Candles
                const currentCandle = candles[currentIndex];
                const currentSubset = candles.slice(0, currentIndex + 1);

                setVisibleCandles(prev => {
                    return currentSubset.slice(-150);
                });

                // 2. Technical Analysis (Fixed Calculations)
                const sma200 = calculateSMA(currentSubset, 200);
                const trend = analyzeTrend(currentSubset, sma200);

                // Fib calcs (last 100 candles high/low)
                const recentSlice = currentSubset.slice(-100);
                const highest = Math.max(...recentSlice.map(c => c.high));
                const lowest = Math.min(...recentSlice.map(c => c.low));
                const fibLevels = calculateFibonacci(highest, lowest, trend);

                const sr = findSupportResistance(currentSubset);

                const indicators: TechnicalIndicators = {
                    rsi: calculateRSI(currentSubset.map(c => c.close)),
                    trend,
                    fibLevels,
                    sma50: calculateSMA(currentSubset, 50),
                    sma200,
                    sma20: calculateSMA(currentSubset, 20),
                    ema20: calculateEMA(currentSubset, 20),
                    ema12: calculateEMA(currentSubset, 12),
                    ema26: calculateEMA(currentSubset, 26),
                    nearestSupport: sr.support,
                    nearestResistance: sr.resistance,
                    volumeSma: calculateSMA(currentSubset.map(c => c.volume), 20),
                    macd: { value: 0, signal: 0, histogram: 0 }, // Placeholder
                    stochastic: { k: 50, d: 50 }, // Placeholder
                    momentum: 0
                };
                setVisibleIndicators(indicators);

                // 3. AI Analysis
                if (isTraining) {
                    // Training logic here
                }

                // Check for exit on existing trades
                setTrades(prevTrades => {
                    return prevTrades.map(trade => {
                        if (trade.outcome === 'OPEN') {
                            // Check SL/TP
                            if (currentCandle.low <= trade.stopLoss) {
                                // Stop Loss Hit
                                const pnl = (trade.stopLoss - trade.entryPrice) * trade.quantity * (trade.type === 'BUY' ? 1 : -1);
                                setCurrentBalance(b => b + pnl);
                                addLog(`🛑 SL Hit: ${trade.type} ${symbol} @ ${trade.stopLoss}`, 'error');

                                // Train Model on Loss
                                if (isTraining) {
                                    trainModel('LOSS', trade.type, currentSubset, indicators, 0.5, pnl, Math.abs(trade.entryPrice - trade.stopLoss));
                                }

                                return { ...trade, outcome: 'LOSS' as const, exitPrice: trade.stopLoss, exitTime: currentCandle.time, pnl };
                            } else if (currentCandle.high >= trade.takeProfit) {
                                // Take Profit Hit
                                const pnl = (trade.takeProfit - trade.entryPrice) * trade.quantity * (trade.type === 'BUY' ? 1 : -1);
                                setCurrentBalance(b => b + pnl);
                                addLog(`✅ TP Hit: ${trade.type} ${symbol} @ ${trade.takeProfit}`, 'success');

                                // Train Model on Win
                                if (isTraining) {
                                    trainModel('WIN', trade.type, currentSubset, indicators, 0.5, pnl, Math.abs(trade.entryPrice - trade.stopLoss));
                                }

                                return { ...trade, outcome: 'WIN' as const, exitPrice: trade.takeProfit, exitTime: currentCandle.time, pnl };
                            }
                        }
                        return trade;
                    });
                });

                // Entry Logic (Only if no open trades)
                // Generate Signal
                const trainingHist: TrainingData[] = [];

                // We need to pause briefly to let state update if we depend on it, 
                // but for 'trades' we can't see the update from setTrades immediately in this loop iteration.
                // So we rely on the fact that we process sequentially.
                // We will fetch the signal regardless, but only act if we think we are flat.

                const signal = await analyzeMarketWithLocalML(currentSubset, indicators, trainingHist, [], symbol, strategy, isTraining);

                // Progress logging
                if (currentIndex % 50 === 0) {
                    addLog(`?? Candle ${currentIndex}/${candles.length}`, 'info');
                }

                if (signal && signal.type !== 'HOLD') {
                    // Risk Management
                    const riskAmount = currentBalance * (riskPercent / 100);
                    const sharePrice = currentCandle.close;
                    const riskPerShare = Math.abs(sharePrice - signal.stopLoss);
                    const quantity = riskPerShare > 0 ? riskAmount / riskPerShare : 0;

                    if (quantity > 0) {
                        const newTrade: BacktestTrade = {
                            id: signal.id,
                            symbol: signal.symbol,
                            type: signal.type as 'BUY' | 'SELL',
                            entryPrice: signal.entryPrice,
                            stopLoss: signal.stopLoss,
                            takeProfit: signal.takeProfit,
                            quantity: quantity,
                            outcome: 'OPEN',
                            entryTime: currentCandle.time,
                            pnl: 0
                        };

                        setTrades(prev => {
                            const hasOpen = prev.some(t => t.outcome === 'OPEN');
                            if (!hasOpen) {
                                addLog(`🚀 ${signal.type} Signal: ${symbol} @ ${signal.entryPrice} (Strategy: ${strategy})`, 'trade');

                                // UPDATE LOCAL TRACKER
                                allTrades.push(newTrade);
                                return [...prev, newTrade];
                            }
                            return prev;
                        });
                    }
                }

                currentIndex++;
                setProgress(currentIndex);

                // Delay for visualization
                if (!isTraining) await new Promise(r => setTimeout(r, 50));
                else await new Promise(r => setTimeout(r, 1));
            }

            // SIMULATION COMPLETED LOG
            const totalExec = allTrades.length;
            if (totalExec === 0) {
                addLog(`⚠️ 0 Trades executed. Confidence too low?`, 'error');
                addLog(`💡 TIP: Enable "AUTO TRAIN" button to force trades & learn!`, 'info');
            } else {
                addLog(`✅ Simulation completed! Total trades: ${totalExec}`, 'success');
                const finalPnL = currentBalance - initialBalance;
                addLog(`📊 Final balance: $${currentBalance.toFixed(2)} | P/L: $${finalPnL.toFixed(2)}`, 'info');
            }

            setIsRunning(false);
            stopRef.current = false;
        };

        runLoop();

        // Cleanup
        return () => {
            stopRef.current = true;
        };
    }, [isRunning, candles, strategy, isTraining]);

    return (
        <div className="flex flex-col h-full bg-slate-950 text-slate-200 p-4 gap-4 overflow-hidden">
            {/* Header & Controls */}
            <div className="flex justify-between items-center bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-500/20 p-2 rounded-lg">
                            <BarChart2 className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg text-white">BACKTEST {symbol}</h2>
                            <p className="text-xs text-slate-400 font-mono">
                                {candles.length} CANDLES • {timeframe} TIMEFRAME • INITIAL: ${initialBalance.toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Strategy Selector */}
                    <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                        <button
                            onClick={() => !isRunning && setStrategy('SCALP')}
                            disabled={isRunning}
                            className={`px-3 py-1 text-xs font-bold rounded transition-all ${strategy === 'SCALP'
                                ? 'bg-blue-500 text-white shadow-lg'
                                : 'text-slate-400 hover:text-slate-200'
                                }`}
                            title="Scalp: Tight Stops (2x ATR), Quick Profit"
                        >
                            SCALP
                        </button>
                        <button
                            onClick={() => !isRunning && setStrategy('SWING')}
                            disabled={isRunning}
                            className={`px-3 py-1 text-xs font-bold rounded transition-all ${strategy === 'SWING'
                                ? 'bg-purple-500 text-white shadow-lg'
                                : 'text-slate-400 hover:text-slate-200'
                                }`}
                            title="Swing: Wide Stops (4x ATR), Big Moves"
                        >
                            SWING
                        </button>
                    </div>

                    <div className="h-6 w-px bg-slate-800 mx-2"></div>

                    <button
                        onClick={() => setIsTraining(!isTraining)}
                        disabled={isRunning}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${isTraining
                            ? 'bg-violet-600 border-violet-500 text-white shadow-[0_0_15px_rgba(124,58,237,0.3)]'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        <Brain className="w-3.5 h-3.5" />
                        {isTraining ? 'TRAINING ENABLED' : 'AUTO TRAIN'}
                    </button>

                    <div className="h-6 w-px bg-slate-800 mx-2"></div>

                    <button
                        onClick={isRunning ? () => { stopRef.current = true; setIsRunning(false); } : () => setIsRunning(true)}
                        className={`flex items-center gap-2 px-6 py-2 rounded-lg font-bold transition-all shadow-lg text-sm ${isRunning
                            ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
                            : 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                            }`}
                    >
                        {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                        {isRunning ? 'PAUSE' : 'START SIMULATION'}
                    </button>

                    <button
                        onClick={() => {
                            stopRef.current = true;
                            setIsRunning(false);
                            setCurrentBalance(initialBalance);
                            setTrades([]);
                            setLogs([]);
                            setVisibleCandles([]);
                            // resetModel(); // Optional: Reset AI memory?
                        }}
                        className="p-2 aspect-square rounded-lg bg-slate-800 text-slate-400 hover:text-white border border-slate-700 hover:border-slate-600 transition-all"
                        title="Reset Simulation"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
                <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
                    {/* Chart Visualization */}
                    <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg min-h-[300px] flex flex-col">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" /> SIMULATION VISUALIZER {isTraining && <span className="text-violet-400 animate-pulse">• TRAINING MODE</span>}
                            </span>
                            <span className="text-xs font-mono text-slate-600">
                                {visibleCandles.length > 0 ? visibleCandles[visibleCandles.length - 1].time : '--:--'}
                            </span>
                        </div>
                        <div className="flex-1 relative">
                            <ModernCandleChart
                                data={visibleCandles}
                                pendingSignal={null} // Backtest doesn't show pending
                                activeTrade={null} // Trades are visualized via 'trades' prop history
                                trades={trades}
                                fibLevels={visibleIndicators?.fibLevels}
                            />
                        </div>
                    </div>

                    {/* Advanced Analytics Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {/* 1. Returns */}
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block border-b border-slate-800 pb-1">Returns</span>
                            <div>
                                <div className="text-[9px] text-slate-400">Net Profit</div>
                                <div className={`text-md font-mono font-bold ${stats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {stats.netProfit >= 0 ? '+' : ''}{stats.netProfit.toFixed(2)}
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] text-slate-400">Agent Return</div>
                                <div className={`text-md font-mono font-bold ${stats.agentReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {stats.agentReturn.toFixed(2)}%
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] text-slate-400">Buy & Hold</div>
                                <div className="text-sm font-mono text-slate-300">
                                    {stats.buyHoldReturn.toFixed(2)}%
                                </div>
                            </div>
                        </div>

                        {/* 2. Risk Metrics */}
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block border-b border-slate-800 pb-1">Risk Metrics</span>
                            <div>
                                <div className="text-[9px] text-slate-400">Max Drawdown</div>
                                <div className="text-md font-mono font-bold text-rose-400">
                                    {stats.maxDrawdown.toFixed(2)}%
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] text-slate-400">Sharpe Ratio</div>
                                <div className="text-md font-mono font-bold text-blue-400">
                                    {stats.sharpeRatio.toFixed(2)}
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] text-slate-400">Calmar Ratio</div>
                                <div className="text-sm font-mono text-slate-300">
                                    {stats.calmarRatio.toFixed(2)}
                                </div>
                            </div>
                        </div>

                        {/* 3. Trade Stats */}
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block border-b border-slate-800 pb-1">Trade Stats</span>
                            <div className="flex justify-between">
                                <div>
                                    <div className="text-[9px] text-slate-400">Profit Factor</div>
                                    <div className="text-md font-mono font-bold text-emerald-400">{stats.profitFactor.toFixed(2)}</div>
                                </div>
                                <div>
                                    <div className="text-[9px] text-slate-400">Win Rate</div>
                                    <div className="text-md font-mono font-bold text-blue-400">{stats.winRate.toFixed(1)}%</div>
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] text-slate-400">Expectancy / R:R</div>
                                <div className="text-xs font-mono text-slate-300">
                                    {stats.expectancy.toFixed(2)} / {stats.riskRewardRatio.toFixed(2)}
                                </div>
                            </div>
                        </div>

                        {/* 4. Counts & Time */}
                        <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-2">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block border-b border-slate-800 pb-1">Trade Counts</span>
                            <div className="flex justify-between">
                                <div>
                                    <div className="text-[9px] text-slate-400">Total</div>
                                    <div className="text-md font-mono font-bold text-white">{stats.totalTrades}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-[9px] text-slate-400">Long/Short</div>
                                    <div className="text-xs font-mono text-slate-300">{stats.longCount}L / {stats.shortCount}S</div>
                                </div>
                            </div>
                            <div>
                                <div className="text-[9px] text-slate-400">Time in Market</div>
                                <div className="text-xs font-mono text-slate-300">
                                    {stats.timeInMarket.toFixed(1)}%
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right: Console & Trade List Tabs */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl shadow-inner flex flex-col font-mono text-xs overflow-hidden">
                    <div className="flex border-b border-slate-800">
                        <button
                            onClick={() => setActiveTab('console')}
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider ${activeTab === 'console' ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:bg-slate-900'}`}
                        >
                            Event Log
                        </button>
                        <button
                            onClick={() => setActiveTab('trades')}
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 ${activeTab === 'trades' ? 'bg-slate-800 text-blue-400' : 'text-slate-500 hover:bg-slate-900'}`}
                        >
                            <List className="w-3 h-3" /> Trade List ({trades.length})
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto min-h-0" ref={scrollRef}>
                        {activeTab === 'console' ? (
                            <div className="p-4 space-y-1">
                                {logs.length === 0 && <div className="text-slate-700 italic text-center mt-10">
                                    {trainingModeDescription(true)}
                                </div>}
                                {logs.map((log, i) => (
                                    <div key={i} className={`pb-1 border-b border-slate-900/50 flex gap-2 ${log.type === 'error' ? 'text-rose-400' :
                                        log.type === 'success' ? 'text-emerald-400' :
                                            log.type === 'trade' ? 'text-blue-400' : 'text-slate-400'
                                        }`}>
                                        <span className="text-slate-600 shrink-0">[{log.time}]</span>
                                        <span>{log.msg}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full">
                                <TradeList trades={trades} />
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

// Helper for empty state description
const trainingModeDescription = (isTraining: boolean) => (
    <div className="flex flex-col gap-2 items-center text-slate-600">
        <Zap className="w-8 h-8 opacity-20" />
        <p>Ready to start simulation.</p>
        <p className="text-[10px] max-w-[200px]">
            Use <strong>Auto Train</strong> to improve the AI model using historical data.
        </p>
    </div>
);

export default BacktestPanel;