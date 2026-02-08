import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, BarChart2, TrendingUp, Settings, AlertTriangle, ChevronDown, Save, FolderOpen, Trash2, List } from 'lucide-react';
import { Candle, BacktestTrade, BacktestStats, TrainingData, TechnicalIndicators, BacktestConfig } from '../types';
import { calculateRSI, calculateFibonacci, analyzeTrend, calculateSMA, calculateEMA, findSupportResistance, detectCandlePatterns } from '../utils/technical';
import { analyzeMarketWithLocalML } from '../services/mlService';
import { storageService } from '../services/storageService';
import ModernCandleChart from './CandleChart';
import TradeList from './TradeList';

interface BacktestPanelProps {
  candles: Candle[];
}

interface LogEntry {
    time: string;
    msg: string;
    type: 'info' | 'trade' | 'error' | 'success';
}

const BacktestPanel: React.FC<BacktestPanelProps> = ({ candles }) => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [trades, setTrades] = useState<BacktestTrade[]>([]);
  const [visibleCandles, setVisibleCandles] = useState<Candle[]>([]);
  const [visibleIndicators, setVisibleIndicators] = useState<TechnicalIndicators | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'console' | 'trades'>('console');

  // Parameters
  const [initialBalance, setInitialBalance] = useState(10000);
  const [currentBalance, setCurrentBalance] = useState(10000);
  const [riskPercent, setRiskPercent] = useState(2); // Strict 2% rule
  const [interval, setInterval] = useState(5); 

  // Config Management
  const [savedConfigs, setSavedConfigs] = useState<BacktestConfig[]>([]);
  const [configName, setConfigName] = useState('');
  const [showSaveLoad, setShowSaveLoad] = useState(false);

  const stopRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load configs on mount
  useEffect(() => {
    setSavedConfigs(storageService.getBacktestConfigs());
  }, []);

  // Stats Calculation
  const stats: BacktestStats = React.useMemo(() => {
    const wins = trades.filter(t => t.outcome === 'WIN').length;
    const losses = trades.filter(t => t.outcome === 'LOSS').length;
    const total = wins + losses;
    const profit = currentBalance - initialBalance;
    const grossProfit = trades.reduce((acc, t) => acc + (t.pnl > 0 ? t.pnl : 0), 0);
    const grossLoss = Math.abs(trades.reduce((acc, t) => acc + (t.pnl < 0 ? t.pnl : 0), 0));

    return {
      totalTrades: total,
      wins,
      losses,
      winRate: total > 0 ? (wins / total) * 100 : 0,
      netProfit: profit,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0,
      maxDrawdown: 0 
    };
  }, [trades, currentBalance, initialBalance]);

  const addLog = (msg: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [{
        time: new Date().toLocaleTimeString(),
        msg,
        type
    }, ...prev].slice(0, 100));
  };

  useEffect(() => {
    if (candles.length > 0 && visibleCandles.length === 0) {
        setVisibleCandles(candles.slice(-100));
    }
  }, [candles]);

  const saveConfig = () => {
    if (!configName) return;
    const newConfig: BacktestConfig = {
      id: Math.random().toString(36).substr(2, 9),
      name: configName,
      initialBalance,
      riskPercent,
      interval,
      selectedModel: 'local-ml',
      useMockAI: false
    };
    storageService.saveBacktestConfig(newConfig);
    setSavedConfigs(storageService.getBacktestConfigs());
    setConfigName('');
    setShowSaveLoad(false);
  };

  const loadConfig = (config: BacktestConfig) => {
    setInitialBalance(config.initialBalance);
    setRiskPercent(config.riskPercent);
    setInterval(config.interval);
    setShowSaveLoad(false);
  };

  const deleteConfig = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    storageService.deleteBacktestConfig(id);
    setSavedConfigs(storageService.getBacktestConfigs());
  };

  const runBacktest = async () => {
    if (candles.length < 250) { // Need more data for SMA200
      addLog("Need at least 250 candles for SMA200 analysis.", 'error');
      return;
    }

    setIsRunning(true);
    stopRef.current = false;
    setTrades([]);
    setLogs([]);
    setCurrentBalance(initialBalance);
    setProgress(0);

    let balance = initialBalance;
    let activePosition: BacktestTrade | null = null;
    let trainingHistory: TrainingData[] = [];

    // Start index must be high enough to calc SMA200
    const startIndex = Math.max(200, candles.length - 200); 
    const totalSteps = candles.length - startIndex;

    addLog(`Starting Neural Network Backtest Simulation...`, 'info');

    for (let i = startIndex; i < candles.length; i++) {
      if (stopRef.current) break;

      const currentCandle = candles[i];
      const slice = candles.slice(0, i + 1);
      
      const closes = slice.map(c => c.close);
      const highs = slice.map(c => c.high);
      const lows = slice.map(c => c.low);
      const volumeSma = calculateSMA(slice.map(c => c.volume), 20);
      const sma200 = calculateSMA(closes, 200);
      const sr = findSupportResistance(slice);
      
      // Calculate indicators for every candle to update visualization
      const indicators: TechnicalIndicators = {
          rsi: calculateRSI(closes),
          sma200: sma200,
          sma50: calculateSMA(closes, 50),
          ema20: calculateEMA(closes, 20),
          volumeSma,
          fibLevels: calculateFibonacci(Math.max(...highs.slice(-50)), Math.min(...lows.slice(-50)), analyzeTrend(slice, sma200)),
          trend: analyzeTrend(slice, sma200),
          nearestSupport: sr.support,
          nearestResistance: sr.resistance
      };

      if (i % 2 === 0) {
          setVisibleCandles(slice.slice(-100));
          setVisibleIndicators(indicators);
      }
      setProgress(Math.round(((i - startIndex) / totalSteps) * 100));

      // 1. Manage Active Position
      if (activePosition) {
        let closeType: 'WIN' | 'LOSS' | null = null;
        let exitPrice = 0;

        // Check Stops (Strict exit rules)
        if (activePosition.type === 'BUY') {
            if (currentCandle.low <= activePosition.stopLoss) {
                closeType = 'LOSS';
                exitPrice = activePosition.stopLoss;
            } else if (currentCandle.high >= activePosition.takeProfit) {
                closeType = 'WIN';
                exitPrice = activePosition.takeProfit;
            }
        } else if (activePosition.type === 'SELL') {
            if (currentCandle.high >= activePosition.stopLoss) {
                closeType = 'LOSS';
                exitPrice = activePosition.stopLoss;
            } else if (currentCandle.low <= activePosition.takeProfit) {
                closeType = 'WIN';
                exitPrice = activePosition.takeProfit;
            }
        }

        if (closeType) {
            const pnl = activePosition.type === 'BUY' 
                ? (exitPrice - activePosition.entryPrice) * activePosition.quantity
                : (activePosition.entryPrice - exitPrice) * activePosition.quantity;

            balance += pnl;
            setCurrentBalance(balance);

            const closedTrade: BacktestTrade = {
                ...activePosition,
                exitTime: currentCandle.time,
                exitPrice,
                pnl,
                outcome: closeType
            };
            setTrades(prev => [closedTrade, ...prev]);
            activePosition = null;
            addLog(`Closed ${closedTrade.type} (${closeType}): ${pnl.toFixed(2)}`, closeType === 'WIN' ? 'success' : 'error');
            
            // FEEDBACK LOOP
            trainingHistory.unshift({
                id: Math.random().toString(36).substr(2, 9),
                pattern: 'AI Strategy',
                confluence: `Trend Follow`,
                outcome: closeType,
                riskReward: Math.abs(closedTrade.takeProfit - closedTrade.entryPrice) / Math.abs(closedTrade.entryPrice - closedTrade.stopLoss),
                note: `Backtest result at ${currentCandle.time}`
            });
            trainingHistory = trainingHistory.slice(0, 15); 
        }
      }

      // 2. Look for Entry 
      if (!activePosition && i % interval === 0) {
        
        const isInteresting = 
            Math.abs(currentCandle.close - indicators.sma200) / indicators.sma200 < 0.01 || // Near SMA200
            indicators.rsi < 35 || 
            indicators.rsi > 65;
        
        if (isInteresting) {
             // Use local ML Model
             await new Promise(r => setTimeout(r, 0)); // Non-blocking tick
             
             // Backtest doesn't use news sentiment simulation nicely, assume neutral 0
             const signal = await analyzeMarketWithLocalML(slice, indicators, trainingHistory, []);

             if (signal && signal.type !== 'HOLD') {
                 const riskAmt = balance * (riskPercent / 100);
                 const dist = Math.abs(signal.entryPrice - signal.stopLoss);
                 const quantity = dist > 0 ? riskAmt / dist : 0;

                 if (quantity > 0) {
                     activePosition = {
                         id: Math.random().toString(),
                         entryTime: currentCandle.time,
                         type: signal.type as 'BUY'|'SELL',
                         entryPrice: signal.entryPrice,
                         stopLoss: signal.stopLoss,
                         takeProfit: signal.takeProfit,
                         quantity,
                         pnl: 0,
                         outcome: 'OPEN'
                     };
                     addLog(`SIGNAL: ${signal.type} | R:R ${(Math.abs(signal.takeProfit - signal.entryPrice)/dist).toFixed(1)} | ${signal.reasoning}`, 'trade');
                 }
             }
        }
      }
    }

    setIsRunning(false);
    addLog("Backtest Complete.", 'info');
  };

  const stopBacktest = () => {
    stopRef.current = true;
    setIsRunning(false);
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Control Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl shadow-lg flex flex-wrap gap-4 items-end relative">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase text-slate-500 font-bold">Start Bal</label>
          <input 
              type="number" 
              value={initialBalance}
              onChange={(e) => setInitialBalance(Number(e.target.value))}
              className="w-20 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs"
            />
        </div>
        
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase text-slate-500 font-bold">Risk %</label>
          <input 
            type="number" 
            value={riskPercent}
            onChange={(e) => setRiskPercent(Number(e.target.value))}
            className="w-12 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase text-slate-500 font-bold">Interval</label>
          <input 
            type="number" 
            value={interval}
            onChange={(e) => setInterval(Number(e.target.value))}
            className="w-12 bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs"
            title="Check logic every N candles"
          />
        </div>

        {/* Config Save/Load */}
        <div className="relative pb-1">
            <button 
                onClick={() => setShowSaveLoad(!showSaveLoad)}
                className="p-2 bg-slate-800 rounded hover:bg-slate-700 text-slate-300 transition-colors"
                title="Save/Load Config"
            >
                <FolderOpen className="w-4 h-4" />
            </button>
            {showSaveLoad && (
                <div className="absolute top-10 left-0 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 p-3">
                    <div className="flex gap-2 mb-3">
                        <input 
                            type="text" 
                            placeholder="Config Name"
                            value={configName}
                            onChange={(e) => setConfigName(e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-600 rounded px-2 py-1 text-xs"
                        />
                        <button onClick={saveConfig} className="bg-blue-600 hover:bg-blue-500 px-2 rounded text-white">
                            <Save className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                        {savedConfigs.length === 0 && <p className="text-xs text-slate-500 text-center">No saved configs.</p>}
                        {savedConfigs.map(config => (
                            <div key={config.id} onClick={() => loadConfig(config)} className="flex justify-between items-center p-2 hover:bg-slate-700 rounded cursor-pointer group">
                                <span className="text-xs text-slate-300">{config.name}</span>
                                <button 
                                    onClick={(e) => deleteConfig(config.id, e)}
                                    className="opacity-0 group-hover:opacity-100 text-rose-400 hover:text-rose-300"
                                >
                                    <Trash2 className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>

        <div className="flex-1"></div>

        {!isRunning ? (
          <button onClick={runBacktest} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-6 py-2 rounded-lg font-bold transition-colors text-xs uppercase tracking-wider shadow-lg shadow-blue-900/20">
            <Play className="w-4 h-4" /> Start Simulation
          </button>
        ) : (
          <button onClick={stopBacktest} className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 px-6 py-2 rounded-lg font-bold transition-colors text-xs uppercase tracking-wider">
            <Square className="w-4 h-4 fill-current" /> Stop
          </button>
        )}
      </div>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        
        {/* Left: Chart & Stats */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
             {/* Chart Visualization */}
             <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg min-h-[300px] flex flex-col">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-500 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" /> SIMULATION VISUALIZER (LOCAL NEURAL NET)
                    </span>
                    <span className="text-xs font-mono text-slate-600">
                        {visibleCandles.length > 0 ? visibleCandles[visibleCandles.length-1].time : '--:--'}
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

             {/* KPIs */}
             <div className="grid grid-cols-4 gap-4">
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Net Profit</span>
                    <div className={`text-lg font-mono font-bold ${stats.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {stats.netProfit >= 0 ? '+' : ''}{stats.netProfit.toFixed(2)}
                    </div>
                </div>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Win Rate</span>
                    <div className="text-lg font-mono font-bold text-white">
                        {stats.winRate.toFixed(1)}%
                    </div>
                </div>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Total Trades</span>
                    <div className="text-lg font-mono font-bold text-blue-400">
                        {stats.totalTrades}
                    </div>
                </div>
                <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 relative overflow-hidden">
                    <div className="absolute inset-0 bg-blue-600/10" style={{ width: `${progress}%` }}></div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold relative z-10">Progress</span>
                    <div className="text-lg font-mono font-bold text-white relative z-10">
                        {progress}%
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
                        {logs.length === 0 && <div className="text-slate-700 italic text-center mt-10">Ready to start simulation</div>}
                        {logs.map((log, i) => (
                            <div key={i} className={`pb-1 border-b border-slate-900/50 flex gap-2 ${
                                log.type === 'error' ? 'text-rose-400' : 
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

export default BacktestPanel;