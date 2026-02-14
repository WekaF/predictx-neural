import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, Zap, TrendingUp, TrendingDown, RefreshCw, ShieldCheck, DollarSign, BrainCircuit, Target, BookOpen, FlaskConical, LayoutDashboard, ChevronDown, Layers, Globe, Radio, PenTool, AlertCircle, CheckCircle2, List, Bell, Edit3, Settings as SettingsIcon, Coins, AlertTriangle, CheckCircle, XCircle, BarChart3, Trash2, Settings, Brain, UploadCloud } from 'lucide-react';
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
import { EnhancedExecutedTrade } from './types/enhanced';
import { generateMarketNews, calculateAggregateSentiment } from './services/newsService';
import { storageService } from './services/storageService';
import { sendWebhookNotification } from './services/webhookService';
import { NotificationService } from './services/notificationService';
import * as binanceService from './services/binanceService';
import * as forexService from './services/forexService';
import { Candle, TechnicalIndicators, TradeSignal, TrainingData, NewsItem, Alert, ExecutedTrade, Asset } from './types';
import { generateUUID } from './utils/uuid';
import { Analytics } from "@vercel/analytics/react"
import { futuresRiskManager } from './services/futuresRiskManager';
import { liquidationCalculator } from './services/liquidationCalculator';




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

  // UI States
  const [showManualModal, setShowManualModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isSyncingHistory, setIsSyncingHistory] = useState(false);
  const [showStrategyGuide, setShowStrategyGuide] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState<TrainingData | null>(null);
  const [terminalTab, setTerminalTab] = useState<'trade' | 'data'>('trade'); // Mobile Tab State
  const [isMobileDataExpanded, setIsMobileDataExpanded] = useState(false); // Mobile collapsible state

  // Trading Configuration
  const [tradingMode, setTradingMode] = useState<'paper' | 'live'>(() => storageService.getTradingMode() ?? 'paper');
  const [leverage, setLeverage] = useState(() => storageService.getLeverage() ?? 10); // 1-20x

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
      console.log(`[App] ✅ Loaded ${savedData.length} training records from local storage`);
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

  // Load balance when selectedAsset changes
  useEffect(() => {
    const loadBinanceBalance = async () => {
      try {
        console.log(`[App] 💰 Fetching balance for ${selectedAsset.symbol}...`);
        const balances = await getAccountBalances();
        console.log('[App] Raw balances count:', balances.length);
        
        // For Futures trading, we typically want the USDT (or USDC) balance as margin/wallet balance
        // Let's check for USDT first, then USDC, then fallback to base asset if needed
        const quoteCurrency = 'USDT';
        const marginBalance = balances.find(b => b.asset === quoteCurrency) || 
                            balances.find(b => b.asset === 'USDC');
        
        console.log('[App] Found margin balance object:', marginBalance);
        
        if (marginBalance) {
             console.log(`[App] ${marginBalance.asset} Free: ${marginBalance.free}, Locked: ${marginBalance.locked}`);
        }

        const foundBalance = parseFloat(marginBalance?.free || '0');
        
        if (foundBalance > 0) {
            updateBalance(foundBalance);
            console.log(`[App] ✅ Wallet Balance (${marginBalance?.asset}): ${foundBalance.toFixed(2)}`);
        } else {
            console.log(`[App] ⚠️ No ${quoteCurrency} balance found, using local/virtual balance.`);
        }
      } catch (error) {
        console.error('[App] ❌ Failed to load Binance balance:', error);
        console.log('[App] Using balance 0 (could not connect to Binance)');
        // updateBalance(0); // Don't clear local balance just because fetch failed
      }
    };


    loadBinanceBalance();
    
    // Restore Active Signal if any for the CURRENTLY selected asset
    const savedSignal = storageService.getActiveSignal(selectedAsset.symbol);
    if (savedSignal && savedSignal.symbol === selectedAsset.symbol) {
      console.log('[App] ♻️ Restored active signal for:', selectedAsset.symbol);
      setActiveSignal(savedSignal);
      
      // Override UI settings to match the open entry as requested by user
      if (savedSignal.execution?.leverage) {
        setLeverage(savedSignal.execution.leverage);
      }
      if (savedSignal.execution?.mode) {
        setTradingMode(savedSignal.execution.mode);
      }
    } else {
      setActiveSignal(null); // Clear state if no active signal for this asset
    }

    // Restore Last Analysis (Engine Scan) if any for this asset
    const savedAnalysis = storageService.getLastAnalysis(selectedAsset.symbol);
    if (savedAnalysis) {
      console.log('[App] ♻️ Restored last analysis for:', selectedAsset.symbol);
      setLastAnalysis(savedAnalysis);
    } else {
      setLastAnalysis(null);
    }
  }, [selectedAsset]); // Re-fetch when asset changes

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

  // Show Notification Helper
  const showNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000); // Auto hide after 5s
  };

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
        entryTime: new Date(activeSignal.timestamp).toLocaleTimeString(),
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

  // Trigger Local ML Analysis
  const handleAnalyze = useCallback(async () => {
    console.log('[handleAnalyze] 🔍 Analysis triggered', {
      autoMode,
      tradingMode,
      hasIndicators: !!indicators,
      candlesCount: candles.length,
      hasPendingSignal: !!pendingSignal,
      hasActiveSignal: !!activeSignal,
      activeSignalOutcome: activeSignal?.outcome
    });

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
  const confirmTrade = (signalOverride?: TradeSignal) => {
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

    const signalToPersist = { 
      ...signal, 
      outcome: 'PENDING',
      execution: {
        status: 'FILLED',
        side: signal.type,
        leverage: leverage,
        mode: tradingMode
      }
    };
    setActiveSignal(signalToPersist);
    storageService.saveActiveSignal(signalToPersist, signal.symbol); // Persist for refresh
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
        takeProfit: signal.takeProfit,
        quantity: 0, // Will be calculated when trade closes
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
  };

  // Manual Close Trade Handler
  const handleManualCloseTrade = useCallback((tradeId: string) => {
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
  }, [tradeHistory, candles, balance, riskPercent, activeSignal, updateBalance]);

  const rejectTrade = () => {
    setPendingSignal(null);
    showNotification('Trade rejected', 'info');
  };

  // Handle Manual Trade
  const handleManualTrade = async (type: 'BUY' | 'SELL', entryPrice: number, stopLoss: number, takeProfit: number) => {
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
      reasoning: 'Manual trade entry',
      confidence: 50,
      timestamp: Date.now(),
      outcome: 'PENDING'
    };

    // Calculate Quantity (Asset Units) - UPGRADED TO FUTURES RISK MANAGER
    const entry = entryPrice || 1; // Prevent div by zero
    
    // OLD METHOD (Simple leverage-based):
    // const positionSizeUsd = balance * leverage * (riskPercent / 100);
    
    // NEW METHOD (Stop-loss-aware position sizing):
    // This ensures we risk exactly riskPercent% of balance regardless of SL distance
    const positionSizeUsd = futuresRiskManager.calculatePositionSize(
      balance,
      entryPrice,
      stopLoss,
      leverage
    );
    
    console.log(`[Position Sizing] Balance: $${balance}, Entry: $${entryPrice}, SL: $${stopLoss}, Leverage: ${leverage}x`);
    console.log(`[Position Sizing] Calculated Position: $${positionSizeUsd.toFixed(2)}`);
    
    // Dynamically round quantity based on Binance LOT_SIZE stepSize
    const tradeSymbol = selectedAsset.symbol.replace('/', '').replace('USD', 'USDT');
    const quantityAsset = await binanceTradingService.roundQuantity(tradeSymbol, positionSizeUsd / entry);
    
    console.log(`[Position Sizing] Quantity: ${quantityAsset} ${selectedAsset.symbol.split('/')[0]}`);
    
    // Safety check: Don't allow 0 or extremely small quantity
    if (quantityAsset <= 0) {
        showNotification(`Insufficient balance ($${balance.toFixed(2)}) or risk to open position.`, "error");
        return;
    }
    
    // Validate liquidation risk
    const side: 'LONG' | 'SHORT' = validatedType === 'BUY' ? 'LONG' : 'SHORT';
    const liqInfo = liquidationCalculator.validateTrade(entryPrice, stopLoss, leverage, side);
    
    if (liqInfo.riskLevel === 'EXTREME') {
      showNotification(`⚠️ Liquidation Risk: ${liqInfo.warningMessage}`, "error");
      console.error('[Liquidation Risk] Trade blocked:', liqInfo);
      return;
    }
    
    if (liqInfo.riskLevel === 'HIGH') {
      showNotification(`⚠️ High Liquidation Risk: ${liqInfo.warningMessage}`, "warning");
    }
    
    console.log(`[Liquidation] Price: $${liqInfo.liquidationPrice}, Risk: ${liqInfo.riskLevel}, Safety: ${liqInfo.safetyMargin.toFixed(1)}%`);
    
    // Execute on Binance (if configured/Testnet)
    if (binanceTradingService.isConfigured()) {
        try {
            // Format symbol (remove /)
            const tradeSymbol = newSignal.symbol.replace('/', '').replace('USD', 'USDT');
            
            // Execute Market Order
            // Note: We use MARKET for immediate entry. 
            // TODO: Implement LIMIT based on newSignal.entryPrice? For now MARKET for speed/UX.
            await binanceTradingService.placeOrder({
                symbol: tradeSymbol,
                side: newSignal.type as 'BUY' | 'SELL',
                type: 'MARKET',
                quantity: quantityAsset 
                // Note: Binance requires specific precision (LOT_SIZE). 
                // binanceTradingService should ideally handle this or we trunctate. 
                // For now, let's assume helper handles it or we send formatted.
                // We'll fix precision in service if it fails.
            });
            showNotification("Order executed on Binance!", "success");
        } catch (error: any) {
            console.error("Binance Execution Failed:", error);
            showNotification("Binance Order Failed: " + error.message, "error");
            // We still proceed to create local signal for tracking? 
            // Maybe return? User might want to retry.
            // Let's return to prevent de-sync.
            return;
        }
    }

    // Add metadata with liquidation info for UI display
    const signalWithQty = { 
      ...newSignal, 
      quantity: quantityAsset,
      execution: {
        status: 'FILLED',
        side: newSignal.type,
        leverage: leverage,
        mode: tradingMode
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
      entryTime: new Date(activeSignal.timestamp).toLocaleTimeString(),
      exitTime: new Date().toLocaleTimeString(),
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

  const handleSyncHistory = async () => {
    if (!binanceTradingService.isConfigured()) {
      showNotification("Binance API credentials missing. Configure in settings.", "error");
      return;
    }

    setIsSyncingHistory(true);
    try {
      showNotification(`Fetching trade history for ${selectedAsset.symbol}...`, "info");
      const binanceTrades = await binanceTradingService.getTradeHistory(selectedAsset.symbol);
      
      if (binanceTrades.length === 0) {
        showNotification("No account history found for this symbol.", "warning");
        setIsSyncingHistory(false);
        return;
      }

      showNotification(`Found ${binanceTrades.length} trades. Enriching with market data...`, "info");

      // Convert to EnhancedExecutedTrade
      const mappedTrades: EnhancedExecutedTrade[] = binanceTrades.map(t => ({
        id: String(t.id),
        symbol: t.symbol,
        entryTime: new Date(t.time).toISOString(),
        exitTime: new Date(t.time).toISOString(), // Approximate
        type: t.isBuyer ? 'BUY' : 'SELL',
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

      // Enrich with context (Market Reconstruction)
      const enrichedTrades: EnhancedExecutedTrade[] = [];
      for (const trade of mappedTrades) {
         // Check if already exists to avoid re-enriching cost
         const exists = tradeHistory.find(h => h.id === trade.id);
         if (exists && exists.marketContext) {
           enrichedTrades.push(exists);
         } else {
           const enriched = await enrichTradeWithContext(trade);
           enrichedTrades.push(enriched);
         }
      }

      // Deduplicate and merge by ID
      const existingMap = new Map<string, EnhancedExecutedTrade>(tradeHistory.map(t => [t.id, t]));
      enrichedTrades.forEach(t => existingMap.set(t.id, t));
      
      const uniqueSorted = (Array.from(existingMap.values()) as EnhancedExecutedTrade[]).sort((a, b) => 
        new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime()
      );

      setTradeHistory(uniqueSorted);
      
      // Save new trades to storage
      enrichedTrades.forEach(t => storageService.saveTradingLog(t));
      
      showNotification(`Successfully synced ${enrichedTrades.length} trades!`, "success");
    } catch (error: any) {
      console.error("Sync error:", error);
      showNotification(`Failed to sync history: ${error.message}`, "error");
    } finally {
      setIsSyncingHistory(false);
    }
  };

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
               onClick={() => setCurrentView('futures')}
               className={`p-3 rounded-xl transition-all duration-300 group relative ${currentView === 'futures' ? 'bg-purple-500/10 text-purple-400' : 'text-slate-400 hover:bg-white/5'}`}
               title="Futures Dashboard"
            >
               <Activity className="w-5 h-5 group-hover:scale-110 transition-transform" />
               {currentView === 'futures' && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-purple-500 rounded-r-full shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div>}
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
                {currentView === 'terminal' ? 'NeuroTrade' : currentView === 'backtest' ? 'Backtest' : currentView === 'analytics' ? 'Analytics' : currentView === 'training' ? 'AI Training' : 'Leverage'}
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
              <div className={`lg:col-span-2 space-y-3 md:space-y-4 flex-col lg:overflow-hidden ${terminalTab === 'trade' ? 'flex' : 'hidden lg:flex'}`}>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 md:p-4 shadow-xl flex flex-col min-h-[250px] sm:min-h-[300px]">
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
                </div>

                {/* Trade History Panel */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex flex-col h-64 sm:h-96 overflow-hidden">
                  <div className="px-3 md:px-4 py-2 border-b border-slate-800 flex items-center gap-2">
                    <List className="w-4 h-4 text-slate-400" />
                    <span className="text-xs font-bold text-slate-400">SESSION TRADE HISTORY</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <TradeList trades={tradeHistory} onCloseTrade={handleManualCloseTrade} />
                  </div>
                </div>
              </div>

              {/* MIDDLE COLUMN: Signal & Alerts */}
              <div className={`lg:col-span-1 space-y-3 md:space-y-4 flex-col lg:overflow-y-auto ${terminalTab === 'trade' ? 'flex' : 'hidden lg:flex'}`}>
                {/* Active Signal Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg relative overflow-hidden group shrink-0">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-all"></div>

                  <h2 className="text-slate-400 text-xs font-bold tracking-wider mb-4 flex items-center gap-2 relative z-10">
                    <Target className="w-4 h-4 text-blue-400" /> ACTIVE TRADE
                  </h2>

                  {activeSignal && activeSignal.outcome === 'PENDING' && activeSignal.symbol === selectedAsset.symbol ? (
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
                                  ${activeSignal.meta.liquidation_info.liquidationPrice.toLocaleString()}
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
                                    const tradeSymbol = activeSignal.symbol.replace('/', '').replace('USD', 'USDT');
                                    const closeSide = activeSignal.type === 'BUY' ? 'SELL' : 'BUY';
                                    
                                    // Dynamically round quantity based on Binance LOT_SIZE stepSize
                                    const roundedQty = await binanceTradingService.roundQuantity(tradeSymbol, activeSignal.quantity || 0);
                                    
                                    await binanceTradingService.placeOrder({
                                        symbol: tradeSymbol,
                                        side: closeSide,
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
                  )}
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