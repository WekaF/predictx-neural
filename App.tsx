import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, Zap, TrendingUp, TrendingDown, RefreshCw, ShieldCheck, DollarSign, BrainCircuit, Target, BookOpen, FlaskConical, LayoutDashboard, ChevronDown, Layers, Globe, Radio, PenTool, AlertCircle, CheckCircle2, List, Bell, Edit3, Settings as SettingsIcon, Coins, AlertTriangle, CheckCircle, XCircle, BarChart3, Trash2, Settings, Brain, UploadCloud, Clock, PauseCircle, PlayCircle } from 'lucide-react';
import { FuturesDashboard } from './components/FuturesDashboard';
import { TradingJournal } from './components/TradingJournal';
import { TradingLog } from './types';
import ModernCandleChart from './components/CandleChart';
import BacktestPanel from './components/BacktestPanel';
import TradeConfirmationModal from './components/TradeConfirmationModal';
import ManualTradeModal from './components/ManualTradeModal';
import StrategyGuideModal from './components/StrategyGuideModal';
import TradeList from './components/TradeList';
import AlertsPanel from './components/AlertsPanel';
import FeedbackEditorModal from './components/FeedbackEditorModal';
import SettingsModal from './components/SettingsModal';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { LeverageDashboard } from './components/LeverageDashboard';
import { OrderBook } from './components/OrderBook';
import { TrainingPanel } from './components/TrainingPanel';
import { TrainingHistory } from './components/TrainingHistory';
import { HeaderControls } from './components/HeaderControls';
import { calculateRSI, calculateFibonacci, analyzeTrend, calculateSMA, calculateEMA, findSupportResistance, calculateMACD, calculateStochastic, calculateMomentum, detectRSIDivergence, calculateSeriesRSI } from './utils/technical';
import { getHistoricalKlines, getCurrentPrice } from './services/binanceService';
import { getAccountBalances } from './services/binanceTradingService';
import { analyzeMarket, trainModel, refreshModel, batchTrainModel, optimizeHyperparameters } from './services/mlService';
import { marketContextService } from './services/marketContextService';
import { batchTrainingService, enrichTradeWithContext } from './services/batchTrainingService';
import binanceTradingService from './services/binanceTradingService';
import { hyperparameterOptimizer } from './services/hyperparameterOptimizer';
import { TradeAnalyticsDashboard } from './components/TradeAnalyticsDashboard';
import TrainingDashboard from './components/TrainingDashboard';
import { BatchTrainingPanel } from './components/BatchTrainingPanel';
import { HyperparameterOptimizer } from './components/HyperparameterOptimizer';
import { OpenOrders } from './components/OpenOrders';
import { EnhancedExecutedTrade } from './types/enhanced';
import { generateMarketNews, calculateAggregateSentiment } from './services/newsService';
import { storageService } from './services/storageService';
import { sendWebhookNotification } from './services/webhookService';
import { NotificationService } from './services/notificationService';
import * as binanceService from './services/binanceService';
import * as forexService from './services/forexService';
import { smcService } from './services/smcService';
import { Candle, TechnicalIndicators, TradeSignal, TrainingData, NewsItem, Alert, ExecutedTrade, Asset } from './types';
import { generateUUID } from './utils/uuid';
import { Analytics } from "@vercel/analytics/react"
import { futuresRiskManager } from './services/futuresRiskManager';
import { liquidationCalculator } from './services/liquidationCalculator';
import { OrderList, BinanceOrder } from './components/OrderList';



// Supported Assets Configuration
// Now loaded dynamically from Binance Futures API
const INITIAL_ASSET: Asset = { symbol: 'BTC/USDT', name: 'Bitcoin', type: 'CRYPTO', price: 0 };

function App() {  
  const [candles, setCandles] = useState<Candle[]>([]);
  const [indicators, setIndicators] = useState<TechnicalIndicators | null>(null);

  // Asset State
  const [supportedAssets, setSupportedAssets] = useState<Asset[]>([INITIAL_ASSET]);
  const [selectedAsset, setSelectedAsset] = useState<Asset>(INITIAL_ASSET);
  const [isAssetLoading, setIsAssetLoading] = useState(true);

  // Load Dynamic Assets
  useEffect(() => {
    // Clear cache on boot to ensure we get fresh Futures data (overwriting any potential Spot data)
    binanceService.clearCache();

    const loadAssets = async () => {
      try {
        const assets = await binanceService.fetchTopAssets();
        if (assets.length > 0) {
          setSupportedAssets(assets);
          // If current selected asset is default placeholder, switch to first real asset
          if (selectedAsset.symbol === 'BTC/USDT' && !selectedAsset.price) {
             setSelectedAsset(assets[0]);
          }
        }
      } catch (e) {
        console.error("Failed to load assets", e);
      } finally {
        setIsAssetLoading(false);
      }
    };
    loadAssets();
  }, []);

  // Auto-detect Demo Key and force Testnet
  useEffect(() => {
    const demoKey = "WaBJscL1raLkhUB2KcyyiTxNguObcqeWYELLeTxkXvVZbJpygUxYQuvgbl9HQEjK";
    const configuredKey = import.meta.env.VITE_BINANCE_API_KEY_TESTNET;
    
    if (configuredKey === demoKey) {
        const settings = storageService.getSettings();
        if (!settings.useTestnet) {
            console.log('[App] 🔧 Auto-enabling Testnet for Demo Key');
            storageService.saveSettings({
                ...settings,
                useTestnet: true
            });
            // Force page reload to ensure all components pick up the change
            window.location.reload();
        }
    }
  }, []);

  const [isAssetMenuOpen, setIsAssetMenuOpen] = useState(false);
  const [selectedInterval, setSelectedInterval] = useState<string>('15m'); // Candle interval

  // Trade States
  const [pendingSignal, setPendingSignal] = useState<TradeSignal | null>(null); // Awaiting confirmation
  const [activeSignal, setActiveSignal] = useState<TradeSignal | null>(null); // Confirmed & Active

  // Helper to map raw logs to EnhancedExecutedTrade
  const mapToEnhancedTrades = (logs: any[]): EnhancedExecutedTrade[] => {
    return logs.map((log: any) => {
      // Ensure we have valid timestamps
      const now = new Date().toISOString();
      const entryTime = log.entryTime || log.created_at || log.entry_time || now;
      const exitTime = log.exitTime || log.updated_at || log.exit_time || entryTime;
      
      return {
        id: log.id,
        symbol: log.symbol,
        entryTime,
        exitTime,
        type: log.type,
        entryPrice: log.entryPrice || log.entry_price || 0,
        exitPrice: log.exitPrice || log.exit_price || 0,
        stopLoss: log.stopLoss || log.stop_loss || 0,
        takeProfit: log.takeProfit || log.take_profit || 0,
        quantity: log.quantity || 0,
        pnl: log.pnl || 0,
        outcome: log.outcome || 'PENDING',
        source: log.source || 'AI',
        marketContext: log.marketContext || log.market_context,
        patternDetected: log.patternDetected || log.pattern_detected,
        confluenceFactors: log.confluenceFactors || log.confluence_factors,
        aiConfidence: log.aiConfidence || log.ai_confidence,
        aiReasoning: log.aiReasoning || log.ai_reasoning,
        holdDuration: log.holdDuration || log.hold_duration,
        riskRewardRatio: log.riskRewardRatio || log.risk_reward_ratio,
        actualRR: log.actualRR || log.actual_rr,
        tags: log.tags
      };
    });
  };
 // Confirmed & Active
  const [tradeHistory, setTradeHistory] = useState<EnhancedExecutedTrade[]>([]);
  const [orderHistory, setOrderHistory] = useState<BinanceOrder[]>([]);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'trades' | 'orders'>('trades');

  // UI States
  const [showManualModal, setShowManualModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isSyncingHistory, setIsSyncingHistory] = useState(false);
  const [isSyncingOrders, setIsSyncingOrders] = useState(false);
  const [showStrategyGuide, setShowStrategyGuide] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState<TrainingData | null>(null);
  const [terminalTab, setTerminalTab] = useState<'trade' | 'data'>('trade'); // Mobile Tab State
  const [isMobileDataExpanded, setIsMobileDataExpanded] = useState(false); // Mobile collapsible state

  // Trading Configuration
  const [tradingMode, setTradingMode] = useState<'paper' | 'live'>(() => storageService.getTradingMode() ?? 'paper');
  const [leverage, setLeverage] = useState(() => storageService.getLeverage() ?? 10); // 1-20x
  const [isFuturesExpanded, setIsFuturesExpanded] = useState(true);

  // PWA Install Prompt
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  // Notification State
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [balance, setBalance] = useState(() => storageService.getBalance() ?? 1000); // 1000 default virtual balance
  
  // Helper to update and persist balance
  const updateBalance = useCallback((updater: number | ((prev: number) => number)) => {
    setBalance(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      storageService.saveBalance(next);
      return next;
    });
  }, []);

  const [riskPercent, setRiskPercent] = useState(1);
  const [trainingHistory, setTrainingHistory] = useState<TrainingData[]>([]);
  const [autoMode, setAutoMode] = useState(() => storageService.getAutoTradeState());

  // News & Sentiment
  const [marketNews, setMarketNews] = useState<NewsItem[]>([]);
  const [sentimentScore, setSentimentScore] = useState(0); // -1 to 1

  // Navigation & Config
  const [currentView, setCurrentView] = useState<'terminal' | 'backtest' | 'analytics' | 'leverage' | 'journal' | 'training' | 'ai-intelligence'>('terminal');
  const [dbConnected, setDbConnected] = useState(false);
  const [aiReady, setAiReady] = useState(false);

  // Mass Training State
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [lastAnalysis, setLastAnalysis] = useState<TradeSignal | null>(null);

  // Load Persistence
  useEffect(() => {
    // 1. Load Local Persistence Immediate
    const savedData = storageService.getTrainingData();
    if (savedData.length > 0) {
      setTrainingHistory(savedData);
      console.log(`[App] Loaded ${savedData.length} training records from local storage`);
    }

    // 1b. Load Trade History (Local + Cloud Sync)
    const loadTradeHistory = async () => {
      // 1. Load local logs first for immediate UI update
      const localLogs = storageService.getTradingLogs();
      const localTrades = mapToEnhancedTrades(localLogs);
      
      if (localTrades.length > 0) {
        setTradeHistory(localTrades);
      }

      // 2. Fetch from cloud and merge
      try {
        const cloudLogs = await storageService.fetchTradingLogsFromSupabase();
        if (cloudLogs.length > 0) {
          const cloudTrades = mapToEnhancedTrades(cloudLogs);
          
          // Use Map for deduplication - Cloud data takes precedence for same IDs
          const tradeMap = new Map<string, EnhancedExecutedTrade>();
          
          // Add local trades first
          localTrades.forEach(t => tradeMap.set(t.id, t));
          // Add/Overwrite with cloud trades
          cloudTrades.forEach(t => tradeMap.set(t.id, t));
          
          const merged = Array.from(tradeMap.values()).sort((a, b) => 
            new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime()
          );
          
          setTradeHistory(merged);
          console.log(`[App] ✅ Trade history merged. Total: ${merged.length} (Synced from Supabase)`);
        }
      } catch (error) {
        console.error('[App] Failed to sync trade history from Supabase:', error);
      }
    };
    loadTradeHistory();
  }, []);

  // --- DYNAMIC TRADE MANAGER (SMC LOGIC) ---
  // Monitors active trades for Break Even, Trailing SL, and Limit Order Fills
  useEffect(() => {
    if (!activeSignal || !activeSignal.execution) return;

    // CRITICAL GUARD: activeSignal must match current chart symbol
    // If not, we cannot manage it with current candles.
    if (activeSignal.symbol !== selectedAsset.symbol) {
         return;
    }
    
    // Also check if candles are valid
    if (!candles || candles.length === 0) return;

    const manageTrade = async () => {
      try {
        const { symbol, execution } = activeSignal;
        const tradeSymbol = symbol.replace('/', '').replace(/USD$/, 'USDT');
        const currentPrice = candles[candles.length - 1]?.close;
        
        if (!currentPrice) return;

        // 1. HANDLE PENDING LIMIT ORDERS
        if (execution.status === 'PENDING_LIMIT') {
             // Check if Order is Filled
             const orderId = execution.orderId;
             if (!orderId) return;

             const orderStatus = await binanceTradingService.getOpenOrder(tradeSymbol, orderId);
             
             if (orderStatus.status === 'FILLED') {
                 console.log('[Trade Manager] 🚀 Limit Order FILLED! Placing OCO...');
                 
                 // Limit Fill -> Active Trade. Now place OCO.
                 try {
                    const rawStopPrice = execution.sl;
                    const rawStopLimitPrice = execution.side === 'BUY' 
                        ? rawStopPrice * 0.995 
                        : rawStopPrice * 1.005;
                    const rawTakeProfitPrice = execution.tp;
                    
                    const [stopPrice, stopLimitPrice, takeProfitPrice] = await Promise.all([
                        binanceTradingService.roundPrice(tradeSymbol, rawStopPrice),
                        binanceTradingService.roundPrice(tradeSymbol, rawStopLimitPrice),
                        binanceTradingService.roundPrice(tradeSymbol, rawTakeProfitPrice)
                    ]);

                    const ocoOrder = await binanceTradingService.placeOCOOrder({
                        symbol: tradeSymbol,
                        side: execution.side === 'BUY' ? 'SELL' : 'BUY',
                        quantity: execution.quantity, // Quantity from execution
                        price: takeProfitPrice,
                        stopPrice: stopPrice,
                        stopLimitPrice: stopLimitPrice
                    });

                    // Update State to FILLED
                    const updatedSignal = {
                        ...activeSignal,
                        execution: {
                            ...execution,
                            status: 'FILLED',
                            execution_status: 'FILLED', // Sync both fields
                            ocoId: ocoOrder.orderListId
                        }
                    };
                    setActiveSignal(updatedSignal);
                    storageService.saveActiveSignal(updatedSignal, symbol);
                    showNotification("✅ Limit Order Filled! OCO Safety Placed.", "success");

                 } catch (ocoErr) {
                     console.error('[Trade Manager] Failed to place OCO after fill:', ocoErr);
                     showNotification("⚠️ Limit Filled but OCO Failed! Manual Close Required!", "error");
                 }
             } else if (orderStatus.status === 'CANCELED' || orderStatus.status === 'EXPIRED') {
                 console.log('[Trade Manager] Limit Order Canceled/Expired.');
                 setActiveSignal(null); // Clear signal
                 storageService.clearActiveSignal(symbol);
             }
        }

        // 2. HANDLE ACTIVE TRADES (Break Even & Trailing)
        if (execution.status === 'FILLED' && execution.mode !== 'paper') { // Only manage real trades
             const entryPrice = execution.entryPrice || activeSignal.entryPrice; // Ensure we have entry price
             if (!entryPrice) return;

             // Calculate PnL %
             let pnlPercent = 0;
             if (execution.side === 'BUY') {
                 pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100 * execution.leverage;
             } else {
                 pnlPercent = ((entryPrice - currentPrice) / entryPrice) * 100 * execution.leverage;
             }

             // A. AUTO BREAK EVEN (+1.5% Profit)
             // Check if SL is already at Entry (or better)
             const isSLAtEntry = execution.side === 'BUY' ? execution.sl >= entryPrice : execution.sl <= entryPrice;
             
             if (pnlPercent >= 1.5 && !isSLAtEntry) {
                 console.log('[Trade Manager] 🛡️ Moving SL to Break Even...');
                 
                 // Cancel old SL/OCO
                 if (execution.ocoId) {
                     await binanceTradingService.cancelAllOrders(tradeSymbol);
                 }

                 // Place New Stop Loss at Entry
                 const newSL = await binanceTradingService.roundPrice(tradeSymbol, entryPrice);
                 
                 try {
                     const tpPrice = await binanceTradingService.roundPrice(tradeSymbol, execution.tp);
                     const slLimit = execution.side === 'BUY' ? newSL * 0.999 : newSL * 1.001;
                     
                     await binanceTradingService.placeOCOOrder({
                         symbol: tradeSymbol,
                         side: execution.side === 'BUY' ? 'SELL' : 'BUY',
                         quantity: execution.quantity,
                         price: tpPrice,
                         stopPrice: newSL,
                         stopLimitPrice: await binanceTradingService.roundPrice(tradeSymbol, slLimit)
                     });
                     
                     // Update State
                     const updatedSignal = {
                         ...activeSignal,
                         execution: { ...execution, sl: newSL, managementStatus: 'BE_SET' }
                     };
                     setActiveSignal(updatedSignal);
                     storageService.saveActiveSignal(updatedSignal, symbol);
                     showNotification("🛡️ Stop Loss moved to Break Even!", "success");
                 } catch (err) {
                     console.error('[Trade Manager] Failed to move SL:', err);
                 }
             }
        }

      } catch (err) {
        console.error('[Trade Manager] Error:', err);
      }
    };

    const interval = setInterval(manageTrade, 5000); // Check every 5s
    return () => clearInterval(interval);
  }, [activeSignal, candles, selectedAsset.symbol]); // Depend on symbol to re-run guard

  // Show Notification Helper (Defined early to avoid circular dependency)
  const showNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000); // Auto hide after 5s
  };

  // --- STATE RECONCILIATION (SYNC WITH BINANCE) ---
  // Prevents "Double Entry" and "Ghost Trades" by syncing with actual exchange state
  const lastClearedSignalRef = useRef<string | null>(null); // Track last cleared signal to prevent duplicate notifications
  
  const syncStateWithBinance = useCallback(async () => {
    if (!selectedAsset || selectedAsset.type !== 'CRYPTO') {
        console.log('[Sync] ⏭️ Skipping sync: Not a crypto asset');
        return;
    }

    try {
        const symbol = selectedAsset.symbol.replace('/', '').replace(/USD$/, 'USDT');
        console.log(`[Sync] 🔄 Checking Binance positions for ${symbol}...`);
        console.log(`[Sync] Current activeSignal:`, activeSignal ? `${activeSignal.type} ${activeSignal.symbol}` : 'NONE');
        
        const positions = await binanceTradingService.getPositions(symbol);
        console.log(`[Sync] 📊 Received ${positions.length} positions from Binance:`, positions);
        
        const activePosition = positions.find(p => parseFloat(p.positionAmt) !== 0);
        console.log(`[Sync] 🎯 Active position found:`, activePosition ? `${parseFloat(activePosition.positionAmt)} @ ${activePosition.entryPrice}` : 'NONE');

        // CASE 1: Binance HAS position, but local is EMPTY → RESTORE
        if (activePosition && !activeSignal) {
            console.log(`[Sync] ⚠️ Found ORPHANED position on Binance! Restoring...`, activePosition);
            
            const size = parseFloat(activePosition.positionAmt);
            const entryPrice = parseFloat(activePosition.entryPrice);
            const side = size > 0 ? 'BUY' : 'SELL';
            const realLiquidationPrice = parseFloat(activePosition.liquidationPrice);
            const lev = parseInt(activePosition.leverage);
            
            console.log(`[Sync] 📝 Position details: ${side} ${Math.abs(size)} @ ${entryPrice}, Lev: ${lev}x, Liq: ${realLiquidationPrice}`);
            
            // Attempt to find open orders to infer TP/SL
            const openOrders = await binanceTradingService.getOpenOrders(symbol);
            console.log(`[Sync] 📋 Found ${openOrders.length} open orders:`, openOrders);
            
            const tpOrder = openOrders.find(o => o.type === 'TAKE_PROFIT_MARKET' || (o.type === 'LIMIT' && o.reduceOnly));
            const slOrder = openOrders.find(o => o.type === 'STOP_MARKET' || o.type === 'STOP_LOSS_MARKET');
            
            const tp = tpOrder ? parseFloat(tpOrder.stopPrice || tpOrder.price) : 0;
            const sl = slOrder ? parseFloat(slOrder.stopPrice || slOrder.price) : 0;
            
            console.log(`[Sync] 🎯 TP: ${tp}, SL: ${sl}`);

            // Calculate safety margin using REAL liquidation
            const slDistance = Math.abs(entryPrice - sl);
            const liqDistance = Math.abs(entryPrice - realLiquidationPrice);
            const safetyMargin = entryPrice > 0 ? ((liqDistance - slDistance) / entryPrice) * 100 : 0;
            
            let riskLevel: 'SAFE' | 'MODERATE' | 'HIGH' | 'EXTREME';
            if (safetyMargin > 5) riskLevel = 'SAFE';
            else if (safetyMargin > 2) riskLevel = 'MODERATE';
            else if (safetyMargin > 0) riskLevel = 'HIGH';
            else riskLevel = 'EXTREME';

            const restoredSignal: TradeSignal = {
                id: 'restored-' + Date.now(),
                type: side,
                symbol: selectedAsset.symbol,
                entryPrice: entryPrice,
                quantity: Math.abs(size),
                stopLoss: sl,
                takeProfit: tp,
                outputToken: 'USDT',
                confidence: 0,
                reasoning: 'Restored from Active Exchange Position',
                outcome: 'PENDING',
                timestamp: Date.now(),
                execution: {
                    status: 'FILLED',
                    execution_status: 'FILLED',
                    entryPrice: entryPrice,
                    quantity: Math.abs(size),
                    filled: Math.abs(size),
                    side: side,
                    leverage: lev,
                    mode: 'live',
                    tp: tp,
                    sl: sl
                },
                meta: {
                    liquidation_info: {
                        liquidationPrice: realLiquidationPrice,
                        marginRatio: (1 / lev) * 100,
                        safetyMargin: Number(safetyMargin.toFixed(2)),
                        riskLevel: riskLevel
                    },
                    recommended_leverage: lev
                }
            };
            
            console.log(`[Sync] ✅ Restoring signal:`, restoredSignal);
            setActiveSignal(restoredSignal);
            storageService.saveActiveSignal(restoredSignal, selectedAsset.symbol);
            showNotification(`♻️ Restored active ${side} position for ${selectedAsset.symbol}`, 'success');
            
            // Reset cleared signal tracker since we restored
            lastClearedSignalRef.current = null;
        }
        // CASE 2: Binance has NO position, but local HAS signal → CLEAR (closed externally)
        else if (!activePosition && activeSignal && activeSignal.outcome === 'PENDING') {
            // Only notify if this is a NEW closure (not already notified)
            if (lastClearedSignalRef.current !== activeSignal.id) {
                console.log(`[Sync] 🧹 Position closed externally. Clearing local signal...`);
                lastClearedSignalRef.current = activeSignal.id; // Mark as notified
                setActiveSignal(null);
                storageService.clearActiveSignal(selectedAsset.symbol);
                showNotification(`Position for ${selectedAsset.symbol} was closed externally`, 'info');
            } else {
                console.log(`[Sync] ⏭️ Already notified about closure for signal ${activeSignal.id}, skipping notification`);
            }
        }
        // CASE 3: Both match or both empty → OK, do nothing
        else {
            console.log(`[Sync] ✅ State is synchronized (both have position or both empty)`);
        }
    } catch (e) {
        console.error('[Sync] ❌ Failed to sync with Binance:', e);
    }
  }, [selectedAsset, activeSignal]); // Removed showNotification to avoid circular dependency

  // Run Sync on mount and interval
  useEffect(() => {
     syncStateWithBinance();
     const id = setInterval(syncStateWithBinance, 10000); // Check every 10s
     return () => clearInterval(id);
  }, [syncStateWithBinance]);

  // Reusable balance fetcher
  const fetchBalance = useCallback(async () => {
      try {
        // console.log(`[App] 💰 Fetching balance for ${selectedAsset.symbol}...`);
        const balances = await getAccountBalances();
        
        // For Futures trading, we typically want the USDT (or USDC) balance as margin/wallet balance
        const quoteCurrency = 'USDT';
        const marginBalance = balances.find(b => b.asset === quoteCurrency) || 
                            balances.find(b => b.asset === 'USDC');
        
        // Use marginBalance (Equity) if available to show PNL fluctuations, otherwise free (Available)
        const equity = marginBalance?.marginBalance ? parseFloat(marginBalance.marginBalance) : 0;
        const available = parseFloat(marginBalance?.free || '0');
        
        const displayBalance = equity > 0 ? equity : available;
        
        if (displayBalance > 0) {
            updateBalance(displayBalance);
            // console.log(`[App] ✅ Balance Update: ${displayBalance.toFixed(2)}`);
        }
      } catch (error) {
        // console.error('[App] ❌ Failed to load Binance balance:', error);
      }
  }, [selectedAsset, updateBalance]);

  // Load balance when selectedAsset changes or on mount
  useEffect(() => {
    fetchBalance();
    
    // Poll for balance updates (Real-time Equity/PNL) every 3 seconds
    const intervalId = setInterval(fetchBalance, 3000);

    // Restore Active Signal if any
    const savedSignal = storageService.getActiveSignal(selectedAsset.symbol);
    if (savedSignal && savedSignal.symbol === selectedAsset.symbol) {
      console.log('[App] ♻️ Restored active signal for:', selectedAsset.symbol);
      setActiveSignal(savedSignal);
      
      // Override UI settings
      if (savedSignal.execution?.leverage) setLeverage(savedSignal.execution.leverage);
      if (savedSignal.execution?.mode) setTradingMode(savedSignal.execution.mode);
    }
    
    // Restore Last Analysis (Engine Scan) if any for this asset
    const savedAnalysis = storageService.getLastAnalysis(selectedAsset.symbol);
    if (savedAnalysis) {
      console.log('[App] ♻️ Restored last analysis for:', selectedAsset.symbol);
      setLastAnalysis(savedAnalysis);
    } else {
      setLastAnalysis(null);
    }

    return () => clearInterval(intervalId);
  }, [selectedAsset, fetchBalance]);

  // Handle manual/external trade close from OpenOrders component
  const handleExternalTradeClosed = useCallback(async (trade: any) => {
      console.log('[App] 📥 External trade closed:', trade);
      
      const pnl = parseFloat(trade.realizedPnl || '0');
      const outcome = pnl > 0 ? 'WIN' : 'LOSS';
      
      const newTrade: EnhancedExecutedTrade = {
          id: trade.orderId ? String(trade.orderId) : generateUUID(),
          symbol: trade.symbol,
          entryTime: new Date(trade.time).toISOString(),
          exitTime: new Date(trade.time).toISOString(),
          type: trade.side === 'BUY' ? 'BUY' : 'SELL', // This is the closing side
          entryPrice: 0, // Unknown without context
          exitPrice: parseFloat(trade.price),
          quantity: parseFloat(trade.qty),
          pnl: pnl,
          outcome: outcome,
          source: 'MANUAL',
          marketContext: null,
          aiConfidence: 0,
          aiReasoning: 'Manual Close via Dashboard',
          tags: ['MANUAL_CLOSE'],
          stopLoss: 0,
          takeProfit: 0
      };
      
      // Save and update state
      await storageService.saveTradingLog(newTrade);
      setTradeHistory(prev => [newTrade, ...prev]);
      
      // Show notification
      setNotification({
          message: `Trade Closed via App: ${trade.symbol} (${outcome}) ${pnl > 0 ? '+' : ''}${pnl.toFixed(2)} USDT`,
          type: outcome === 'WIN' ? 'success' : 'error'
      });

      // SYNC BALANCE IMMEDIATELY
      await fetchBalance();
      
  }, [fetchBalance]);

  // Initialize PWA and other app setup
  useEffect(() => {
    // 3. Setup PWA Install Prompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
      console.log('[PWA] Install prompt available');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Request Notification Permission
    const requestNotificationPermission = async () => {
      if (NotificationService.isSupported()) {
        const granted = await NotificationService.requestPermission();
        if (granted) {
          console.log('[Notifications] ✅ Permission granted');
        } else {
          console.log('[Notifications] ⚠️ Permission denied');
        }
      }
    };

    // Request permission after 3 seconds (don't overwhelm user on first load)
    setTimeout(requestNotificationPermission, 3000);

    // 5. Sync from Supabase (Background)
    const syncFromSupabase = async () => {
      const remoteData = await storageService.fetchTrainingDataFromSupabase();
      if (remoteData) {
        console.log("Synced training data from Supabase DB");
        setDbConnected(true);
        if (remoteData.length > 0) setTrainingHistory(remoteData);
      } else {
        setDbConnected(false);
      }
    };

    syncFromSupabase();

    // 4. Sync ML Model Weights
    storageService.fetchModelWeightsFromSupabase().then(weights => {
      if (weights) {
        refreshModel(); // Reload brain with cloud weights
        showNotification("AI Model synced from Supabase Cloud", "success");
      }
    });

    // Check AI Key
    if (import.meta.env.VITE_GEMINI_API_KEY) {
      setAiReady(true);
    }

    // Load Auto Mode State
    const savedAutoMode = storageService.getAutoTradeState();
    setAutoMode(savedAutoMode);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Initialize Data whenever Asset changes - REAL-TIME API INTEGRATION
  useEffect(() => {
    let ws: WebSocket | null = null;
    let pollingInterval: number | null = null;
    let isActive = true;

    const loadMarketData = async () => {
      try {
        console.log(`[App] Loading market data for ${selectedAsset.symbol} (${selectedAsset.type})...`);

        // Clear previous data ONLY if not in cache (Smart Loading)
        if (!binanceService.hasCachedData(selectedAsset.symbol, selectedInterval)) {
             setCandles([]);
        }
        setPendingSignal(null);

        if (activeSignal?.outcome === 'PENDING') {
          showNotification(`Switched asset. Active trade on previous asset hidden but running in background.`, 'info');
        }

        // Fetch initial news
        const news = generateMarketNews();
        setMarketNews(news);
        setSentimentScore(calculateAggregateSentiment(news));

        // CRYPTO ASSETS - Use Binance WebSocket
        if (selectedAsset.type === 'CRYPTO' && binanceService.isBinanceSupported(selectedAsset.symbol)) {
          // 1. Fetch historical data (1000 candles for chart + indicators)
          const historicalCandles = await binanceService.getHistoricalKlines(selectedAsset.symbol, selectedInterval, 1000);

          if (!isActive) return; // Component unmounted

          setCandles(historicalCandles);
          console.log(`[App] ✅ Loaded ${historicalCandles.length} historical candles for ${selectedAsset.symbol}`);

          // 2. Connect WebSocket for real-time updates
          ws = binanceService.connectKlineStream(selectedAsset.symbol, selectedInterval, (candle, isClosed) => {
            if (!isActive) return;

            setCandles(prev => {
              // If candle is closed, add new candle
              if (isClosed) {
                return [...prev.slice(-999), candle]; // Keep last 1000 candles
              }
              // If candle is updating, replace last candle
              const updated = [...prev];
              updated[updated.length - 1] = candle;
              return updated;
            });
          });

          showNotification(`📡 Connected to Binance live data for ${selectedAsset.symbol}`, 'success');
        }
        // FOREX/COMMODITY ASSETS - Use Twelve Data Polling
        else if (selectedAsset.type === 'FOREX' && forexService.isForexSupported(selectedAsset.symbol)) {
          // 1. Fetch historical data
          const historicalCandles = await forexService.getForexCandles(selectedAsset.symbol, '1min', 1000);

          if (!isActive) return;

          setCandles(historicalCandles);
          console.log(`[App] ✅ Loaded ${historicalCandles.length} historical candles for ${selectedAsset.symbol}`);

          // 2. Start polling for updates (every 5s)
          pollingInterval = forexService.startForexPolling(selectedAsset.symbol, '1min', (candle) => {
            if (!isActive) return;

            setCandles(prev => {
              // Check if this is a new candle or update to existing
              const lastCandle = prev[prev.length - 1];
              if (lastCandle && Math.abs(Number(lastCandle.time) - Number(candle.time)) < 60000) {
                // Update existing candle
                const updated = [...prev];
                updated[updated.length - 1] = candle;
                return updated;
              } else {
                // New candle
                return [...prev.slice(-999), candle];
              }
            });
          });

          showNotification(`📡 Connected to Forex live data for ${selectedAsset.symbol}`, 'success');
        }
        // FALLBACK - Use mock data if API not supported
        else {
          console.log(`[App] 📊 Loading Binance data for ${selectedAsset.symbol}...`);

          // Fetch real-time price from Binance
          const currentPrice = await getCurrentPrice(selectedAsset.symbol);
          console.log(`[App] 💰 Current ${selectedAsset.symbol} price: $${currentPrice}`);

          // Update asset price
          setSelectedAsset(prev => ({ ...prev, price: currentPrice }));

          // Fetch historical candles from Binance (last 1000 1-minute candles)
          const binanceCandles = await getHistoricalKlines(selectedAsset.symbol, selectedInterval, 1000);

          if (!isActive) return;

          setCandles(binanceCandles);
          console.log(`[App] ✅ Loaded ${binanceCandles.length} candles from Binance for ${selectedAsset.symbol}`);

          // Extract close prices for indicators
          const closePrices = binanceCandles.map(c => c.close);
          const highs = binanceCandles.map(c => c.high);
          const lows = binanceCandles.map(c => c.low);

          // Calculate technical indicators
          const rsi = calculateRSI(closePrices);
          const sma20 = calculateSMA(closePrices, 20);
          const ema12 = calculateEMA(closePrices, 12);
          const ema26 = calculateEMA(closePrices, 26);
          const sma50 = calculateSMA(closePrices, 50);
          const sma200 = calculateSMA(closePrices, 200);
          const fibonacci = calculateFibonacci(Math.max(...highs), Math.min(...lows), 'UP');
          const trend = analyzeTrend(binanceCandles, sma200);
          const supportResistance = findSupportResistance(binanceCandles);

          // New Indicators
          const macd = calculateMACD(closePrices);
          const stochastic = calculateStochastic(binanceCandles);
          const momentum = calculateMomentum(closePrices);

          setIndicators({
            rsi,
            sma20,
            ema12,
            ema26,
            sma50,
            sma200,
            volumeSma: sma20,
            fibLevels: fibonacci,
            trend,
            nearestSupport: supportResistance.support,
            nearestResistance: supportResistance.resistance,
            macd: {
              value: macd.macd,
              signal: macd.signal,
              histogram: macd.histogram
            },
            stochastic,
            momentum
          });

          showNotification(`✅ Loaded ${binanceCandles.length} candles from Binance`, 'success');
        }

      } catch (error) {
        console.error('[App] ❌ Error loading market data:', error);
        showNotification(`Failed to load data for ${selectedAsset.symbol}. Check connection.`, 'error');
        setCandles([]); // Clear data to indicate error state
      }
    };

    loadMarketData();

    // Cleanup function
    return () => {
      isActive = false;

      if (ws && typeof ws.close === 'function') {
        console.log(`[App] Closing WebSocket for ${selectedAsset.symbol}`);
        ws.close();
      }

      if (pollingInterval) {
        console.log(`[App] Stopping polling for ${selectedAsset.symbol}`);
        clearInterval(pollingInterval);
      }
    };
  }, [selectedAsset, selectedInterval]);

  // Toggle Auto Mode with Persistence
  const toggleAutoMode = () => {
    const newState = !autoMode;
    setAutoMode(newState);
    storageService.saveAutoTradeState(newState);

    if (newState) {
      const settings = storageService.getSettings();
      if (!settings.enableNotifications) {
        showNotification("Auto-Trade ON but Webhooks are DISABLED in Settings!", "error");
        // Prompt to open settings
        setTimeout(() => setShowSettings(true), 1500);
      } else {
        showNotification("Auto-Trade Active: Scanning for setups...", "info");
      }
    } else {
      showNotification("Auto-Trade Paused", "info");
    }
  };

  // News Updates (Simulation)
  useEffect(() => {
    const newsInterval = setInterval(() => {
      if (Math.random() > 0.7) { // 30% chance to update news every interval
        const news = generateMarketNews();
        setMarketNews(prev => [...news, ...prev].slice(0, 10)); // Keep last 10
        setSentimentScore(calculateAggregateSentiment(news));
      }
    }, 15000);
    return () => clearInterval(newsInterval);
  }, []);



  // Real-time Indicators & TP/SL Monitoring
  useEffect(() => {
    if (candles.length === 0) return;

    // 1. Update Indicators based on LATEST candles (from WebSocket/Polling)
    const closes = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const CurrentRsi = calculateRSI(closes);

    const sma200 = calculateSMA(closes, 200);
    const trend = analyzeTrend(candles, sma200);
    const sr = findSupportResistance(candles);

    const macd = calculateMACD(closes);
    const stochastic = calculateStochastic(candles);
    const momentum = calculateMomentum(closes);

    // Calculate RSI series for divergence detection
    const rsiSeries = calculateSeriesRSI(closes, 14);
    const rsiValues = rsiSeries.filter(v => v !== null) as number[];
    
    // Detect RSI divergence
    const rsiDivergence = rsiValues.length >= 20 ? detectRSIDivergence(candles.slice(-rsiValues.length), rsiValues) : null;
    
    if (rsiDivergence) {
      console.log(`[RSI Divergence] 🔍 ${rsiDivergence.type} divergence detected! Strength: ${rsiDivergence.strength}%`);
      
      // Show notification to user
      const emoji = rsiDivergence.type === 'BULLISH' ? '📈' : '📉';
      const color = rsiDivergence.type === 'BULLISH' ? 'success' : 'warning';
      showNotification(
        `${emoji} ${rsiDivergence.type} RSI Divergence detected! Strength: ${rsiDivergence.strength}%`,
        color
      );
    }

    const newIndicators = {
      rsi: CurrentRsi,
      fibLevels: calculateFibonacci(Math.max(...highs), Math.min(...lows), trend),
      trend,
      sma200,
      sma50: calculateSMA(closes, 50),
      sma20: calculateSMA(closes, 20),
      ema20: calculateEMA(closes, 20),
      ema12: calculateEMA(closes, 12),
      ema26: calculateEMA(closes, 26),
      volumeSma: calculateSMA(volumes, 20),
      nearestSupport: sr.support,
      nearestResistance: sr.resistance,
      macd: {
        value: macd.macd,
        signal: macd.signal,
        histogram: macd.histogram
      },
      stochastic,
      momentum,
      rsiDivergence
    };

    setIndicators(newIndicators);

    // 2. Monitor Active Trades (TP/SL) + Auto-Expiry
    // Only monitor if the active signal belongs to the currently selected asset
    if (!activeSignal || activeSignal.outcome !== 'PENDING') return;
    if (activeSignal.symbol !== selectedAsset.symbol) return; 

    // 2a. AUTO-EXPIRY CHECK (24 hours default)
    const AUTO_EXPIRE_HOURS = 24;
    const entryTimestamp = new Date(activeSignal.timestamp).getTime();
    const now = Date.now();
    const hoursSinceEntry = (now - entryTimestamp) / (1000 * 60 * 60);
    
    if (hoursSinceEntry > AUTO_EXPIRE_HOURS) {
      console.log(`[Auto-Expiry] Trade ${activeSignal.id} expired after ${hoursSinceEntry.toFixed(1)} hours`);
      
      // Close at current market price
      const lastCandle = candles[candles.length - 1];
      const currentPrice = lastCandle.close;
      
      // Calculate PNL
      const dist = Math.abs(activeSignal.entryPrice - activeSignal.stopLoss);
      const safeDist = dist === 0 ? 1 : dist;
      const quantity = ((balance * (riskPercent / 100)) / safeDist);
      const pnl = activeSignal.type === 'BUY'
        ? (currentPrice - activeSignal.entryPrice) * quantity
        : (activeSignal.entryPrice - currentPrice) * quantity;
      
      updateBalance(b => b + pnl);
      
      // Add to Trade History
      const expiredTrade: EnhancedExecutedTrade = {
        id: activeSignal.id,
        symbol: activeSignal.symbol,
        entryTime: new Date(activeSignal.timestamp).toISOString(),
        exitTime: new Date().toISOString(),
        type: activeSignal.type as 'BUY' | 'SELL',
        entryPrice: activeSignal.entryPrice,
        exitPrice: currentPrice,
        stopLoss: activeSignal.stopLoss,
        takeProfit: activeSignal.takeProfit,
        quantity: quantity,
        pnl: pnl,
        outcome: 'EXPIRED',
        source: activeSignal.patternDetected === "Manual Entry" ? "MANUAL" : "AI",
        marketContext: activeSignal.marketContext,
        aiConfidence: activeSignal.confidence,
        aiReasoning: `Auto-expired after ${AUTO_EXPIRE_HOURS} hours`,
        patternDetected: activeSignal.patternDetected,
        confluenceFactors: activeSignal.confluenceFactors
      };
      
      setTradeHistory(prev => [expiredTrade, ...prev]);
      storageService.saveTradingLog(expiredTrade);
      storageService.saveActiveSignal(null, activeSignal.symbol);
      setActiveSignal(prev => prev ? { ...prev, outcome: 'EXPIRED' } : null);
      
      showNotification(`Trade EXPIRED after ${AUTO_EXPIRE_HOURS}h. Closed at $${currentPrice.toFixed(2)}`, 'warning');
      return; // Exit early, don't check TP/SL
    }

    // 2b. TP/SL MONITORING
    // Check against the LAST candle's High/Low 
    const lastCandle = candles[candles.length - 1];
    const newHigh = lastCandle.high;
    const newLow = lastCandle.low;

    let closedOutcome: 'WIN' | 'LOSS' | null = null;
    let actualClosePrice = 0;
    let webhookEvent: 'TAKE_PROFIT' | 'STOP_LOSS' | null = null;

    if (activeSignal.type === 'BUY') {
      if (newLow <= activeSignal.stopLoss) {
        closedOutcome = 'LOSS';
        actualClosePrice = activeSignal.stopLoss;
        webhookEvent = 'STOP_LOSS';
        showNotification(`STOP LOSS HIT! Position Closed at ${actualClosePrice}`, 'error');
      } else if (newHigh >= activeSignal.takeProfit) {
        closedOutcome = 'WIN';
        actualClosePrice = activeSignal.takeProfit;
        webhookEvent = 'TAKE_PROFIT';
        showNotification(`TAKE PROFIT HIT! Position Closed at ${actualClosePrice}`, 'success');
      }
    } else if (activeSignal.type === 'SELL') {
      if (newHigh >= activeSignal.stopLoss) {
        closedOutcome = 'LOSS';
        actualClosePrice = activeSignal.stopLoss;
        webhookEvent = 'STOP_LOSS';
        showNotification(`STOP LOSS HIT! Position Closed at ${actualClosePrice}`, 'error');
      } else if (newLow <= activeSignal.takeProfit) {
        closedOutcome = 'WIN';
        actualClosePrice = activeSignal.takeProfit;
        webhookEvent = 'TAKE_PROFIT';
        showNotification(`TAKE PROFIT HIT! Position Closed at ${actualClosePrice}`, 'success');
      }
    }

    if (closedOutcome && webhookEvent) {
      // Auto-update balance
      const dist = Math.abs(activeSignal.entryPrice - activeSignal.stopLoss);
      const safeDist = dist === 0 ? 1 : dist;
      const quantity = ((balance * (riskPercent / 100)) / safeDist);
      const pnl = activeSignal.type === 'BUY'
        ? (actualClosePrice - activeSignal.entryPrice) * quantity
        : (activeSignal.entryPrice - actualClosePrice) * quantity;

      const riskedAmount = safeDist * quantity;

      updateBalance(b => b + pnl);

      // Add to Trade History
      const completedTrade: EnhancedExecutedTrade = {
        id: activeSignal.id,
        symbol: activeSignal.symbol,
        entryTime: new Date(activeSignal.timestamp).toISOString(),
        exitTime: lastCandle.time,
        type: activeSignal.type as 'BUY' | 'SELL',
        entryPrice: activeSignal.entryPrice,
        exitPrice: actualClosePrice,
        stopLoss: activeSignal.stopLoss,
        takeProfit: activeSignal.takeProfit,
        quantity: quantity,
        pnl: pnl,
        outcome: closedOutcome,
        source: activeSignal.patternDetected === "Manual Entry" ? "MANUAL" : "AI",
        marketContext: activeSignal.marketContext,
        aiConfidence: activeSignal.confidence,
        aiReasoning: activeSignal.reasoning,
        patternDetected: activeSignal.patternDetected,
        confluenceFactors: activeSignal.confluenceFactors
      };
      setTradeHistory(prev => [completedTrade, ...prev]);

      // Persist to localStorage and Supabase
      storageService.saveTradingLog(completedTrade);

      // --- TRIGGER AUTOMATION ---
      sendWebhookNotification(webhookEvent, activeSignal, actualClosePrice).then(res => {
        if (res.success) {
          if (res.warning) {
            showNotification(`Webhook Warning: ${res.warning}`, 'warning');
          }
        } else if (!res.skipped) {
          showNotification(`Webhook Failed: ${res.error}`, 'error');
        }
      });

      // --- TRAIN LOCAL ML MODEL (REINFORCEMENT LEARNING) ---
      if (activeSignal.patternDetected !== "Manual Entry") {
        trainModel(
          closedOutcome,
          activeSignal.type as 'BUY' | 'SELL',
          candles.slice(-50),
          newIndicators,
          sentimentScore,
          pnl,
          riskedAmount,
          activeSignal.confidence
        );
      }

      // Add to UI history
      setTrainingHistory(prev => {
        const newHistory: TrainingData = {
          id: activeSignal.id,
          pattern: activeSignal.patternDetected || 'Manual/Unknown',
          outcome: closedOutcome!,
          confluence: activeSignal.confluenceFactors?.join(', ') || 'Automated Close',
          riskReward: activeSignal.riskRewardRatio || 0,
          note: `Auto-Closed by System at ${lastCandle.time}. PNL: ${pnl.toFixed(2)}`
        };
        storageService.saveTrainingData([newHistory, ...prev].slice(0, 15));

        // Update signal outcome in Supabase
        storageService.updateTradeSignalOutcome(activeSignal.id, closedOutcome!);

        return [newHistory, ...prev].slice(0, 15);
      });

      // Clear active signal from persistent storage once closed
      storageService.saveActiveSignal(null, activeSignal.symbol);
      setActiveSignal(prev => prev ? { ...prev, outcome: closedOutcome! } : null);
    }
  }, [candles, activeSignal, balance, riskPercent, selectedAsset]); // Executing whenever candles update (which is often via WS)

  // TRACK MANUAL OVERRIDE STATE (GUARD)
  const [isManualOverride, setIsManualOverride] = useState(false);
  const lastTradeTimeRef = useRef<number>(0); 
  // const TRADE_COOLDOWN_MS = 60000; // REMOVED as per user request for explicit guard

  // Trigger Local ML Analysis
  const handleAnalyze = useCallback(async () => {
    console.log('[handleAnalyze] 🔍 Analysis triggered', {
      autoMode,
      tradingMode,
      hasIndicators: !!indicators,
      candlesCount: candles.length,
      hasPendingSignal: !!pendingSignal,
      hasActiveSignal: !!activeSignal,
      activeSignalOutcome: activeSignal?.outcome,
      isManualOverride // Log guard state
    });

    // CHECK MANUAL OVERRIDE GUARD
    if (isManualOverride && autoMode) {
        console.log('[handleAnalyze] ⏸️ PAUSED by Manual Override. Waiting for user resume.');
        // Show subtle toast occasionally? Or rely on UI banner.
        return; 
    }

    if (!indicators || candles.length === 0) {
      console.log('[handleAnalyze] ⚠️ Early return: No indicators or candles', {
        hasIndicators: !!indicators,
        candlesCount: candles.length
      });
      return;
    }

    // Don't analyze if we already have an OPEN active position or a PENDING confirmation
    if (pendingSignal) {
      console.log('[handleAnalyze] ⚠️ Early return: Pending signal exists', pendingSignal);
      return;
    }
    if (activeSignal && activeSignal.outcome === 'PENDING') {
      console.log('[handleAnalyze] ⚠️ Early return: Active signal is PENDING', activeSignal);
      return;
    }

    console.log('[handleAnalyze] ✅ Proceeding with analysis...');
    setIsAnalyzing(true);

    // Uses the new Combined (Hybrid) ML service
    const signal = await analyzeMarket(candles, indicators, trainingHistory, marketNews.slice(0, 5), selectedAsset.symbol);
    console.log('[handleAnalyze] 📊 Signal generated:', signal);
    
    // Capture enhanced market context at the moment of analysis
    const context = marketContextService.captureMarketContext(candles, indicators, sentimentScore, marketNews);
    
    if (signal) {
      signal.marketContext = context;
      setLastAnalysis(signal);
      storageService.saveLastAnalysis(selectedAsset.symbol, signal); // Persist scan results
    }

    setIsAnalyzing(false);

    if (signal && signal.type !== 'HOLD') {
      const fullSignal = { ...signal, symbol: selectedAsset.symbol };
      console.log('[handleAnalyze] 🎯 Valid signal detected:', {
        type: signal.type,
        symbol: selectedAsset.symbol,
        confidence: signal.confidence,
        entryPrice: signal.entryPrice,
        willAutoExecute: autoMode || tradingMode === 'paper'
      });

      if (autoMode || tradingMode === 'paper') {
        // --- AUTOMATIC EXECUTION (AUTO-SEND) ---
        console.log('[handleAnalyze] 🚀 AUTO-EXECUTING trade');
        confirmTrade(fullSignal);
      } else {
        // --- MANUAL CONFIRMATION (LIVE MODE) ---
        console.log('[handleAnalyze] ⏸️ Setting pending signal for manual confirmation');
        setPendingSignal(fullSignal);
      }
    } else if (signal && signal.type === 'HOLD') {
      console.log('[handleAnalyze] 🛑 Signal type is HOLD - no trade');
      // Only show message if triggered manually
      if (!autoMode) {
        showNotification("Market conditions unclear. Neural Net advises HOLD.", "info");
      }
    } else {
      console.log('[handleAnalyze] ❌ No signal generated from analyzeMarket');
    }
  }, [candles, indicators, trainingHistory, marketNews, activeSignal, pendingSignal, autoMode, selectedAsset, tradingMode]);

  // Store latest handleAnalyze in ref to prevent interval restart
  const handleAnalyzeRef = useRef(handleAnalyze);
  useEffect(() => {
    handleAnalyzeRef.current = handleAnalyze;
  }, [handleAnalyze]);

  // --- AUTOMATIC TRADING LOOP ---
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    console.log('[Auto-Trading Loop] State check:', {
      autoMode,
      isAnalyzing,
      hasActiveSignal: !!activeSignal,
      activeSignalOutcome: activeSignal?.outcome,
      willStartLoop: autoMode && !isAnalyzing && (!activeSignal || activeSignal.outcome !== 'PENDING')
    });

    if (autoMode && !isAnalyzing) {
      if (!activeSignal || activeSignal.outcome !== 'PENDING') {
        console.log('[Auto-Trading Loop] ✅ Starting auto-trading loop (every 4s)');
        interval = setInterval(() => {
          console.log('[Auto-Trading Loop] ⏰ Triggering handleAnalyze...');
          handleAnalyzeRef.current(); // Use ref to avoid dependency issues
        }, 4000);
      } else {
        console.log('[Auto-Trading Loop] ⏸️ Not starting: Active signal is PENDING');
      }
    } else {
      console.log('[Auto-Trading Loop] ⏸️ Not starting:', {
        reason: !autoMode ? 'Auto mode disabled' : 'Currently analyzing'
      });
    }

    return () => {
      if (interval) {
        console.log('[Auto-Trading Loop] 🛑 Stopping auto-trading loop');
        clearInterval(interval);
      }
    };
  }, [autoMode, isAnalyzing, activeSignal]); // Removed handleAnalyze to prevent restart

  // --- POSITION SYNC WITH BINANCE ---
  // Periodically check if the active trade still exists on Binance
  useEffect(() => {
    let syncInterval: ReturnType<typeof setInterval>;

    const syncActivePosition = async () => {
      if (!activeSignal || activeSignal.outcome !== 'PENDING') {
        return;
      }

      if (!binanceTradingService.isConfigured() || tradingMode === 'paper') {
        return;
      }

      try {
        const tradeSymbol = activeSignal.symbol.replace('/', '').replace(/USD$/, 'USDT');
        console.log('[Position Sync] Checking Binance position for', tradeSymbol);
        
        const positions = await binanceTradingService.getPositions(tradeSymbol);
        const activePos = positions.find(p => parseFloat(p.positionAmt) !== 0);

        if (!activePos) {
          // Position closed on Binance but still PENDING locally
          console.warn('[Position Sync] ⚠️ Position closed on Binance. Determining outcome...');
          
          // Check which OCO order executed (if OCO was used)
          let exitPrice = 0;
          let outcome: 'WIN' | 'LOSS' = 'LOSS';
          let closureReason = 'Auto-closed by Binance';
          
          if (activeSignal.execution?.orderId && typeof activeSignal.execution.orderId === 'object') {
            try {
              // Check remaining open orders
              const openOrders = await binanceTradingService.getOpenOrders(tradeSymbol);
              
              const slOrderExists = openOrders.some(o => o.orderId === activeSignal.execution?.orderId?.stopLoss);
              const tpOrderExists = openOrders.some(o => o.orderId === activeSignal.execution?.orderId?.takeProfit);
              
              console.log('[Position Sync] OCO Status:', { slOrderExists, tpOrderExists });
              
              if (!tpOrderExists && slOrderExists) {
                // TP executed (TP order is gone, SL still exists)
                exitPrice = activeSignal.takeProfit;
                outcome = 'WIN';
                closureReason = 'Take Profit Hit';
                console.log('[Position Sync] ✅ Take Profit executed');
              } else if (!slOrderExists && tpOrderExists) {
                // SL executed (SL order is gone, TP still exists)
                exitPrice = activeSignal.stopLoss;
                outcome = 'LOSS';
                closureReason = 'Stop Loss Hit';
                console.log('[Position Sync] ❌ Stop Loss executed');
              } else {
                // Both gone or manual close - use current price
                exitPrice = candles.length > 0 ? candles[candles.length - 1].close : activeSignal.entryPrice;
                closureReason = 'Manual Close or Unknown';
                console.log('[Position Sync] Manual close detected');
              }
            } catch (orderCheckError) {
              console.warn('[Position Sync] Failed to check orders, using current price:', orderCheckError);
              exitPrice = candles.length > 0 ? candles[candles.length - 1].close : activeSignal.entryPrice;
            }
          } else {
            // No OCO - use current price
            exitPrice = candles.length > 0 ? candles[candles.length - 1].close : activeSignal.entryPrice;
          }
          
          // Calculate final PNL
          const quantity = activeSignal.quantity || 0;
          const finalPnl = activeSignal.type === 'BUY'
            ? (exitPrice - activeSignal.entryPrice) * quantity
            : (activeSignal.entryPrice - exitPrice) * quantity;
          
          // Override outcome based on PnL if not already determined
          if (closureReason === 'Manual Close or Unknown') {
            outcome = finalPnl >= 0 ? 'WIN' : 'LOSS';
          }

          // Update trade history
          const closedTrade: EnhancedExecutedTrade = {
            ...activeSignal,
            exitTime: new Date().toISOString(),
            exitPrice: exitPrice,
            pnl: finalPnl,
            outcome: outcome,
            aiReasoning: activeSignal.reasoning ? `${activeSignal.reasoning} | ${closureReason}` : closureReason
          };

          setTradeHistory(prev => prev.map(t => t.id === activeSignal.id ? closedTrade : t));
          storageService.saveTradingLog(closedTrade);
          
          // Clear active signal
          storageService.saveActiveSignal(null, activeSignal.symbol);
          setActiveSignal(null);
          
          showNotification(`${closureReason}: ${finalPnl >= 0 ? '+' : ''}$${finalPnl.toFixed(2)}`, finalPnl >= 0 ? 'success' : 'warning');
        } else {
          // Position still exists - optionally update quantity if it changed
          const binanceQty = Math.abs(parseFloat(activePos.positionAmt));
          if (activeSignal.quantity && Math.abs(binanceQty - activeSignal.quantity) > 0.001) {
            console.log('[Position Sync] Quantity mismatch. Updating:', { local: activeSignal.quantity, binance: binanceQty });
            const updatedSignal = { ...activeSignal, quantity: binanceQty };
            setActiveSignal(updatedSignal);
            storageService.saveActiveSignal(updatedSignal, activeSignal.symbol);
          }
        }
      } catch (error: any) {
        console.error('[Position Sync] Failed to sync position:', error);
        // Don't show notification for sync errors to avoid spam
      }
    };

    // Run sync every 10 seconds if there's an active signal
    if (activeSignal && activeSignal.outcome === 'PENDING' && tradingMode === 'live') {
      console.log('[Position Sync] Starting position sync loop (every 10s)');
      syncActivePosition(); // Run immediately
      syncInterval = setInterval(syncActivePosition, 10000);
    }

    return () => {
      if (syncInterval) {
        console.log('[Position Sync] Stopping position sync loop');
        clearInterval(syncInterval);
      }
    };
  }, [activeSignal, tradingMode, candles]);

  // --- QUICK TRAIN MODEL (500 Iterations) ---
  const handleQuickTrain = async () => {
    if (isTraining || candles.length < 150) {
      if (candles.length < 150) showNotification("Need at least 150 candles for training", "warning");
      return;
    }

    setIsTraining(true);
    setTrainingProgress(0);
    showNotification("🧠 Mass Training Started! This will take 1-2 minutes...", "info");

    const TARGET_ITERATIONS = 500;
    let trainedCount = 0;

    try {
      // Generate training samples from historical data
      for (let i = 100; i < candles.length - 20 && trainedCount < TARGET_ITERATIONS; i += 2) {
        const subset = candles.slice(i - 100, i);
        const futureSlice = candles.slice(i, i + 20);

        // Calculate indicators
        const prices = subset.map(c => c.close);
        const rsi = calculateRSI(prices);
        const sma200 = calculateSMA(prices, 200);
        const trend = analyzeTrend(subset, sma200);

        const trainingIndicators: TechnicalIndicators = {
          rsi,
          trend,
          fibLevels: { level0: 0, level236: 0, level382: 0, level500: 0, level618: 0, level100: 0 },
          sma50: calculateSMA(prices, 50),
          sma200,
          sma20: calculateSMA(prices, 20),
          ema20: calculateEMA(prices, 20),
          ema12: calculateEMA(prices, 12),
          ema26: calculateEMA(prices, 26),
          nearestSupport: Math.min(...subset.slice(-20).map(c => c.low)),
          nearestResistance: Math.max(...subset.slice(-20).map(c => c.high)),
          volumeSma: calculateSMA(subset.map(c => c.volume), 20),
          macd: { value: 0, signal: 0, histogram: 0 },
          stochastic: { k: 50, d: 50 },
          momentum: 0
        };

        // Determine outcome from future price action
        const currentPrice = subset[subset.length - 1].close;
        const futureHigh = Math.max(...futureSlice.map(c => c.high));
        const futureLow = Math.min(...futureSlice.map(c => c.low));

        const upMove = ((futureHigh - currentPrice) / currentPrice) * 100;
        const downMove = ((currentPrice - futureLow) / currentPrice) * 100;

        let outcome: 'WIN' | 'LOSS';
        let type: 'BUY' | 'SELL';
        let pnl: number;

        if (upMove > downMove && upMove > 1) {
          type = 'BUY';
          outcome = 'WIN';
          pnl = upMove * 100;
        } else if (downMove > upMove && downMove > 1) {
          type = 'SELL';
          outcome = 'WIN';
          pnl = downMove * 100;
        } else if (upMove > 0.5) {
          type = 'BUY';
          outcome = 'LOSS';
          pnl = -downMove * 100;
        } else {
          type = 'SELL';
          outcome = 'LOSS';
          pnl = -upMove * 100;
        }

        // Train the model
        await trainModel(outcome, type, subset, trainingIndicators, 0.5, pnl, 100);

        trainedCount++;
        setTrainingProgress(Math.round((trainedCount / TARGET_ITERATIONS) * 100));

        // Yield to browser every 50 iterations
        if (trainedCount % 50 === 0) {
          await new Promise(r => setTimeout(r, 10));
        }
      }

      setIsTraining(false);
      setTrainingProgress(100);
      showNotification(`✅ Training Complete! Model trained with ${trainedCount} patterns. Confidence should be significantly higher now!`, "success");

      // Refresh model to apply changes
      refreshModel();
    } catch (error) {
      console.error("Training error:", error);
      setIsTraining(false);
      showNotification("❌ Training failed. Check console for details.", "error");
    }
  };


  // Execute Trade after Confirmation
  const confirmTrade = async (signalOverride?: TradeSignal) => {
    const signal = signalOverride || pendingSignal;
    if (!signal) {
      console.log('[confirmTrade] ❌ No signal to confirm');
      return;
    }

    // CRITICAL: Prevent double entry - check if there's already an active trade
    if (activeSignal && activeSignal.outcome === 'PENDING') {
      console.warn('[confirmTrade] ⚠️ BLOCKED: Active trade already exists. Cannot enter new position.');
      showNotification(`⚠️ Cannot enter: Active ${activeSignal.type} position on ${activeSignal.symbol} already exists`, 'warning');
      return;
    }

    console.log('[confirmTrade] 🚀 Executing trade:', signal);
    
    // Update Last Trade Time
    lastTradeTimeRef.current = Date.now();
    
    // --- 1. SMC & ENTRY STRATEGY (CRITICAL: DETERMINE PRICE FIRST) ---
    // User Requirement: "Predict dulu akan entry di angka berapa" (Predict entry price first)
    // Do NOT default to Market Price immediately.
    
    let executionType: 'LIMIT' | 'MARKET' = 'MARKET';
    let entryPrice = 0; // Initialize to 0, must be set by logic below
    
    // A. Check Signal's provided Entry Price (if AI predicted a specific level)
    if (signal.entryPrice && signal.entryPrice > 0) {
        entryPrice = signal.entryPrice;
        executionType = 'LIMIT'; // Assume AI gave a limit level
    }

    // B. SMC Order Block Detection (Overwrites AI price if OB is found for better precision)
    try {
        const smcContext = smcService.getSMCContext(candles);
        const activeOb = smcContext.active_ob;
        
        const isBullishSetup = signal.type === 'BUY' && activeOb?.type === 'BULLISH_OB';
        const isBearishSetup = signal.type === 'SELL' && activeOb?.type === 'BEARISH_OB';
        
        if ((isBullishSetup || isBearishSetup) && activeOb) {
            executionType = 'LIMIT';
            entryPrice = smcService.getLimitEntryPrice(activeOb, 'AGGRESSIVE');
            console.log(`[SMC] 🧠 Smart Entry: Found ${activeOb.type} at ${activeOb.top}-${activeOb.bottom}. Setting LIMIT at ${entryPrice}`);
        } else if (entryPrice === 0) {
            // Only fallback to Market if NO AI price AND NO OB found
            // But user said "jangan lakukan ini" (don't default to market). 
            // However, if we refuse to trade, we miss opportunities.
            // Compromise: Use current close but mark as 'MARKET' explicitly.
            entryPrice = candles[candles.length - 1].close;
            console.log('[SMC] ⚠️ No valid Order Block or AI Entry found. Using Current Market Price.');
        }
    } catch (err) {
        console.error("SMC Detection Error:", err);
        // Fallback to safe current price if analysis fails
        entryPrice = candles[candles.length - 1].close;
    }

    // C. Round Price for Limit Order
    const tradeSymbol = signal.symbol.replace('/', '').replace(/USD$/, 'USDT');
    if (executionType === 'LIMIT') {
        entryPrice = await binanceTradingService.roundPrice(tradeSymbol, entryPrice);
    }
    
    // Validate Entry Price
    if (!entryPrice || entryPrice <= 0) {
        showNotification("❌ Error: Could not determine valid Entry Price. Trade aborted.", "error");
        return; 
    }

    // --- 1.5 CALCULATE DYNAMIC TP (FIBONACCI) ---
    // User requested "Dynamic TP (Fibonacci)" to maximize profit based on market structure.
    // If we have an active OB context, we use it to find the impulse leg and targets.
    let finalTakeProfit = signal.takeProfit;
    let fibTargetLevel = 'Manual/AI';
    
    try {
        const smcContext = smcService.getSMCContext(candles);
        if (smcContext.active_ob) {
             const fibTargets = smcService.getFibonacciTargets(smcContext.active_ob, candles);
             
             // Strategy:
             // If Current TP is arbitrary (AI predicted), we check if Fib Exp 1.618 is a better structural target.
             // We prioritize Fib 1.618 (TP2) for max profit if it aligns with direction.
             
             const isBuy = signal.type === 'BUY';
             // Validate if Fib Target is reachable and rational (above entry for buy, below for sell)
             const isValidBuyTP = isBuy && fibTargets.tp2 > entryPrice;
             const isValidSellTP = !isBuy && fibTargets.tp2 < entryPrice && fibTargets.tp2 > 0;
             
             if (isValidBuyTP || isValidSellTP) {
                 const newTP = await binanceTradingService.roundPrice(tradeSymbol, fibTargets.tp2);
                 console.log(`[SMC] 🎯 Dynamic TP update: ${finalTakeProfit} -> ${newTP} (Fib 1.618)`);
                 finalTakeProfit = newTP;
                 fibTargetLevel = 'Fib 1.618';
                 showNotification(`🎯 TP set to Fibonacci 1.618 Extension: ${newTP}`, 'info');
             }
        }
    } catch (e) {
        console.warn('[SMC] Failed to calc Fib TP:', e);
    }

    // --- 2. CALCULATE QUANTITY (Based on Predicted Price) ---
    let quantityAsset = 0;
    try {
        console.log(`[Position Sizing] Calculating for ${signal.type} @ ${entryPrice} (SL: ${signal.stopLoss})`);
        
        // FUTURESRISKMANAGER returns Quantity in Base Asset (e.g. BTC)
        const rawQuantity = futuresRiskManager.calculatePositionSize(
          balance, entryPrice, signal.stopLoss, leverage
        );
        
        // Pass entryPrice for MinNotional check
        quantityAsset = await binanceTradingService.roundQuantity(tradeSymbol, rawQuantity, entryPrice);
        
        // Fallback: If Quantity is 0 (too small) but we have balance, bump to Min Notional (~$6)
        if (quantityAsset === 0 && balance >= 6) {
             console.warn(`[Position Sizing] Calculated Qty ${rawQuantity} too small. Bumping to 6 USDT (Min Notional).`);
             quantityAsset = await binanceTradingService.roundQuantity(tradeSymbol, 6.0 / entryPrice, entryPrice);
        }
        
        console.log(`[Position Sizing] Confirmed Quantity: ${quantityAsset} @ ${entryPrice}`);
        
        if (quantityAsset <= 0) {
             // This is likely where the user saw "Failed to calculate..."
             // It means even with min notional catch, it's 0.
             showNotification(`Calculated quantity is too small. Check balance or risk settings.`, "error");
             return;
        }
    } catch (e) {
        console.error("Position sizing error:", e);
        showNotification("Failed to calculate position size. Check logs.", "error");
        return;
    }

    // --- 3. EXECUTE ON BINANCE (Strict Mode, with Testnet Exception) ---
    let binanceOrderId: any = null;
    let executionStatus: 'FILLED' | 'PENDING_LIMIT' = 'FILLED';
    
    const settings = storageService.getSettings();
    const isTestnet = settings?.useTestnet || false;
    
    // Allow execution if Live Mode OR (Paper Mode AND Testnet execution enabled)
    const shouldExecute = binanceTradingService.isConfigured() && (tradingMode === 'live' || (tradingMode === 'paper' && isTestnet));
    
    if (shouldExecute) {
        try {
            console.log(`[Binance] Placing ${isTestnet ? 'TESTNET' : 'LIVE'} ${signal.type} ${executionType} order for ${quantityAsset} ${tradeSymbol}...`);
            
            // Step 0: Set Leverage
            await binanceTradingService.setLeverage(tradeSymbol, leverage);
            
            // Step 1: Place Entry Order (Limit or Market)
            const orderRes = await binanceTradingService.placeOrder({
                symbol: tradeSymbol,
                side: signal.type as 'BUY' | 'SELL',
                type: executionType,
                quantity: quantityAsset,
                price: executionType === 'LIMIT' ? entryPrice : undefined,
                timeInForce: 'GTC'
            });
            
            if (!orderRes || !orderRes.orderId) {
                throw new Error("Order response missing orderId");
            }

            const entryOrderId = orderRes.orderId;
            console.log(`[Binance] ✅ Entry order placed: ${entryOrderId}`);
            
            if (executionType === 'LIMIT') {
                // For Limit Orders, we DO NOT place OCO yet. We wait for fill.
                // We just store the order ID and status.
                binanceOrderId = entryOrderId;
                executionStatus = 'PENDING_LIMIT';
                showNotification(`✅ Limit Order Placed on Binance (${isTestnet ? 'Testnet' : 'Live'}) @ ${entryPrice}`, "success");
            } else {
                // For Market Orders, we place OCO immediately as before
                executionStatus = 'FILLED';
                
                // Step 2: Place OCO Order (Stop Loss + Take Profit)
                try {
                    console.log('[OCO] Placing protective orders...');
                    
                    const rawStopPrice = signal.stopLoss;
                    const rawStopLimitPrice = signal.type === 'BUY' 
                        ? rawStopPrice * 0.995  // 0.5% below stop
                        : rawStopPrice * 1.005; // 0.5% above stop
                    const rawTakeProfitPrice = finalTakeProfit;
                    
                    // CRITICAL: Round prices to tickSize
                    const [stopPrice, stopLimitPrice, takeProfitPrice] = await Promise.all([
                        binanceTradingService.roundPrice(tradeSymbol, rawStopPrice),
                        binanceTradingService.roundPrice(tradeSymbol, rawStopLimitPrice),
                        binanceTradingService.roundPrice(tradeSymbol, rawTakeProfitPrice)
                    ]);
                    
                    const ocoOrder = await binanceTradingService.placeOCOOrder({
                        symbol: tradeSymbol,
                        side: signal.type === 'BUY' ? 'SELL' : 'BUY',
                        quantity: quantityAsset,
                        price: takeProfitPrice,
                        stopPrice: stopPrice,
                        stopLimitPrice: stopLimitPrice
                    });
                    
                    console.log('[OCO] ✅ Protective orders placed:', ocoOrder.orderListId);
                    
                    binanceOrderId = {
                        entry: entryOrderId,
                        oco: ocoOrder.orderListId,
                        stopLoss: ocoOrder.orders?.find((o: any) => o.type.includes('STOP'))?.orderId,
                        takeProfit: ocoOrder.orders?.find((o: any) => o.type === 'LIMIT_MAKER')?.orderId
                    };
                    
                    showNotification(`✅ Trade Opened on Binance (${isTestnet ? 'Testnet' : 'Live'})!`, "success");
                    
                } catch (ocoError: any) {
                    console.error('[OCO] ❌ Failed to place protective orders:', ocoError);
                    // Rollback logic for Market Orders...
                    console.warn('[ROLLBACK] Closing entry position due to OCO failure...');
                    try {
                        await binanceTradingService.closePosition(tradeSymbol, signal.type === 'BUY' ? quantityAsset : -quantityAsset);
                        showNotification('❌ Trade Cancelled: Failed to place Stop Loss/Take Profit. Position closed.', 'error');
                        return;
                    } catch (rbError) {
                         console.error('[ROLLBACK] Failed:', rbError);
                         return;
                    }
                }
            }
            
        } catch (error: any) {
            console.error("Binance Execution Failed:", error);
            
            // ERROR HANDLING & FALLBACK
            if (tradingMode === 'paper') {
                showNotification("⚠️ Testnet Order Failed: " + (error.message || "Unknown error") + ". Falling back to Paper Trade.", "warning");
                binanceOrderId = null;
                executionStatus = 'FILLED'; // Fallback paper trades are always instant filled for now
            } else {
                showNotification("❌ Binance Order Failed: " + error.message, "error");
                return; 
            }
        }
    } else if (tradingMode === 'live' && !binanceTradingService.isConfigured()) {
         showNotification("API Keys not configured for Live execution", "warning");
         return; 
    }

    // --- 4. UPDATE LOCAL STATE ---
    const signalToPersist = { 
    // ... rest of logic checks out for using signalToPersist variable 
      ...signal, 
      outcome: 'PENDING',
      quantity: quantityAsset, // Store strict quantity
      execution: {
        status: 'FILLED',
        side: signal.type,
        leverage: leverage,
        margin: balance * (riskPercent / 100),
        size: quantityAsset,
        tp: finalTakeProfit,
        sl: signal.stopLoss,
        execution_status: executionStatus, // 'PENDING_LIMIT' or 'FILLED'
        // Determine mode: If we have a binanceOrderId, it was a real execution (Testnet or Live). Otherwise, it's Paper.
        mode: binanceOrderId ? (isTestnet ? 'testnet' : 'live') : 'paper',
        orderId: binanceOrderId,
        tags: [...(signal.tags || []), fibTargetLevel] // Add tag for Fib TP
      }
    };
    
    setActiveSignal(signalToPersist);
    storageService.saveActiveSignal(signalToPersist, signal.symbol); 
    setPendingSignal(null);

    // Send push notification
    NotificationService.sendTradeNotification({
      symbol: signal.symbol,
      type: signal.type as 'BUY' | 'SELL',
      price: signal.entryPrice,
      leverage: leverage,
      mode: tradingMode,
      positionSize: balance * leverage * (riskPercent / 100)
    });

    // --- SAVE TRADING LOG (JOURNAL) ---
    if (indicators) {
      const now = new Date().toISOString();
      const log: TradingLog = {
        id: generateUUID(),
        tradeId: signal.id,
        timestamp: Date.now(),
        entryTime: now, // Add timestamp for trade history display
        exitTime: now,  // Will be updated when trade closes
        symbol: signal.symbol,
        type: signal.type as 'BUY' | 'SELL',
        entryPrice: signal.entryPrice,
        exitPrice: 0, // Will be updated when trade closes
        stopLoss: signal.stopLoss,
        takeProfit: finalTakeProfit,
        quantity: quantityAsset, // Store confirmed quantity
        pnl: 0, // Will be calculated when trade closes
        outcome: 'PENDING',
        source: signal.patternDetected === "Manual Entry" ? "MANUAL" : "AI",
        items: {
          snapshot: {
            price: signal.entryPrice,
            rsi: indicators.rsi,
            trend: indicators.trend,
            newsSentiment: sentimentScore,
            condition: indicators.rsi > 70 ? 'Overbought' : indicators.rsi < 30 ? 'Oversold' : 'Neutral'
          },
          chartHistory: candles.slice(-60),
          aiReasoning: signal.reasoning,
          aiConfidence: signal.confidence,
          aiPrediction: "AI generated signal based on current market conditions."
        },
        notes: "",
        tags: ["AI", "Auto"]
      };
      storageService.saveTradingLog(log);
    }

    // Send webhook notification
    sendWebhookNotification('SIGNAL_ENTRY', signal).then(res => {
      if (res.success) {
        if (res.warning) {
          showNotification(`Order Placed (Blind Mode). Check n8n.`, "warning");
        } else {
          showNotification("Trade Executed & Webhook Sent", "success");
        }
      } else if (res.skipped) {
        showNotification("Trade Executed (Webhooks Disabled)", "info");
      } else {
        showNotification(`Trade Executed but Webhook FAILED: ${res.error}`, "error");
      }
    });

    showNotification(`Trade executed: ${signal.type} ${signal.symbol} at $${signal.entryPrice.toFixed(2)}`, 'success');
    console.log('[confirmTrade] ✅ Trade execution complete');
    
    // Optional: Trigger a custom event to notify other components (like OpenOrders) to refresh?
    // For now, OpenOrders polls every 5s.
  };

  // Manual Close Trade Handler
  const handleManualCloseTrade = useCallback(async (tradeId: string) => {
    console.log(`[handleManualCloseTrade] Closing trade ${tradeId}`);
    
    // Find the trade in history
    const trade = tradeHistory.find(t => t.id === tradeId);
    if (!trade || trade.outcome !== 'PENDING') {
      showNotification('Trade not found or already closed', 'error');
      return;
    }
    
    // Get current market price
    if (candles.length === 0) {
      showNotification('Cannot close trade: No market data available', 'error');
      return;
    }
    
    const currentPrice = candles[candles.length - 1].close;
    
    // LIVE TRADING EXECUTION
    if (tradingMode === 'live') {
        try {
            // Sanitize symbol (Fix potential BTCUSDTT double-suffix issue)
            let cleanSymbol = trade.symbol.replace('/', '').replace(/USD$/, 'USDT');
            if (cleanSymbol.endsWith('USDTT')) {
                cleanSymbol = cleanSymbol.replace('USDTT', 'USDT');
                console.log(`[Manual Close] Fixed corrupted symbol: ${trade.symbol} -> ${cleanSymbol}`);
            }

            // CHECK IF POSITION EXISTS ON BINANCE BEFORE CLOSING
            // This prevents "Closing" a phantom trade from opening a NEW opposite position
            const positions = await binanceTradingService.getPositions(cleanSymbol);
            const activePos = positions.find(p => parseFloat(p.positionAmt) !== 0);
            
            // If no active position found on Binance, DO NOT execute a close order
            if (!activePos) {
                 console.warn(`[Manual Close] No active position found on Binance for ${cleanSymbol}. Closing local record only.`);
                 showNotification(`⚠️ No open position on Binance. Closing local record only.`, 'warning');
            } else {
                 // Determine side to close (Opposite of entry)
                 const side = trade.type === 'BUY' ? 'SELL' : 'BUY';
                 
                 // Execute Market Close Order using strict closePosition
                 console.log(`[Manual Close] Executing LIVE ${side} order for ${cleanSymbol}`);
                 await binanceTradingService.closePosition(cleanSymbol, activePos.positionAmt);
                 
                 showNotification(`✅ Position closed on Binance`, 'success');
            }
        } catch (error: any) {
            console.error('[Manual Close] Failed to close position on Binance:', error);
            showNotification(`Failed to close on Binance: ${error.message}`, 'error');
            // We proceed to update local state so user isn't stuck with a "Pending" trade that won't close
        }
    }
    
    // Calculate PNL
    const dist = Math.abs(trade.entryPrice - trade.stopLoss);
    const safeDist = dist === 0 ? 1 : dist;
    const quantity = trade.quantity || ((balance * (riskPercent / 100)) / safeDist);
    const pnl = trade.type === 'BUY'
      ? (currentPrice - trade.entryPrice) * quantity
      : (trade.entryPrice - currentPrice) * quantity;
    
    updateBalance(b => b + pnl);
    
    // Update trade in history
    const closedTrade: EnhancedExecutedTrade = {
      ...trade,
      exitTime: new Date().toISOString(),
      exitPrice: currentPrice,
      quantity: quantity,
      pnl: pnl,
      outcome: 'MANUAL_CLOSE',
      aiReasoning: trade.aiReasoning ? `${trade.aiReasoning} | Manually closed by user` : 'Manually closed by user'
    };
    
    // Update history
    setTradeHistory(prev => prev.map(t => t.id === tradeId ? closedTrade : t));
    storageService.saveTradingLog(closedTrade);
    
    // If this is the active signal, clear it
    if (activeSignal?.id === tradeId) {
      storageService.saveActiveSignal(null, activeSignal.symbol);
      setActiveSignal(null);
    }
    
    const pnlText = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
    showNotification(`Trade closed manually at $${currentPrice.toFixed(2)}. PNL: ${pnlText}`, pnl >= 0 ? 'success' : 'warning');
    
    // Update Last Trade Time
    lastTradeTimeRef.current = Date.now();
    
    // ACTIVATE MANUAL OVERRIDE GUARD
    if (tradingMode === 'live' || autoMode) {
        setIsManualOverride(true);
        showNotification("ℹ️ AI Auto-Trading PAUSED. Click 'Resume' to continue.", "info");
    }
  }, [tradeHistory, candles, balance, riskPercent, activeSignal, updateBalance, tradingMode]);

  const rejectTrade = () => {
    setPendingSignal(null);
    showNotification('Trade rejected', 'info');
  };

  // Handle Manual Trade
  const handleManualTrade = async (
      type: 'BUY' | 'SELL', 
      entryPrice: number, 
      stopLoss: number, 
      takeProfit: number,
      orderType: 'MARKET' | 'LIMIT' | 'STOP' = 'MARKET',
      amountUsd: number = 0,
      stopPrice: number = 0
  ) => {
    // Explicitly validate type for Binance
    const validatedType = type === 'BUY' ? 'BUY' : type === 'SELL' ? 'SELL' : null;
    if (!validatedType) {
        showNotification("Invalid side: " + type, "error");
        return;
    }

    const newSignal: TradeSignal = {
      id: generateUUID(),
      symbol: selectedAsset.symbol,
      type: validatedType,
      entryPrice: entryPrice,
      stopLoss: stopLoss,
      takeProfit: takeProfit,
      reasoning: `Manual ${orderType} trade`,
      confidence: 100, // Manual is always 100% confidence
      timestamp: Date.now(),
      outcome: 'PENDING'
    };

    // Calculate Quantity from USDT Amount (User Input)
    // Fallback to Risk Manager calculation if Amount is 0
    // Calculate Raw Quantity (Units)
    let rawQuantity = 0;
    
    if (amountUsd > 0) {
        // User entered USDT Amount -> Convert to Units
        rawQuantity = amountUsd / entryPrice;
    } else {
        // Auto: Risk Manager returns Units (Base Asset)
        rawQuantity = futuresRiskManager.calculatePositionSize(
            balance, entryPrice, stopLoss, leverage
        );
    }
    
    console.log(`[Manual Trade] ${orderType} ${type} Raw Qty: ${rawQuantity}`);

    // Dynamically round quantity based on Binance LOT_SIZE stepSize
    const tradeSymbol = selectedAsset.symbol.replace('/', '').replace(/USD$/, 'USDT');
    
    // Pass entryPrice to enforce MinNotional (e.g. $5 minimum)
    let quantityAsset = await binanceTradingService.roundQuantity(tradeSymbol, rawQuantity, entryPrice);
    
    // Fallback: If Quantity is 0 (too small) but we have balance, bump to Min Notional (~$6)
    if (quantityAsset === 0 && balance >= 6) {
         console.warn(`[Manual Trade] Qty too small. Bumping to 6 USDT.`);
         if (amountUsd > 0 && amountUsd < 5) {
             showNotification(`Requested ${amountUsd} USDT is below min order. Adjusting to 6 USDT.`, "warning");
         }
         quantityAsset = await binanceTradingService.roundQuantity(tradeSymbol, 6.0 / entryPrice, entryPrice);
    }
    
    console.log(`[Manual Trade] Final Rounded Qty: ${quantityAsset}`);
    
    if (quantityAsset <= 0) {
         showNotification(`Amount too small for valid quantity (Min ~5 USDT).`, "error");
         return;
    }
    
    // Execute on Binance (if configured/Testnet)
    let binanceOrderId = null;
    if (binanceTradingService.isConfigured()) {
        try {
            const tradeSymbol = newSignal.symbol.replace('/', '').replace(/USD$/, 'USDT');
            
            // Map parameters for Binance Order
            // FUTURE SPECIFIC: STOP_MARKET is used for stop loss triggers without limit price
            // STOP typically maps to STOP_MARKET for simplicity in this UI
            const finalOrderType = orderType === 'STOP' ? 'STOP_MARKET' : orderType;
            
            const orderParams: any = {
                symbol: tradeSymbol,
                side: newSignal.type as 'BUY' | 'SELL',
                type: finalOrderType,
                quantity: quantityAsset
            };

            // Add conditional params
            if (orderType === 'LIMIT') {
                orderParams.price = entryPrice;
                orderParams.timeInForce = 'GTC';
            } else if (orderType === 'STOP') {
                orderParams.stopPrice = stopPrice || entryPrice; // The trigger price
                // For STOP_MARKET, 'price' is NOT sent.
            }

            console.log(`[Binance] Placing ${finalOrderType} order:`, orderParams);
            
            const orderRes = await binanceTradingService.placeOrder(orderParams);
            binanceOrderId = orderRes.orderId;
            showNotification(`Order Executed! ID: ${binanceOrderId}`, "success");
            
            // If NOT Market, we don't set Active Signal locally (it's pending in OrderBook)
            if (orderType !== 'MARKET') {
                 showNotification("Order placed in Waiting List (Open Orders).", "info");
                 setShowManualModal(false);
                 return; 
            }

        } catch (error: any) {
            console.error("Binance Execution Failed:", error);
            showNotification("Binance Order Failed: " + error.message, "error");
            return;
        }
    }

    
    // Validate liquidation risk (For Display Only since order is sent)
    // const side: 'LONG' | 'SHORT' = validatedType === 'BUY' ? 'LONG' : 'SHORT';
    // const liqInfo = liquidationCalculator.validateTrade(entryPrice, stopLoss, leverage, side);
    
    /* 
       MARKET ORDER LOGIC (Only runs if type is MARKET)
       We assume 'filled' instantly for UI purposes if API succeeded.
    */

    // Fetch REAL liquidation info from Binance after order execution
    const validSide: 'LONG' | 'SHORT' = newSignal.type === 'BUY' ? 'LONG' : 'SHORT';
    let liqInfo;
    
    try {
        // Fetch actual position from Binance to get real liquidation price
        const tradeSymbol = newSignal.symbol.replace('/', '').replace(/USD$/, 'USDT');
        const positions = await binanceTradingService.getPositions(tradeSymbol);
        const activePosition = positions.find(p => parseFloat(p.positionAmt) !== 0);
        
        if (activePosition && activePosition.liquidationPrice) {
            const realLiqPrice = parseFloat(activePosition.liquidationPrice);
            const slDistance = Math.abs(entryPrice - stopLoss);
            const liqDistance = Math.abs(entryPrice - realLiqPrice);
            const safetyMargin = entryPrice > 0 ? ((liqDistance - slDistance) / entryPrice) * 100 : 0;
            
            let riskLevel: 'SAFE' | 'MODERATE' | 'HIGH' | 'EXTREME';
            if (safetyMargin > 5) riskLevel = 'SAFE';
            else if (safetyMargin > 2) riskLevel = 'MODERATE';
            else if (safetyMargin > 0) riskLevel = 'HIGH';
            else riskLevel = 'EXTREME';
            
            liqInfo = {
                liquidationPrice: realLiqPrice,
                marginRatio: (1 / leverage) * 100,
                safetyMargin: Number(safetyMargin.toFixed(2)),
                riskLevel: riskLevel
            };
            console.log('[Trade] ✅ Using REAL liquidation from Binance:', realLiqPrice);
        } else {
            // Fallback to calculation if position not found yet
            liqInfo = liquidationCalculator.validateTrade(entryPrice, stopLoss, leverage, validSide);
            console.log('[Trade] ⚠️ Position not found, using calculated liquidation');
        }
    } catch (e) {
        console.warn('[Trade] Failed to fetch real liquidation, using calculation:', e);
        liqInfo = liquidationCalculator.validateTrade(entryPrice, stopLoss, leverage, validSide);
    }

    const signalWithQty = { 
      ...newSignal, 
      quantity: quantityAsset,
      execution: {
        status: 'FILLED',
        side: newSignal.type,
        leverage: leverage,
        margin: balance * (riskPercent / 100),
        size: quantityAsset,
        tp: takeProfit,
        sl: stopLoss,
        execution_status: 'FILLED',
        mode: tradingMode,
        orderId: binanceOrderId
      },
      meta: {
        liquidation_info: liqInfo,
        recommended_leverage: leverage
      }
    };
    setActiveSignal(signalWithQty);
    storageService.saveActiveSignal(signalWithQty, signalWithQty.symbol); // Persist state
    setShowManualModal(false);

    // Send push notification for manual trade
    const positionSizeUsd = balance * leverage * (riskPercent / 100);
    NotificationService.sendTradeNotification({
      symbol: newSignal.symbol,
      type: newSignal.type as 'BUY' | 'SELL',
      price: newSignal.entryPrice,
      leverage: leverage,
      mode: tradingMode,
      positionSize: positionSizeUsd
    });

    // Save to Supabase
    storageService.saveTradeSignal(signalWithQty);

    // --- SAVE TRADING LOG (JOURNAL) ---
    if (indicators) {
      const log: TradingLog = {
        id: generateUUID(),
        tradeId: newSignal.id,
        timestamp: Date.now(),
        symbol: newSignal.symbol,
        type: newSignal.type as 'BUY' | 'SELL',
        items: {
          snapshot: {
            price: newSignal.entryPrice,
            rsi: indicators.rsi,
            trend: indicators.trend,
            newsSentiment: sentimentScore,
            condition: indicators.rsi > 70 ? 'Overbought' : indicators.rsi < 30 ? 'Oversold' : 'Neutral'
          },
          chartHistory: candles.slice(-60),
          aiReasoning: newSignal.reasoning,
          aiConfidence: newSignal.confidence,
          aiPrediction: "Manual entry."
        },
        notes: "Manual trade executed by user.",
        tags: ["Manual"]
      };
      storageService.saveTradingLog(log);
    }

    // Trigger Webhook
    sendWebhookNotification('SIGNAL_ENTRY', newSignal).then(res => {
      if (res.success) {
        if (res.warning) {
          showNotification(`Manual Order Placed (Blind Mode)`, 'warning');
        } else {
          showNotification(`Manual Order Placed (Webhook Sent)`, 'success');
        }
      } else if (!res.skipped) {
        showNotification(`Webhook Error: ${res.error}`, 'error');
      } else {
        showNotification("Manual Order Placed Successfully", "success");
      }
    });
  };

  // Handle Manual Feedback (Correction) - Open Editor
  const openFeedbackEditor = (item: TrainingData) => {
    setEditingFeedback(item);
  };

  const saveFeedback = (updated: TrainingData) => {
    setTrainingHistory(prev => {
      const newData = prev.map(item => item.id === updated.id ? updated : item);
      storageService.saveTrainingData(newData);
      return newData;
    });
    showNotification("Training data updated", "success");
  };

  const handleFeedback = (outcome: 'WIN' | 'LOSS') => {
    if (!activeSignal) return;

    // Calculate estimated PNL for manual close
    const dist = Math.abs(activeSignal.entryPrice - activeSignal.stopLoss);
    const quantity = ((balance * (riskPercent / 100)) / dist);
    const pnl = outcome === 'WIN'
      ? (balance * 0.02) // Est 2% gain
      : -(balance * 0.01); // Est 1% loss

    const riskedAmount = dist * quantity;

    updateBalance(b => b + pnl);

    // Trigger Webhook
    sendWebhookNotification('MANUAL_CLOSE', activeSignal, activeSignal.entryPrice).then(res => {
      if (res.warning) {
        showNotification(`Trade Closed (Blind Mode)`, 'warning');
      }
    });

    // --- MANUALLY TRIGGER TRAINING ---
    if (activeSignal.patternDetected !== "Manual Entry" && indicators) {
      trainModel(outcome, activeSignal.type as 'BUY' | 'SELL', candles.slice(-50), indicators, sentimentScore, pnl, riskedAmount, activeSignal.confidence);
      showNotification("Neural Network weights updated based on feedback.", "success");
    }

    const newTrainingItem: TrainingData = {
      id: activeSignal.id,
      pattern: activeSignal.patternDetected || 'Unknown',
      outcome: outcome,
      confluence: activeSignal.confluenceFactors?.join(', ') || 'Unknown',
      riskReward: activeSignal.riskRewardRatio || 0,
      note: outcome === 'WIN' ? 'Good entry, verified pattern.' : 'False signal, volatility stopped out.'
    };

    setTrainingHistory(prev => {
      const newData = [newTrainingItem, ...prev].slice(0, 15);
      storageService.saveTrainingData(newData);
      return newData;
    });

    const completedTrade: ExecutedTrade = {
      id: activeSignal.id,
      symbol: activeSignal.symbol,
      entryTime: new Date(activeSignal.timestamp).toISOString(),
      exitTime: new Date().toISOString(),
      type: activeSignal.type as 'BUY' | 'SELL',
      entryPrice: activeSignal.entryPrice,
      exitPrice: activeSignal.entryPrice, // Manual close, approx
      stopLoss: activeSignal.stopLoss,
      takeProfit: activeSignal.takeProfit,
      quantity: quantity,
      pnl: pnl,
      outcome: outcome,
      source: activeSignal.patternDetected === "Manual Entry" ? "MANUAL" : "AI"
    };
    setTradeHistory(prev => [completedTrade, ...prev]);

    // In Auto Mode, this allows the loop to pick up a new trade
    setActiveSignal(prev => prev ? { ...prev, outcome } : null);
  };

  const riskAmount = balance * (riskPercent / 100);

  const handleSyncHistory = useCallback(async () => {
    if (!binanceTradingService.isConfigured()) {
      // showNotification("Binance API credentials missing.", "error"); // Too noisy for auto-sync
      return;
    }

    setIsSyncingHistory(true);
    try {
      console.log(`[App] Syncing history for ${selectedAsset.symbol}...`);
      const binanceTrades = await binanceTradingService.getTradeHistory(selectedAsset.symbol);
      
      if (!Array.isArray(binanceTrades) || binanceTrades.length === 0) {
        console.log("[App] No trade history found for symbol.");
        setIsSyncingHistory(false);
        return;
      }

      // showNotification(`Found ${binanceTrades.length} trades.`, "info"); // Too noisy

      // Convert to EnhancedExecutedTrade
      const mappedTrades: EnhancedExecutedTrade[] = binanceTrades.map(t => ({
        id: String(t.id),
        symbol: t.symbol,
        entryTime: new Date(t.time).toISOString(),
        exitTime: new Date(t.time).toISOString(), // Approximate
        type: t.side ? t.side : (t.buyer ? 'BUY' : 'SELL'), // Handle both side and buyer fields
        entryPrice: parseFloat(t.price),
        exitPrice: parseFloat(t.price), // It's a single execution
        stopLoss: 0,
        takeProfit: 0,
        quantity: parseFloat(t.qty),
        pnl: parseFloat(t.realizedPnl) || 0, // Binance specific field if available, else 0
        outcome: parseFloat(t.realizedPnl) > 0 ? 'WIN' : parseFloat(t.realizedPnl) < 0 ? 'LOSS' : 'OPEN',
        source: 'BINANCE_IMPORT',
        marketContext: {
            indicators: { rsi: 50, macd: { value: 0, signal: 0, histogram: 0 }, stochastic: { k: 50, d: 50 }, sma20: 0, sma50: 0, sma200: 0, ema12: 0, ema26: 0, momentum: 0 },
            volatility: { atr: 0, bollingerBandWidth: 0, historicalVolatility: 0 },
            sentiment: { score: 0, newsCount: 0, dominantSentiment: 'NEUTRAL' },
            structure: { trend: 'SIDEWAYS', nearestSupport: 0, nearestResistance: 0 },
            volume: { current: 0, average: 0, volumeRatio: 1 },
            priceAction: { currentPrice: 0, priceChange24h: 0, highLow24h: { high: 0, low: 0 } }
        }
      }));

      // Enrich with context (Market Reconstruction) - SKIP for bulk import to save API calls, just basic map
      // ... logic skipped for performance, assuming manual 'Sync' usually for just viewing ...
      // actually let's just dedupe and save

      // Deduplicate and merge by ID
      // NOTE: We do NOT use existing tradeHistory state in dependency array to avoid infinite loops if not careful.
      // Instead we use functional update or ref if needed. 
      // But since we want to Merge, we can read current state inside setState if possible?
      // Or just trust storageService as source of truth?
      
      setTradeHistory(prev => {
          const existingMap = new Map<string, EnhancedExecutedTrade>(prev.map(t => [t.id, t]));
          mappedTrades.forEach(t => existingMap.set(t.id, t));
          
          const uniqueSorted = (Array.from(existingMap.values()) as EnhancedExecutedTrade[]).sort((a, b) => 
            new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime()
          );
          
          return uniqueSorted;
      });

      // Save new trades to storage
      // Only iterate mappedTrades
      mappedTrades.forEach(t => storageService.saveTradingLog(t));
      
      console.log(`[App] Successfully synced details for ${mappedTrades.length} trades.`);
    } catch (error: any) {
      console.error("Sync error:", error);
    } finally {
      setIsSyncingHistory(false);
    }
  }, [selectedAsset]); // Re-create when asset changes

  // Handle Sync Orders
  const handleSyncOrders = useCallback(async () => {
    if (!binanceTradingService.isConfigured()) return;

    setIsSyncingOrders(true);
    try {
      console.log(`[App] Syncing orders for ${selectedAsset.symbol}...`);
      const orders = await binanceTradingService.getAllOrders(selectedAsset.symbol);
      
      if (Array.isArray(orders)) {
          setOrderHistory(orders);
          console.log(`[App] Loaded ${orders.length} orders.`);
      }
    } catch (error: any) {
      console.error("Sync orders error:", error);
    } finally {
      setIsSyncingOrders(false);
    }
  }, [selectedAsset]);

  // Unified Refresh Handler
  const handleRefreshHistory = () => {
    if (activeHistoryTab === 'trades') handleSyncHistory();
    else handleSyncOrders();
  };

  // Auto-sync history when asset changes or Tab changes
  useEffect(() => {
    if (binanceTradingService.isConfigured()) {
        const timer = setTimeout(() => {
            if (activeHistoryTab === 'trades') handleSyncHistory();
            else handleSyncOrders();
        }, 1000);
        return () => clearTimeout(timer);
    }
  }, [handleSyncHistory, handleSyncOrders, activeHistoryTab]); // Depend on Tab and Sync functions, which depend on Asset


  return (
    <div className="h-screen flex flex-col md:flex-row text-slate-200 overflow-hidden relative">

      {/* NOTIFICATION BANNER */}
      {notification && (
        <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300 ${notification.type === 'success' ? 'bg-emerald-500 text-white' :
          notification.type === 'error' ? 'bg-rose-500 text-white' :
            notification.type === 'warning' ? 'bg-amber-500 text-black' :
              'bg-blue-500 text-white'
          }`}>
          {notification.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
          {notification.type === 'error' && <AlertCircle className="w-5 h-5" />}
          {notification.type === 'warning' && <AlertTriangle className="w-5 h-5" />}
          {notification.type === 'info' && <CheckCircle2 className="w-5 h-5" />}
          {notification.message}
        </div>
      )}

      {/* MODALS */}
      {pendingSignal && (
        <TradeConfirmationModal
          signal={pendingSignal}
          onConfirm={confirmTrade}
          onReject={rejectTrade}
          riskAmount={riskAmount}
        />
      )}

      {showManualModal && candles.length > 0 && (
        <ManualTradeModal
          currentPrice={candles[candles.length - 1].close}
          onClose={() => setShowManualModal(false)}
          onSubmit={handleManualTrade}
        />
      )}

      {showStrategyGuide && (
        <StrategyGuideModal onClose={() => setShowStrategyGuide(false)} />
      )}

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      {editingFeedback && (
        <FeedbackEditorModal
          data={editingFeedback}
          onSave={saveFeedback}
          onClose={() => setEditingFeedback(null)}
        />
      )}

      {/* Desktop Sidebar - Hidden on Mobile/Tablet */}
      <nav className="hidden lg:flex lg:w-20 bg-slate-900 border-r border-slate-800 flex-col items-center py-4 gap-6 z-20 shrink-0">
        <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
          <BrainCircuit className="w-6 h-6 text-white" />
        </div>
        <div className="flex flex-col gap-4">
          <button
            onClick={() => setCurrentView('terminal')}
            className={`p-3 rounded-lg transition-colors flex justify-center ${currentView === 'terminal' ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-blue-400'}`}
            title="Live Terminal"
          >
            <LayoutDashboard className="w-5 h-5" />
          </button>
          <button
            onClick={() => setCurrentView('backtest')}
            className={`p-3 rounded-lg transition-colors flex justify-center ${currentView === 'backtest' ? 'bg-slate-800 text-blue-400' : 'text-slate-400 hover:bg-slate-800 hover:text-blue-400'}`}
            title="Backtest Lab"
          >
            <FlaskConical className="w-5 h-5" />
          </button>

          <button
            onClick={() => setCurrentView('analytics')}
            className={`p-3 rounded-lg transition-colors flex justify-center ${currentView === 'analytics' ? 'bg-slate-800 text-purple-400' : 'text-slate-400 hover:bg-slate-800 hover:text-purple-400'}`}
            title="AI Analytics"
          >
            <Activity className="w-5 h-5" />
          </button>

          <button
              onClick={() => setCurrentView('training')}
              className={`p-3 rounded-xl transition-all duration-300 group relative ${currentView === 'training' ? 'bg-pink-500/10 text-pink-400' : 'text-slate-400 hover:bg-white/5'}`}
              title="AI Training"
            >
              <BrainCircuit className="w-5 h-5 group-hover:scale-110 transition-transform" />
              {currentView === 'training' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-pink-500 rounded-r-full shadow-[0_0_10px_rgba(236,72,153,0.5)]"></div>}
            </button>

            <button
              onClick={() => setCurrentView('ai-intelligence')}
              className={`p-3 rounded-xl transition-all duration-300 group relative ${currentView === 'ai-intelligence' ? 'bg-blue-500/10 text-blue-400' : 'text-slate-400 hover:bg-white/5'}`}
              title="AI Intelligence"
            >
              <Brain className="w-5 h-5 group-hover:scale-110 transition-transform" />
              {currentView === 'ai-intelligence' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>}
            </button>
            


          <button
            onClick={() => setCurrentView('leverage')}
            className={`p-3 rounded-lg transition-colors flex justify-center ${currentView === 'leverage' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:bg-slate-800 hover:text-amber-400'}`}
            title="Leverage Trading (10x)"
          >
            <Coins className="w-5 h-5" />
          </button>

          <button
            onClick={() => setCurrentView('journal')}
            className={`p-3 rounded-lg transition-colors flex justify-center ${currentView === 'journal' ? 'bg-slate-800 text-emerald-400' : 'text-slate-400 hover:bg-slate-800 hover:text-emerald-400'}`}
            title="Trading Journal"
          >
            <BookOpen className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowStrategyGuide(true)}
            className="p-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-emerald-400 transition-colors flex justify-center"
            title="Strategy Guide"
          >
            <BookOpen className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-auto pb-4">
          <button
            onClick={() => setShowSettings(true)}
            className="p-3 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-blue-400 transition-colors flex justify-center"
            title="Settings & Automation"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </nav>

      {/* Mobile/Tablet Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-30 safe-area-inset-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          <button
            onClick={() => setCurrentView('terminal')}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[60px] ${currentView === 'terminal' ? 'text-blue-400' : 'text-slate-400'}`}
          >
            <LayoutDashboard className="w-6 h-6" />
            <span className="text-[10px] font-medium">Terminal</span>
          </button>
          <button
            onClick={() => setCurrentView('backtest')}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[60px] ${currentView === 'backtest' ? 'text-blue-400' : 'text-slate-400'}`}
          >
            <FlaskConical className="w-6 h-6" />
            <span className="text-[10px] font-medium">Backtest</span>
          </button>
          <button
            onClick={() => setCurrentView('analytics')}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[60px] ${currentView === 'analytics' ? 'text-purple-400' : 'text-slate-400'}`}
          >
            <Activity className="w-6 h-6" />
            <span className="text-[10px] font-medium">Analytics</span>
          </button>
          <button
            onClick={() => setCurrentView('training')}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[60px] ${currentView === 'training' ? 'text-pink-400' : 'text-slate-400'}`}
          >
            <BrainCircuit className="w-6 h-6" />
            <span className="text-[10px] font-medium">Training</span>
          </button>
          <button
            onClick={() => setCurrentView('ai-intelligence')}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[60px] ${currentView === 'ai-intelligence' ? 'text-blue-400' : 'text-slate-400'}`}
          >
            <Brain className="w-6 h-6" />
            <span className="text-[10px] font-medium">Intelligence</span>
          </button>
          <button
            onClick={() => setCurrentView('leverage')}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[60px] ${currentView === 'leverage' ? 'text-amber-400' : 'text-slate-400'}`}
          >
            <Coins className="w-6 h-6" />
            <span className="text-[10px] font-medium">Leverage</span>
          </button>
          <button
            onClick={() => setCurrentView('journal')}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[60px] ${currentView === 'journal' ? 'text-emerald-400' : 'text-slate-400'}`}
          >
            <BookOpen className="w-6 h-6" />
            <span className="text-[10px] font-medium">Journal</span>
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[60px] text-slate-400"
          >
            <SettingsIcon className="w-6 h-6" />
            <span className="text-[10px] font-medium">Settings</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 p-3 md:p-6 pb-20 md:pb-6 flex flex-col min-h-0 overflow-y-auto">

        {/* Header */}
        <header className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 md:gap-0 mb-4 md:mb-6 shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            <div className="flex-1">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                {currentView === 'terminal' ? 'NeuroTrade' : currentView === 'backtest' ? 'Backtest' : currentView === 'analytics' ? 'Analytics' : currentView === 'training' ? 'AI Training' : currentView === 'leverage' ? 'Leverage' : 'NeuroTrade'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex flex-col sm:flex-row gap-1 sm:gap-2 items-start sm:items-center">
                  <span className="text-[10px] sm:text-xs text-emerald-500 font-mono font-bold flex items-center gap-1">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="hidden sm:inline">HYBRID AI ENGINE</span>
                    <span className="sm:hidden">AI ACTIVE</span>
                  </span>
                  <div className="flex gap-1.5 sm:gap-2">
                    <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded border ${dbConnected ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-rose-500/30 text-rose-400 bg-rose-500/10'}`}>
                      DB: {dbConnected ? 'ON' : 'OFF'}
                    </span>
                    <span className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded border ${aiReady ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' : 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'}`}>
                      AI: {aiReady ? 'OK' : 'NO KEY'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Asset Selector Dropdown */}
            {currentView === 'terminal' && (
              <div className="relative">
                <button
                  onClick={() => setIsAssetMenuOpen(!isAssetMenuOpen)}
                  className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg border border-slate-700 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                      <Coins className="w-4 h-4 text-blue-400" />
                      <span className="font-bold text-white text-sm">{selectedAsset.symbol}</span>
                  </div>
                  
                  {/* LIVE PRICE INDICATOR */}
                  {candles.length > 0 && (
                      <div className="flex items-center gap-2 px-2 py-0.5 bg-slate-900 rounded border border-slate-700">
                          <span className={`text-sm font-mono font-bold ${
                              candles[candles.length - 1].close >= candles[candles.length - 2]?.close 
                                ? 'text-emerald-400' 
                                : 'text-rose-400'
                          }`}>
                              ${candles[candles.length - 1].close.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                      </div>
                  )}

                  <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-white transition-colors" />
                </button>

                {isAssetMenuOpen && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 overflow-hidden max-h-[300px] overflow-y-auto">
                    <div className="p-2 text-[10px] font-bold text-slate-500 uppercase sticky top-0 bg-slate-900">Select Asset</div>
                    <div className="max-h-96 overflow-y-auto">
                  {isAssetLoading ? (
                     <div className="p-4 text-center text-slate-400">Loading Assets...</div>
                  ) : (
                    supportedAssets.map((asset) => (
                      <button
                        key={asset.symbol}
                        onClick={() => {
                          setSelectedAsset(asset);
                          setIsAssetMenuOpen(false);
                        }}
                        className={`w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800 transition-colors ${
                          selectedAsset.symbol === asset.symbol ? 'bg-indigo-500/10 text-indigo-400' : 'text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            selectedAsset.symbol === asset.symbol ? 'bg-indigo-500/20' : 'bg-slate-800'
                          }`}>
                            {asset.type === 'CRYPTO' ? <Coins className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                          </div>
                          <div className="text-left">
                            <div className="font-medium">{asset.symbol}</div>
                            <div className="text-xs text-slate-500">{asset.name}</div>
                          </div>
                        </div>
                        {asset.price > 0 && (
                          <div className="text-right">
                            <div className="font-medium">${asset.price.toLocaleString()}</div>
                          </div>
                        )}
                      </button>
                    ))
                  )}
                </div>
                  </div>
                )}
              </div>
            )}

            {/* Interval Selector */}
            {currentView === 'terminal' && (
              <div className="relative">
                <select
                  value={selectedInterval}
                  onChange={(e) => setSelectedInterval(e.target.value)}
                  className="bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg border border-slate-700 transition-colors text-white text-sm font-bold cursor-pointer appearance-none pr-8"
                  style={{ backgroundImage: 'none' }}
                >
                  <option value="1m">1 Min</option>
                  <option value="5m">5 Min</option>
                  <option value="15m">15 Min</option>
                  <option value="30m">30 Min</option>
                  <option value="1h">1 Hour</option>
                  <option value="4h">4 Hour</option>
                  <option value="1d">1 Day</option>
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
          </div>

          {currentView === 'terminal' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 w-full sm:w-auto">
              {/* Market Sentiment Meter - Hidden on mobile */}
              <div className="hidden lg:flex flex-col items-end mr-4">
                <span className="text-[10px] uppercase text-slate-500 font-bold mb-1">Market Sentiment</span>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${sentimentScore > 0 ? 'bg-emerald-500' : sentimentScore < 0 ? 'bg-rose-500' : 'bg-slate-500'}`}
                      style={{ width: `${Math.abs(sentimentScore) * 100}%`, marginLeft: sentimentScore < 0 ? 0 : 'auto', marginRight: sentimentScore > 0 ? 0 : 'auto' }}
                    ></div>
                  </div>
                  <span className={`text-xs font-bold ${sentimentScore > 0.2 ? 'text-emerald-400' : sentimentScore < -0.2 ? 'text-rose-400' : 'text-slate-400'}`}>
                    {sentimentScore > 0.3 ? 'BULLISH' : sentimentScore < -0.3 ? 'BEARISH' : 'NEUTRAL'}
                  </span>
                </div>
              </div>

              <HeaderControls
                autoMode={autoMode}
                onToggleAuto={toggleAutoMode}
                balance={balance}
                riskPercent={riskPercent}
                setRiskPercent={setRiskPercent}
                onManualTrade={() => setShowManualModal(true)}
                onAnalyze={handleAnalyze}
                isAnalyzing={isAnalyzing}
              />
            </div>
          )}
        </header>

        {/* View Content */}
        {currentView === 'analytics' ? (
          <AnalyticsDashboard trades={tradeHistory} />
        ) : currentView === 'leverage' ? (
          <LeverageDashboard />
        ) : currentView === 'journal' ? (
          <div className="h-full overflow-hidden">
            <TradingJournal />
          </div>
        ) : currentView === 'training' ? (
          <TrainingDashboard />
        ) : currentView === 'ai-intelligence' ? (
          <div className="h-full overflow-y-auto space-y-6">
            <div className="flex flex-col gap-6">
              <div className="bg-[#0a0a0f] border border-white/5 rounded-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-2xl">
                      <Brain className="w-8 h-8 text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-white tracking-tight">AI Intelligence Hub</h2>
                      <p className="text-gray-500 text-sm">Advanced performance analytics and model optimization</p>
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleSyncHistory}
                    disabled={isSyncingHistory}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSyncingHistory ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <UploadCloud className="w-4 h-4" />
                    )}
                    {isSyncingHistory ? 'Processing...' : 'Sync Binance History'}
                  </button>
                </div>
                
                <TradeAnalyticsDashboard 
                  trades={tradeHistory} 
                  currentBalance={balance}
                  assetSymbol={selectedAsset.symbol.split('/')[0]} // Pass "BNB" not "BNB/USDT"
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <BatchTrainingPanel 
                  trades={tradeHistory} 
                  onComplete={() => {
                    console.log("[App] Batch training completed");
                  }} 
                />
                <HyperparameterOptimizer trades={tradeHistory} />
              </div>
            </div>
          </div>
        ) : currentView === 'backtest' ? (
          <div className="flex-1 min-h-0 relative">
            {candles.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-slate-400 gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-sm font-mono animate-pulse">LOADING MARKET DATA...</p>
                <p className="text-xs text-slate-600 max-w-[200px] text-center">
                  Connecting to Binance or using fallback data...
                </p>
              </div>
            ) : (
              <BacktestPanel
                candles={candles}
                symbol={selectedAsset.symbol}
                timeframe={selectedInterval}
                initialBalance={10000}
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Mobile/Tablet Terminal Tabs */}
            <div className="flex lg:hidden bg-slate-900 p-1 rounded-lg mb-2 gap-1 border border-slate-800 shrink-0 mx-1">
              <button
                onClick={() => setTerminalTab('trade')}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${terminalTab === 'trade'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                Chart & Trade
              </button>
              <button
                onClick={() => setTerminalTab('data')}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${terminalTab === 'data'
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                News & Data
              </button>
            </div>

            <div className="flex flex-col lg:grid lg:grid-cols-4 gap-3 md:gap-6 flex-1 min-h-0 lg:overflow-hidden">
              {/* LEFT COLUMN: Chart + Trade History */}
              <div className={`lg:col-span-2 space-y-3 md:space-y-4 flex-col lg:overflow-y-auto ${terminalTab === 'trade' ? 'flex' : 'hidden lg:flex'} pr-1`}>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 md:p-4 shadow-xl flex flex-col min-h-[250px] sm:min-h-[300px] shrink-0">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3 md:mb-4 shrink-0">
                    <div className="flex gap-2 items-center">
                      <span className="font-bold text-base sm:text-lg">{selectedAsset.symbol}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${indicators?.trend === 'UP' ? 'bg-emerald-500/20 text-emerald-400' : indicators?.trend === 'DOWN' ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-700 text-slate-300'}`}>
                        {indicators?.trend}
                      </span>
                    </div>
                    <div className="flex gap-2 sm:gap-4 text-[10px] sm:text-xs font-mono text-slate-400">
                      <span>RSI: <span className={indicators && indicators.rsi > 70 ? 'text-rose-400' : indicators && indicators.rsi < 30 ? 'text-emerald-400' : 'text-slate-200'}>{(indicators?.rsi || 0).toFixed(1)}</span></span>
                      <span>SMA 200: {(indicators?.sma200 || 0).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex-1 relative">
                    <ModernCandleChart
                      data={candles.slice(-150)}
                      pendingSignal={pendingSignal}
                      activeTrade={activeSignal?.outcome === 'PENDING' ? activeSignal : null}
                      fibLevels={indicators?.fibLevels}
                    />
                  </div>
                  
                  {/* Futures Dashboard (Embedded - Collapsible) */}
                  {selectedAsset.type === 'CRYPTO' && (
                      <div className="border-t border-slate-800 bg-slate-900/50 transition-all duration-300">
                        <button 
                          onClick={() => setIsFuturesExpanded(!isFuturesExpanded)}
                          className="w-full flex items-center justify-between p-2 hover:bg-slate-800/50 transition-colors"
                        >
                           <div className="flex items-center gap-2">
                              <Activity className="w-4 h-4 text-purple-400" />
                              <span className="text-xs font-bold text-slate-400">FUTURES INTELLIGENCE</span>
                           </div>
                           <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-300 ${isFuturesExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {isFuturesExpanded && (
                          <div className="p-2 pt-0 animate-in slide-in-from-top-2 duration-300">
                            <FuturesDashboard 
                                symbol={selectedAsset.symbol}
                                currentPrice={candles.length > 0 ? candles[candles.length - 1].close : 0}
                                fundingData={{
                                    current: activeSignal?.meta?.futures_data?.fundingRate || 0.001,
                                    history: [] 
                                }}
                                marketSentiment={{
                                    open_interest: { open_interest: activeSignal?.meta?.futures_data?.openInterest || 5000000 },
                                    long_short_ratio: { ratio: activeSignal?.meta?.futures_data?.longShortRatio || 1.1 },
                                    taker_ratio: { ratio: 1.05 } 
                                }}
                            />
                          </div>
                        )}
                      </div>
                  )}
                </div>

                {/* Active Orders Panel */}
                <div className="mb-4">
                  <OpenOrders onTradeClosed={handleExternalTradeClosed} />
                </div>

                {/* Trade & Order History Panel */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex flex-col h-64 sm:h-96 overflow-hidden shrink-0">
                  <div className="px-3 md:px-4 py-2 border-b border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => setActiveHistoryTab('trades')}
                            className={`flex items-center gap-2 text-xs font-bold transition-colors pb-2 -mb-2 border-b-2 ${activeHistoryTab === 'trades' ? 'text-blue-400 border-blue-400' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
                        >
                            <List className="w-4 h-4" /> TRADES
                        </button>
                        <button 
                            onClick={() => setActiveHistoryTab('orders')}
                            className={`flex items-center gap-2 text-xs font-bold transition-colors pb-2 -mb-2 border-b-2 ${activeHistoryTab === 'orders' ? 'text-amber-400 border-amber-400' : 'text-slate-400 border-transparent hover:text-slate-200'}`}
                        >
                            <Clock className="w-4 h-4" /> ORDERS
                        </button>
                    </div>
                    <button 
                        onClick={handleRefreshHistory}
                        disabled={isSyncingHistory || isSyncingOrders}
                        className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-blue-400 transition-colors"
                        title="Sync History"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncingHistory || isSyncingOrders ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {activeHistoryTab === 'trades' ? (
                        <TradeList trades={tradeHistory.filter(t => t.source === 'BINANCE_IMPORT')} onCloseTrade={handleManualCloseTrade} />
                    ) : (
                        <OrderList orders={orderHistory} isLoading={isSyncingOrders} />
                    )}
                  </div>
                </div>
              </div>

              {/* MIDDLE COLUMN: Signal & Alerts */}
              <div className={`lg:col-span-1 space-y-3 md:space-y-4 flex-col lg:overflow-y-auto ${terminalTab === 'trade' ? 'flex' : 'hidden lg:flex'}`}>
                {/* Active Signal Card */}
                <div className={`bg-slate-900 border ${isManualOverride ? 'border-amber-500/50' : 'border-slate-800'} rounded-xl p-4 shadow-lg relative overflow-hidden group shrink-0`}>
                  <div className={`absolute top-0 right-0 w-32 h-32 ${isManualOverride ? 'bg-amber-500/5 group-hover:bg-amber-500/10' : 'bg-blue-500/5 group-hover:bg-blue-500/10'} rounded-full blur-3xl transition-all`}></div>

                  <h2 className={`text-slate-400 text-xs font-bold tracking-wider mb-4 flex items-center gap-2 relative z-10 ${isManualOverride ? 'text-amber-400' : ''}`}>
                    {isManualOverride ? (
                        <>
                            <PauseCircle className="w-4 h-4 text-amber-500" /> AI PAUSED (MANUAL CLOSE)
                        </>
                    ) : (
                        <>
                            <Target className="w-4 h-4 text-blue-400" /> ACTIVE TRADE
                        </>
                    )}
                  </h2>

                  {/* MANUAL OVERRIDE WARNING & RESUME BUTTON */}
                  {isManualOverride ? (
                    <div className="relative z-10 flex flex-col items-center gap-4 py-2">
                        <div className="text-center space-y-1">
                            <p className="text-sm font-bold text-slate-200">Auto-Trading is Paused</p>
                            <p className="text-xs text-slate-500">You manually closed a trade. AI is waiting for your command to resume.</p>
                        </div>
                        
                        <button 
                            onClick={() => {
                                setIsManualOverride(false);
                                showNotification("✅ AI Auto-Trading Resumed", "success");
                            }}
                            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                        >
                            <PlayCircle className="w-5 h-5" />
                            RESUME AUTO-TRADING
                        </button>
                    </div>
                  ) : (
                    activeSignal && activeSignal.outcome === 'PENDING' && activeSignal.symbol === selectedAsset.symbol ? (
                    <div className="space-y-4 relative z-10">
                      <div className="flex justify-between items-end">
                        <span className={`text-3xl font-black tracking-tight ${activeSignal.type === 'BUY' ? 'text-emerald-400' : activeSignal.type === 'SELL' ? 'text-rose-400' : 'text-yellow-400'}`}>
                          {activeSignal.type}
                        </span>
                        <div className="flex flex-col items-end">
                          <span className="text-slate-500 text-[10px] font-bold uppercase">Confidence</span>
                          <span className="text-white font-mono text-lg font-bold">
                            {isNaN(activeSignal.confidence) || !isFinite(activeSignal.confidence) ? 'N/A' : `${Math.round(activeSignal.confidence)}%`}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        {activeSignal.confluenceFactors?.map((factor, i) => (
                          <span key={i} className="flex items-center gap-1 text-[10px] bg-slate-800/80 px-2 py-1 rounded-md text-slate-300 border border-slate-700/50">
                            {factor.includes('Trend') && <TrendingUp className="w-3 h-3 text-blue-400" />}
                            {factor.includes('RSI') && <Activity className="w-3 h-3 text-purple-400" />}
                            {factor.includes('Support') && <Layers className="w-3 h-3 text-emerald-400" />}
                            {factor.includes('Volume') && <Zap className="w-3 h-3 text-yellow-400" />}
                            {factor}
                          </span>
                        ))}
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center bg-slate-950/50 rounded-lg p-3 border border-slate-800/50">
                        <div>
                          <span className="text-[10px] text-slate-500 block mb-0.5">Entry</span>
                          <span className="text-xs font-mono text-slate-200">{activeSignal.entryPrice}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block mb-0.5">Stop</span>
                          <span className="text-xs font-mono text-rose-400">{activeSignal.stopLoss}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block mb-0.5">Target</span>
                          <span className="text-xs font-mono text-emerald-400">{activeSignal.takeProfit}</span>
                        </div>
                      </div>

                      {/* Futures Info: Liquidation & Funding Rate */}
                      {(activeSignal.meta?.liquidation_info || activeSignal.meta?.funding_rate) && (
                        <div className="space-y-2 bg-slate-950/50 rounded-lg p-3 border border-slate-800/50">
                          {/* Liquidation Info */}
                          {activeSignal.meta?.liquidation_info && (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                                <span className="text-[10px] text-slate-500 font-bold uppercase">Liquidation</span>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-mono text-slate-200">
                                  ${activeSignal.meta.liquidation_info.liquidationPrice != null ? activeSignal.meta.liquidation_info.liquidationPrice.toLocaleString() : '-'}
                                </div>
                                <div className={`text-[9px] font-bold ${
                                  activeSignal.meta.liquidation_info.riskLevel === 'SAFE' ? 'text-emerald-400' :
                                  activeSignal.meta.liquidation_info.riskLevel === 'MODERATE' ? 'text-yellow-400' :
                                  activeSignal.meta.liquidation_info.riskLevel === 'HIGH' ? 'text-orange-400' :
                                  'text-rose-400'
                                }`}>
                                  {activeSignal.meta.liquidation_info.riskLevel} ({activeSignal.meta.liquidation_info.safetyMargin.toFixed(1)}% margin)
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Leverage */}
                          {activeSignal.meta?.recommended_leverage && (
                            <div className="flex items-center justify-between pt-1 border-t border-slate-800/50">
                              <div className="flex items-center gap-2">
                                <Zap className="w-3.5 h-3.5 text-purple-400" />
                                <span className="text-[10px] text-slate-500 font-bold uppercase">Leverage</span>
                              </div>
                              <div className="text-xs font-mono text-purple-400 font-bold">
                                {activeSignal.meta.recommended_leverage}x
                              </div>
                            </div>
                          )}

                          {/* Funding Rate */}
                          {activeSignal.meta?.funding_rate && (
                            <div className="flex items-center justify-between pt-1 border-t border-slate-800/50">
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
                                <span className="text-[10px] text-slate-500 font-bold uppercase">Funding Rate</span>
                              </div>
                              <div className="text-right">
                                <div className="text-xs font-mono text-slate-200">
                                  {(activeSignal.meta.funding_rate.current * 100).toFixed(4)}%
                                </div>
                                <div className={`text-[9px] font-bold ${
                                  activeSignal.meta.funding_rate.trend === 'BULLISH' ? 'text-emerald-400' :
                                  activeSignal.meta.funding_rate.trend === 'BEARISH' ? 'text-rose-400' :
                                  'text-slate-400'
                                }`}>
                                  {activeSignal.meta.funding_rate.trend} ({activeSignal.meta.funding_rate.annual})
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Running PnL Display */}
                      {candles.length > 0 && (
                        (() => {
                            const currentPrice = candles[candles.length - 1].close;
                            const entryPrice = activeSignal.entryPrice;
                            const quantity = activeSignal.quantity || (activeSignal.execution?.margin ? activeSignal.execution.margin / entryPrice * (activeSignal.execution.leverage || 1) : 0);
                            
                            let pnl = 0;
                            let pnlPercent = 0;
                            
                            if (activeSignal.type === 'BUY') {
                                pnl = (currentPrice - entryPrice) * quantity;
                                pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100 * (activeSignal.execution?.leverage || 1);
                            } else {
                                pnl = (entryPrice - currentPrice) * quantity;
                                pnlPercent = ((entryPrice - currentPrice) / entryPrice) * 100 * (activeSignal.execution?.leverage || 1);
                            }
                            
                            // If quantity is 0 or undefined (e.g. manual signal without size), just show % based on price move
                            if (!quantity) {
                                // Fallback for % calculation if no leverage info
                                if (activeSignal.type === 'BUY') {
                                    pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
                                } else {
                                    pnlPercent = ((entryPrice - currentPrice) / entryPrice) * 100;
                                }
                            }

                            return (
                                <div className={`flex justify-between items-center px-3 py-2 rounded-lg border ${pnl >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Running PnL</span>
                                    <div className="text-right">
                                        <div className={`text-sm font-mono font-black ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {pnl >= 0 ? '+' : ''}{quantity ? `$${pnl.toFixed(2)}` : (activeSignal.type === 'BUY' ? currentPrice - entryPrice : entryPrice - currentPrice).toFixed(2)}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()
                      )}

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        {binanceTradingService.isConfigured() ? (
                          <button 
                            onClick={async () => {
                                if (!activeSignal) return;
                                try {
                                    // Fix symbol: Remove slash. If it ends in USD but NOT USDT, append T.
                                    let tradeSymbol = activeSignal.symbol.replace('/', '');
                                    if (tradeSymbol.endsWith('USD') && !tradeSymbol.endsWith('USDT')) {
                                        tradeSymbol += 'T';
                                    }
                                    
                                    // STEP 1: Cancel OCO orders if they exist
                                    if (activeSignal.execution?.orderId && typeof activeSignal.execution.orderId === 'object') {
                                        try {
                                            console.log('[Manual Close] Cancelling OCO orders...');
                                            await binanceTradingService.cancelAllOrders(tradeSymbol);
                                            console.log('[Manual Close] ✅ OCO orders cancelled');
                                        } catch (cancelError: any) {
                                            console.warn('[Manual Close] Failed to cancel OCO:', cancelError);
                                            // Continue anyway - market close will override
                                        }
                                    }
                                    
                                    const closeSide = activeSignal.type === 'BUY' ? 'SELL' : 'BUY';
                                    
                                    // Ensure we have a valid quantity
                                    let qty = activeSignal.quantity || 0;
                                    if (qty === 0 && activeSignal.execution?.size) {
                                         qty = activeSignal.execution.size;
                                    }

                                    // NEW: Fallback to fetch ACTUAL position from Binance if local is 0
                                    let actualSide = closeSide;
                                    
                                    if (qty === 0) {
                                        try {
                                             // showNotification("Syncing position with Binance...", "info");
                                             const positions = await binanceTradingService.getPositions(tradeSymbol);
                                             const pos = positions.find(p => p.symbol === tradeSymbol && parseFloat(p.positionAmt) !== 0);
                                             
                                             if (pos) {
                                                 const amt = parseFloat(pos.positionAmt);
                                                 qty = Math.abs(amt);
                                                 // Determine close side: If Long (pos > 0), we SELL. If Short (pos < 0), we BUY.
                                                 actualSide = amt > 0 ? 'SELL' : 'BUY';
                                                 console.log(`[Close] Found active position on Binance: ${qty} (${actualSide})`);
                                             } else {
                                                 const confirmClear = window.confirm(
                                                     "No open position found on Binance for this symbol.\n\nClick OK to clear this 'stuck' signal locally."
                                                 );
                                                 if (confirmClear) {
                                                     handleExternalTradeClosed(activeSignal.id, 0, 0, 0); 
                                                     showNotification("Local signal cleared.", "success");
                                                 }
                                                 return;
                                             }
                                        } catch (e: any) {
                                            console.error("[Close] Failed to fetch position:", e);
                                            showNotification("Error syncing position: " + (e.message || e), "error");
                                            return;
                                        }
                                    }
                                    
                                    // Dynamically round quantity based on Binance LOT_SIZE stepSize
                                    const roundedQty = await binanceTradingService.roundQuantity(tradeSymbol, qty);
                                    
                                    if (Number(roundedQty) === 0) {
                                        showNotification("Cannot close: Quantity is 0", "error");
                                        return;
                                    }

                                    console.log("[Close] Attempting to close", {
                                        original: activeSignal.symbol,
                                        tradeSymbol,
                                        qty: qty,
                                        roundedQty,
                                        side: actualSide
                                    });

                                    await binanceTradingService.placeOrder({
                                        symbol: tradeSymbol,
                                        side: actualSide as 'BUY' | 'SELL',
                                        type: 'MARKET',
                                        quantity: roundedQty
                                    });
                                    
                                    showNotification("Position Closed on Binance!", "success");
                                    
                                    // Calculate PnL locally for display/history
                                    // Fetch latest price? Use current candle close
                                    const closePrice = candles[candles.length - 1].close;
                                    const pnl = activeSignal.type === 'BUY' 
                                        ? (closePrice - activeSignal.entryPrice) * (activeSignal.quantity || 0)
                                        : (activeSignal.entryPrice - closePrice) * (activeSignal.quantity || 0);

                                    const symbolToClear = activeSignal.symbol;
                                    setActiveSignal(null); // Clear active signal
                                    storageService.saveActiveSignal(null, symbolToClear); // Clear persistence
                                    
                                    // Save log
                                    // ... existing log logic ...
                                } catch (e: any) {
                                    showNotification("Components Error: " + e.message, "error");
                                }
                            }}
                            className="col-span-2 bg-slate-800 hover:bg-slate-700 text-white py-2.5 rounded-lg text-xs font-bold border border-slate-600 transition-all flex justify-center items-center gap-2"
                          >
                            <XCircle className="w-3.5 h-3.5" /> CLOSE POSITION (MARKET)
                          </button>
                        ) : (
                          <>
                            <button onClick={() => handleFeedback('WIN')} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 py-2.5 rounded-lg text-xs font-bold border border-emerald-500/20 transition-all flex justify-center items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5" /> WIN
                            </button>
                            <button onClick={() => handleFeedback('LOSS')} className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 py-2.5 rounded-lg text-xs font-bold border border-rose-500/20 transition-all flex justify-center items-center gap-2">
                              <XCircle className="w-3.5 h-3.5" /> LOSS
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 flex flex-col items-center justify-center text-slate-600 space-y-3 relative z-10">
                      <div className="w-12 h-12 rounded-full bg-slate-800/50 flex items-center justify-center">
                        <ShieldCheck className="w-6 h-6 opacity-40" />
                      </div>
                      <span className="text-xs font-medium text-center text-slate-500">
                        {activeSignal && activeSignal.outcome === 'PENDING' ? `Trade managed elsewhere` : "No active trade signal"}
                      </span>
                      
                      <div className="grid grid-cols-2 gap-2 w-full mt-2">
                         <button
                          onClick={handleAnalyze}
                          disabled={isAnalyzing || (activeSignal?.outcome === 'PENDING' && activeSignal.symbol === selectedAsset.symbol)}
                          className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all text-xs border ${isAnalyzing 
                            ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' 
                            : 'bg-blue-600 border-blue-500 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'}`}
                        >
                          {isAnalyzing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5" />}
                          {isAnalyzing ? "..." : "Predict"}
                        </button>

                        <button
                          onClick={handleQuickTrain}
                          disabled={isTraining || candles.length < 150}
                          className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all text-xs border ${isTraining 
                            ? 'bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed' 
                            : 'bg-emerald-600 border-emerald-500 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'}`}
                        >
                          {isTraining ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                          {isTraining ? `${trainingProgress}%` : "Train"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tier 7: AI Engine Status */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col shrink-0 overflow-hidden relative group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl group-hover:bg-amber-500/10 transition-all"></div>
                  
                  <div className="flex justify-between items-center mb-4 relative z-10">
                    <h3 className="text-xs font-bold text-amber-500 flex items-center gap-2 tracking-wider">
                      <Zap className="w-4 h-4" /> TIER 7 ENGINE
                    </h3>
                    {lastAnalysis && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        {new Date(lastAnalysis.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {lastAnalysis ? (
                    <div className="space-y-4 relative z-10">
                      {/* Visual Probability Split */}
                      <div className="space-y-1.5">
                         <div className="flex justify-between text-[10px] font-bold uppercase tracking-tight">
                            <span className="text-blue-400">CNN (Visual)</span>
                            <span className="text-purple-400">LSTM (Trend)</span>
                         </div>
                         <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden flex">
                            {/* CNN Weight */}
                            <div 
                              className={`h-full transition-all duration-700 ${lastAnalysis.type === 'BUY' ? 'bg-blue-500' : lastAnalysis.type === 'SELL' ? 'bg-rose-500' : 'bg-slate-600'}`} 
                              style={{ width: lastAnalysis.type === 'HOLD' ? '50%' : '40%' }}
                            ></div>
                            {/* LSTM Weight */}
                            <div 
                              className={`h-full transition-all duration-700 opacity-80 ${lastAnalysis.type === 'BUY' ? 'bg-emerald-500' : lastAnalysis.type === 'SELL' ? 'bg-rose-600' : 'bg-slate-700'}`} 
                              style={{ width: lastAnalysis.type === 'HOLD' ? '50%' : '60%' }}
                            ></div>
                         </div>
                      </div>

                      <div className="flex items-center justify-between">
                         <div className="flex flex-col">
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Decision</span>
                            <span className={`text-lg font-black ${lastAnalysis.type === 'BUY' ? 'text-emerald-400' : lastAnalysis.type === 'SELL' ? 'text-rose-400' : 'text-slate-400'}`}>
                              {lastAnalysis.type}
                            </span>
                         </div>
                         <div className="flex flex-col items-end">
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Confidence</span>
                            <span className="text-xl font-mono font-black text-white">
                              {isNaN(lastAnalysis.confidence) || !isFinite(lastAnalysis.confidence) ? 'N/A' : `${Math.round(lastAnalysis.confidence)}%`}
                            </span>
                         </div>
                      </div>

                      {/* Execution Preview (Only if not HOLD) */}
                       {lastAnalysis.type !== 'HOLD' && lastAnalysis.execution && (
                        <div className="bg-slate-950/80 rounded-lg p-3 border border-slate-800/50 space-y-2">
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] text-slate-500">Margin</span>
                              <span className="text-xs font-bold text-white">
                                USDT {lastAnalysis.execution?.margin?.toFixed(2) || '0.00'}
                              </span>
                           </div>
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] text-slate-500">Leverage</span>
                              <span className="text-xs font-bold text-amber-500">{lastAnalysis.execution?.leverage || '1'}x</span>
                           </div>
                           <div className="h-px bg-slate-800 mt-1"></div>
                           <div className="flex justify-between items-center text-[10px]">
                              <span className="text-slate-500 uppercase font-bold">Risk Reward</span>
                              <span className="text-emerald-400 font-bold">1 : {lastAnalysis.riskRewardRatio || '0.00'}</span>
                           </div>
                        </div>
                      )}

                      <p className="text-[10px] text-slate-400 italic bg-slate-800/30 p-2 rounded leading-relaxed border-l-2 border-emerald-500/30">
                        {lastAnalysis.reasoning}
                      </p>
                    </div>
                  ) : (
                    <div className="py-8 flex flex-col items-center justify-center text-slate-600 space-y-2 italic">
                       <Radio className="w-8 h-8 opacity-20 animate-pulse" />
                       <span className="text-[10px]">Awaiting engine scan...</span>
                    </div>
                  )}
                </div>

                {/* SMC Insights Panel */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col shrink-0 overflow-hidden relative group">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl group-hover:bg-purple-500/10 transition-all"></div>
                  
                  <div className="flex justify-between items-center mb-4 relative z-10">
                    <h3 className="text-xs font-bold text-purple-500 flex items-center gap-2 tracking-wider">
                      <Layers className="w-4 h-4" /> SMC INSIGHTS
                    </h3>
                  </div>

                  {lastAnalysis && lastAnalysis.meta && lastAnalysis.meta.smc ? (
                    <div className="space-y-4 relative z-10">
                       <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                             <span className="text-[10px] text-slate-500 font-bold uppercase">Structure</span>
                             <span className={`text-lg font-black ${
                               lastAnalysis.meta.smc.score >= 0.7 ? 'text-emerald-400' : 
                               lastAnalysis.meta.smc.score <= 0.3 ? 'text-rose-400' : 'text-slate-400'
                             }`}>
                               {lastAnalysis.meta.smc.score >= 0.7 ? 'BULLISH' : 
                                lastAnalysis.meta.smc.score <= 0.3 ? 'BEARISH' : 'NEUTRAL'}
                             </span>
                          </div>
                          <div className="flex flex-col items-end">
                             <span className="text-[10px] text-slate-500 font-bold uppercase">Context</span>
                             <span className={`text-xs font-bold px-2 py-1 rounded ${
                               lastAnalysis.meta.smc.active_ob ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-500'
                             }`}>
                               {lastAnalysis.meta.smc.active_ob ? 'OB RETEST' : 'NO SETUP'}
                             </span>
                          </div>
                       </div>
                       
                       {lastAnalysis.meta.smc.active_ob && (
                           <div className="bg-slate-950/80 rounded-lg p-3 border border-slate-800/50 space-y-2">
                               <div className="flex justify-between items-center mb-1">
                                   <span className="text-[10px] text-slate-400 font-bold">ACTIVE ORDER BLOCK</span>
                                   <div className="flex items-center gap-1">
                                       <span className={`w-2 h-2 rounded-full ${lastAnalysis.meta.smc.active_ob.type === 'BULLISH_OB' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                       <span className="text-[10px] text-slate-500 font-mono">
                                          {lastAnalysis.meta.smc.active_ob.type === 'BULLISH_OB' ? 'Bullish' : 'Bearish'}
                                       </span>
                                   </div>
                               </div>
                               <div className="flex justify-between items-center text-xs font-mono">
                                   <span className="text-slate-500">Top</span>
                                   <span className="text-rose-400">{lastAnalysis.meta.smc.active_ob.top}</span>
                               </div>
                               <div className="flex justify-between items-center text-xs font-mono">
                                   <span className="text-slate-500">Bottom</span>
                                   <span className="text-emerald-400">{lastAnalysis.meta.smc.active_ob.bottom}</span>
                               </div>
                           </div>
                       )}
                    </div>
                  ) : (
                    <div className="py-8 flex flex-col items-center justify-center text-slate-600 space-y-2 italic">
                       <Layers className="w-8 h-8 opacity-20" />
                       <span className="text-[10px]">No SMC data available</span>
                    </div>
                  )}
                 </div>

                 {/* RSI Divergence Panel */}
                 {indicators?.rsiDivergence && (
                   <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col shrink-0 overflow-hidden relative group">
                     <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl transition-all ${
                       indicators.rsiDivergence.type === 'BULLISH' ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                     }`}></div>
                     
                     <div className="flex justify-between items-center mb-4 relative z-10">
                       <h3 className={`text-xs font-bold flex items-center gap-2 tracking-wider ${
                         indicators.rsiDivergence.type === 'BULLISH' ? 'text-emerald-500' : 'text-rose-500'
                       }`}>
                         <Activity className="w-4 h-4" /> RSI DIVERGENCE
                       </h3>
                       <span className="text-[10px] text-slate-500 font-mono">
                         {new Date(indicators.rsiDivergence.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                       </span>
                     </div>

                     <div className="space-y-4 relative z-10">
                       <div className="flex items-center justify-between">
                         <div className="flex flex-col">
                           <span className="text-[10px] text-slate-500 font-bold uppercase">Type</span>
                           <span className={`text-lg font-black ${
                             indicators.rsiDivergence.type === 'BULLISH' ? 'text-emerald-400' : 'text-rose-400'
                           }`}>
                             {indicators.rsiDivergence.type === 'BULLISH' ? '📈 BULLISH' : '📉 BEARISH'}
                           </span>
                         </div>
                         <div className="flex flex-col items-end">
                           <span className="text-[10px] text-slate-500 font-bold uppercase">Strength</span>
                           <span className="text-xl font-mono font-black text-white">
                             {indicators.rsiDivergence.strength}%
                           </span>
                         </div>
                       </div>

                       <div className="space-y-1">
                         <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                           <div 
                             className={`h-full transition-all duration-700 ${
                               indicators.rsiDivergence.type === 'BULLISH' ? 'bg-emerald-500' : 'bg-rose-500'
                             }`}
                             style={{ width: `${indicators.rsiDivergence.strength}%` }}
                           ></div>
                         </div>
                       </div>

                       <div className={`bg-slate-950/80 rounded-lg p-3 border ${
                         indicators.rsiDivergence.type === 'BULLISH' ? 'border-emerald-500/20' : 'border-rose-500/20'
                       }`}>
                         <p className="text-[10px] text-slate-400 leading-relaxed">
                           {indicators.rsiDivergence.type === 'BULLISH' 
                             ? '🔄 Price making lower lows while RSI making higher lows. Potential reversal to upside.'
                             : '🔄 Price making higher highs while RSI making lower highs. Potential reversal to downside.'}
                         </p>
                       </div>

                       <div className="grid grid-cols-2 gap-2 text-[10px]">
                         <div className="bg-slate-800/50 rounded p-2">
                           <div className="text-slate-500 font-bold mb-1">Price Pivots</div>
                           <div className="text-white font-mono">
                             {indicators.rsiDivergence.pricePoints.map((p, i) => (
                               <div key={i}>${p.value.toFixed(2)}</div>
                             ))}
                           </div>
                         </div>
                         <div className="bg-slate-800/50 rounded p-2">
                           <div className="text-slate-500 font-bold mb-1">RSI Pivots</div>
                           <div className="text-white font-mono">
                             {indicators.rsiDivergence.rsiPoints.map((p, i) => (
                               <div key={i}>{p.value.toFixed(1)}</div>
                             ))}
                           </div>
                         </div>
                       </div>
                     </div>
                   </div>
                 )}

                 {/* Trading Configuration Panel */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col shrink-0">
                  <h3 className="text-xs font-bold text-slate-400 mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4 text-slate-400" />
                    TRADING CONFIG
                  </h3>

                  <div className="space-y-5">
                    {/* Trading Mode Toggle */}
                    <div className="space-y-2">
                      <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
                        <button
                          onClick={() => {
                            setTradingMode('paper');
                            storageService.saveTradingMode('paper');
                          }}
                          className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${tradingMode === 'paper'
                            ? 'bg-slate-800 text-blue-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                          <BookOpen className="w-3 h-3" /> PAPER
                        </button>
                        <button
                          onClick={() => {
                            if (balance < 1) {
                              showNotification('⚠️ Insufficient balance.', 'warning');
                              return;
                            }
                            if (window.confirm('Enable LIVE TRADING mode? Real funds will be used.')) {
                              setTradingMode('live');
                              storageService.saveTradingMode('live');
                            }
                          }}
                          className={`flex-1 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${tradingMode === 'live'
                            ? 'bg-rose-900/30 text-rose-400 shadow-sm'
                            : 'text-slate-500 hover:text-slate-300'
                            }`}
                        >
                          <Zap className="w-3 h-3" /> LIVE
                        </button>
                      </div>
                      {tradingMode === 'live' && (
                        <div className="text-[10px] text-center text-rose-400 bg-rose-500/5 py-1 rounded border border-rose-500/10">
                           Real funds active
                        </div>
                      )}
                    </div>

                    {/* Leverage Configuration */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Leverage</label>
                        <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">{leverage}x</span>
                      </div>
                      
                      <div className="relative h-6 flex items-center">
                        <div className="absolute w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                           <div className="h-full bg-amber-500/50" style={{ width: `${(leverage / 20) * 100}%` }}></div>
                        </div>
                        <input
                          type="range" min="1" max="20" value={leverage}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setLeverage(val);
                            storageService.saveLeverage(val);
                          }}
                          className="w-full h-6 opacity-0 cursor-pointer absolute z-10"
                        />
                        <div className="w-3 h-3 bg-amber-500 rounded-full shadow-lg absolute pointer-events-none transition-all" 
                             style={{ left: `calc(${((leverage - 1) / 19) * 100}% - 6px)` }}></div>
                      </div>

                      <div className="flex justify-between gap-1">
                        {[5, 10, 15, 20].map(preset => (
                          <button
                            key={preset}
                            onClick={() => {
                              setLeverage(preset);
                              storageService.saveLeverage(preset);
                            }}
                            className={`flex-1 py-1 rounded text-[9px] font-bold transition-all border ${leverage === preset
                              ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              : 'bg-slate-950 text-slate-500 border-slate-800 hover:border-slate-700'
                              }`}
                          >
                            {preset}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Info Display */}
                    <div className="pt-3 border-t border-slate-800">
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-500">Balance</span>
                          <span className="text-xs font-mono font-medium text-emerald-400">USDT {balance.toLocaleString('id-ID', { maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-slate-500">Max Size</span>
                          <span className="text-xs font-mono font-medium text-slate-300">USDT {(balance * leverage * (riskPercent / 100)).toLocaleString('id-ID', { maximumFractionDigits: 0 })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* RIGHT COLUMN: News \u0026 Order Book */}
              <div className={`lg:col-span-1 space-y-3 md:space-y-4 flex-col lg:overflow-y-auto ${terminalTab === 'data' ? 'flex' : 'hidden lg:flex'}`}>

                {/* Order Book Component */}
                <div className="shrink-0">
                  <OrderBook symbol={selectedAsset.symbol} />
                </div>

                {/* News Feed */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 md:p-4 shadow-xl flex flex-col min-h-[300px] shrink-0">
                  <h2 className="text-slate-400 text-xs font-bold tracking-wider mb-4 flex items-center gap-2">
                    <Globe className="w-4 h-4" /> NEWS WIRE
                  </h2>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {marketNews.map((item) => (
                      <div key={item.id} className="p-3 bg-slate-950 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors">
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-[10px] px-1.5 rounded font-bold ${item.sentiment === 'POSITIVE' ? 'bg-emerald-500/20 text-emerald-400' : item.sentiment === 'NEGATIVE' ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-400'}`}>
                            {item.sentiment}
                          </span>
                          <span className="text-[10px] text-slate-600">{item.time}</span>
                        </div>
                        <h3 className="text-xs text-slate-200 font-medium leading-relaxed">
                          {item.headline}
                        </h3>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        <Analytics />
      </main>
    </div>
  );
}

export default App;