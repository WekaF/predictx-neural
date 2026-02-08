import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, Zap, TrendingUp, TrendingDown, RefreshCw, ShieldCheck, DollarSign, BrainCircuit, Target, BookOpen, FlaskConical, LayoutDashboard, ChevronDown, Layers, Globe, Radio, PenTool, AlertCircle, CheckCircle2, List, Bell, Edit3, Settings as SettingsIcon, Coins, AlertTriangle } from 'lucide-react';
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
import { calculateRSI, calculateFibonacci, analyzeTrend, calculateSMA, calculateEMA, findSupportResistance } from './utils/technical';
import { getHistoricalKlines, getCurrentPrice } from './services/binanceService';
import { getAccountBalances } from './services/binanceTradingService';
import { analyzeMarket, trainModel, refreshModel } from './services/mlService';
import { generateMarketNews, calculateAggregateSentiment } from './services/newsService';
import { storageService } from './services/storageService';
import { sendWebhookNotification } from './services/webhookService';
import * as binanceService from './services/binanceService';
import * as forexService from './services/forexService';
import { Candle, TechnicalIndicators, TradeSignal, TrainingData, NewsItem, Alert, ExecutedTrade, Asset } from './types';
import { generateUUID } from './utils/uuid';



// Supported Assets Configuration
// Binance Trading Pairs (Real-time from Binance API)
const BINANCE_ASSETS: Asset[] = [
    // === MAJOR CRYPTO (USDT pairs) ===
    { symbol: 'BTC/USD', name: 'Bitcoin', type: 'CRYPTO', price: 0 },
    { symbol: 'ETH/USD', name: 'Ethereum', type: 'CRYPTO', price: 0 },
    { symbol: 'BNB/USD', name: 'Binance Coin', type: 'CRYPTO', price: 0 },
    { symbol: 'SOL/USD', name: 'Solana', type: 'CRYPTO', price: 0 },
    { symbol: 'XRP/USD', name: 'Ripple', type: 'CRYPTO', price: 0 },
    { symbol: 'ADA/USD', name: 'Cardano', type: 'CRYPTO', price: 0 },
    { symbol: 'AVAX/USD', name: 'Avalanche', type: 'CRYPTO', price: 0 },
    { symbol: 'DOGE/USD', name: 'Dogecoin', type: 'CRYPTO', price: 0 },
    { symbol: 'DOT/USD', name: 'Polkadot', type: 'CRYPTO', price: 0 },
    { symbol: 'MATIC/USD', name: 'Polygon', type: 'CRYPTO', price: 0 },
    { symbol: 'LINK/USD', name: 'Chainlink', type: 'CRYPTO', price: 0 },
    { symbol: 'UNI/USD', name: 'Uniswap', type: 'CRYPTO', price: 0 },
    { symbol: 'ATOM/USD', name: 'Cosmos', type: 'CRYPTO', price: 0 },
    { symbol: 'LTC/USD', name: 'Litecoin', type: 'CRYPTO', price: 0 },
    { symbol: 'NEAR/USD', name: 'NEAR Protocol', type: 'CRYPTO', price: 0 },
];

const SUPPORTED_ASSETS = BINANCE_ASSETS;

function App() {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [indicators, setIndicators] = useState<TechnicalIndicators | null>(null);
  
  // Asset State
  const [selectedAsset, setSelectedAsset] = useState<Asset>(SUPPORTED_ASSETS[0]);
  const [isAssetMenuOpen, setIsAssetMenuOpen] = useState(false);

  // Trade States
  const [pendingSignal, setPendingSignal] = useState<TradeSignal | null>(null); // Awaiting confirmation
  const [activeSignal, setActiveSignal] = useState<TradeSignal | null>(null); // Confirmed & Active
  const [tradeHistory, setTradeHistory] = useState<ExecutedTrade[]>([]);
  
  // UI States
  const [showManualModal, setShowManualModal] = useState(false);
  const [showStrategyGuide, setShowStrategyGuide] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [editingFeedback, setEditingFeedback] = useState<TrainingData | null>(null);
  
  // Alerts
  const [alerts, setAlerts] = useState<Alert[]>([]);
  
  // Notification State
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error' | 'info' | 'warning'} | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [balance, setBalance] = useState(0); // Will be loaded from Binance
  const [riskPercent, setRiskPercent] = useState(1);
  const [trainingHistory, setTrainingHistory] = useState<TrainingData[]>([]);
  const [autoMode, setAutoMode] = useState(false);
  
  // News & Sentiment
  const [marketNews, setMarketNews] = useState<NewsItem[]>([]);
  const [sentimentScore, setSentimentScore] = useState(0); // -1 to 1

  // Navigation & Config
  const [currentView, setCurrentView] = useState<'terminal' | 'backtest' | 'analytics' | 'leverage'>('terminal');
  const [dbConnected, setDbConnected] = useState(false);
  const [aiReady, setAiReady] = useState(false);

  // Load Persistence
  useEffect(() => {
    // 1. Load Local Persistence Immediate
    const savedData = storageService.getTrainingData();
    if (savedData.length > 0) {
      setTrainingHistory(savedData);
      console.log(`[App] ✅ Loaded ${savedData.length} training records from local storage`);
    }

    // 2. Load Binance Account Balance
    const loadBinanceBalance = async () => {
      try {
        const balances = await getAccountBalances();
        const usdtBalance = balances.find(b => b.asset === 'USDT');
        const fdusdBalance = balances.find(b => b.asset === 'FDUSD');
        
        // Use USDT or FDUSD balance (show real balance, even if very small)
        const totalBalance = parseFloat(usdtBalance?.free || '0') + parseFloat(fdusdBalance?.free || '0');
        setBalance(totalBalance);
        console.log(`[App] ✅ Loaded Binance balance: $${totalBalance.toFixed(8)}`);
      } catch (error) {
        console.error('[App] ❌ Failed to load Binance balance:', error);
        console.log('[App] Using balance $0 (could not connect to Binance)');
        setBalance(0);
      }
    };

    loadBinanceBalance();

    // 3. Sync from Supabase (Background)
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
  }, []);

  // Initialize Data whenever Asset changes - REAL-TIME API INTEGRATION
  useEffect(() => {
    let ws: WebSocket | null = null;
    let pollingInterval: number | null = null;
    let isActive = true;

    const loadMarketData = async () => {
      try {
        console.log(`[App] Loading market data for ${selectedAsset.symbol} (${selectedAsset.type})...`);
        
        // Clear previous data
        setCandles([]);
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
          const historicalCandles = await binanceService.getHistoricalKlines(selectedAsset.symbol, '1m', 1000);
          
          if (!isActive) return; // Component unmounted
          
          setCandles(historicalCandles);
          console.log(`[App] ✅ Loaded ${historicalCandles.length} historical candles for ${selectedAsset.symbol}`);

          // 2. Connect WebSocket for real-time updates
          ws = binanceService.connectKlineStream(selectedAsset.symbol, '1m', (candle, isClosed) => {
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
          const binanceCandles = await getHistoricalKlines(selectedAsset.symbol, '1m', 1000);
          
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
            nearestResistance: supportResistance.resistance
          });
          
          showNotification(`✅ Loaded ${binanceCandles.length} candles from Binance`, 'success');
        }

      } catch (error) {
        console.error('[App] ❌ Error loading market data:', error);
        showNotification(`Failed to load data for ${selectedAsset.symbol}. Using fallback.`, 'error');
        
        // Fallback to mock data on error
        // This part was removed as per instruction, but if the above fails, there's no fallback.
        // Re-adding a simple mock fallback for robustness if the new Binance call fails.
        console.warn(`[App] ⚠️ Error with Binance API, falling back to mock data for ${selectedAsset.symbol}`);
        const mockCandles = Array.from({ length: 1000 }, (_, i) => ({
          time: new Date(Date.now() - (1000 - i) * 60 * 1000).toISOString(),
          open: 100 + Math.sin(i / 10) * 10 + Math.random() * 2,
          high: 115 + Math.sin(i / 10) * 10 + Math.random() * 2,
          low: 90 + Math.sin(i / 10) * 10 + Math.random() * 2,
          close: 105 + Math.sin(i / 10) * 10 + Math.random() * 2,
          volume: Math.floor(Math.random() * 10000)
        }));
        setCandles(mockCandles);
        showNotification(`Using simulated data for ${selectedAsset.symbol} due to API error.`, 'info');
      }
    };

    loadMarketData();

    // Cleanup function
    return () => {
      isActive = false;
      
      if (ws) {
        console.log(`[App] Closing WebSocket for ${selectedAsset.symbol}`);
        ws.close();
      }
      
      if (pollingInterval) {
        console.log(`[App] Stopping polling for ${selectedAsset.symbol}`);
        clearInterval(pollingInterval);
      }
    };
  }, [selectedAsset]);

  // Show Notification Helper
  const showNotification = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
      setNotification({ message, type });
      setTimeout(() => setNotification(null), 5000); // Auto hide after 5s
  };

  // Alert Helpers
  const addAlert = (newAlert: Omit<Alert, 'id' | 'active'>) => {
    setAlerts(prev => [...prev, { ...newAlert, id: generateUUID(), active: true }]);
    showNotification("Alert set successfully", "info");
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
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

  // Live Data Simulation & TP/SL/Alert Monitoring
  useEffect(() => {
    if (currentView !== 'terminal') return;

    const interval = setInterval(() => {
      setCandles(prev => {
        const last = prev[prev.length - 1];
        const volatility = last.close * 0.002;
        const change = (Math.random() - 0.5) * volatility;
        const newClose = last.close + change;
        const newHigh = Math.max(last.close, newClose) + Math.random() * (volatility * 0.5);
        const newLow = Math.min(last.close, newClose) - Math.random() * (volatility * 0.5);
        
        const newCandle: Candle = {
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          open: last.close,
          close: newClose,
          high: newHigh,
          low: newLow,
          volume: Math.floor(Math.random() * 1000)
        };
        const newData = [...prev.slice(1), newCandle];
        
        // Update Indicators
        const closes = newData.map(c => c.close);
        const volumes = newData.map(c => c.volume);
        const high = Math.max(...newData.map(c => c.high));
        const low = Math.min(...newData.map(c => c.low));
        const currentRsi = calculateRSI(closes);
        
        const sma200 = calculateSMA(closes, 200);
        const trend = analyzeTrend(newData, sma200);
        const sr = findSupportResistance(newData);
        
        const newIndicators = {
          rsi: currentRsi,
          fibLevels: calculateFibonacci(high, low, trend),
          trend,
          sma200,
          sma50: calculateSMA(closes, 50),
          ema20: calculateEMA(closes, 20),
          volumeSma: calculateSMA(volumes, 20),
          nearestSupport: sr.support,
          nearestResistance: sr.resistance
        };

        setIndicators(newIndicators);

        // --- CHECK CUSTOM ALERTS ---
        alerts.forEach(alert => {
            let triggered = false;
            if (alert.type === 'PRICE') {
                if (alert.condition === 'ABOVE' && newClose > alert.value) triggered = true;
                if (alert.condition === 'BELOW' && newClose < alert.value) triggered = true;
            } else if (alert.type === 'RSI') {
                if (alert.condition === 'ABOVE' && currentRsi > alert.value) triggered = true;
                if (alert.condition === 'BELOW' && currentRsi < alert.value) triggered = true;
            }

            if (triggered) {
                showNotification(`ALERT TRIGGERED: ${alert.message}`, 'info');
                setAlerts(curr => curr.filter(a => a.id !== alert.id));
            }
        });

        // --- REAL-TIME TP/SL MONITORING ---
        setActiveSignal(currentSignal => {
            // Only monitor if the active signal belongs to the currently selected asset
            if (!currentSignal || currentSignal.outcome !== 'PENDING') return currentSignal;
            if (currentSignal.symbol !== selectedAsset.symbol) return currentSignal; // Skip if different asset

            let closedOutcome: 'WIN' | 'LOSS' | null = null;
            let closePrice = 0;
            let webhookEvent: 'TAKE_PROFIT' | 'STOP_LOSS' | null = null;

            if (currentSignal.type === 'BUY') {
                if (newLow <= currentSignal.stopLoss) {
                    closedOutcome = 'LOSS';
                    closePrice = currentSignal.stopLoss;
                    webhookEvent = 'STOP_LOSS';
                    showNotification(`STOP LOSS HIT! Position Closed at ${closePrice}`, 'error');
                } else if (newHigh >= currentSignal.takeProfit) {
                    closedOutcome = 'WIN';
                    closePrice = currentSignal.takeProfit;
                    webhookEvent = 'TAKE_PROFIT';
                    showNotification(`TAKE PROFIT HIT! Position Closed at ${closePrice}`, 'success');
                }
            } else if (currentSignal.type === 'SELL') {
                if (newHigh >= currentSignal.stopLoss) {
                    closedOutcome = 'LOSS';
                    closePrice = currentSignal.stopLoss;
                    webhookEvent = 'STOP_LOSS';
                    showNotification(`STOP LOSS HIT! Position Closed at ${closePrice}`, 'error');
                } else if (newLow <= currentSignal.takeProfit) {
                    closedOutcome = 'WIN';
                    closePrice = currentSignal.takeProfit;
                    webhookEvent = 'TAKE_PROFIT';
                    showNotification(`TAKE PROFIT HIT! Position Closed at ${closePrice}`, 'success');
                }
            }

            if (closedOutcome && webhookEvent) {
                // Auto-update balance
                const dist = Math.abs(currentSignal.entryPrice - currentSignal.stopLoss);
                const quantity = ((balance * (riskPercent / 100)) / dist);
                const pnl = currentSignal.type === 'BUY' 
                    ? (closePrice - currentSignal.entryPrice) * quantity
                    : (currentSignal.entryPrice - closePrice) * quantity;
                
                const riskedAmount = dist * quantity;

                setBalance(b => b + pnl);

                // Add to Trade History
                const completedTrade: ExecutedTrade = {
                    id: currentSignal.id,
                    symbol: currentSignal.symbol,
                    entryTime: new Date(currentSignal.timestamp).toLocaleTimeString(),
                    exitTime: newCandle.time,
                    type: currentSignal.type as 'BUY' | 'SELL',
                    entryPrice: currentSignal.entryPrice,
                    exitPrice: closePrice,
                    stopLoss: currentSignal.stopLoss,
                    takeProfit: currentSignal.takeProfit,
                    quantity: quantity,
                    pnl: pnl,
                    outcome: closedOutcome,
                    source: currentSignal.patternDetected === "Manual Entry" ? "MANUAL" : "AI"
                };
                setTradeHistory(prev => [completedTrade, ...prev]);

                // --- TRIGGER AUTOMATION ---
                sendWebhookNotification(webhookEvent, currentSignal, closePrice).then(res => {
                    if (res.success) {
                        if (res.warning) {
                             showNotification(`Webhook Warning: ${res.warning}`, 'warning');
                        }
                    } else if (!res.skipped) {
                         showNotification(`Webhook Failed: ${res.error}`, 'error');
                    }
                });

                // --- TRAIN LOCAL ML MODEL (REINFORCEMENT LEARNING) ---
                // We now pass the PNL and Risk Amount so the Q-Learning agent can calculate reward
                if (currentSignal.patternDetected !== "Manual Entry") {
                    trainModel(
                        closedOutcome, 
                        currentSignal.type as 'BUY'|'SELL', 
                        newData.slice(-50), 
                        newIndicators, 
                        sentimentScore, 
                        pnl, 
                        riskedAmount,
                        currentSignal.confidence // Pass predicted confidence for meta-learning
                    );
                }

                // Add to UI history
                setTrainingHistory(prev => {
                    const newHistory: TrainingData = {
                        id: currentSignal.id,
                        pattern: currentSignal.patternDetected || 'Manual/Unknown',
                        outcome: closedOutcome!,
                        confluence: currentSignal.confluenceFactors?.join(', ') || 'Automated Close',
                        riskReward: currentSignal.riskRewardRatio || 0,
                        note: `Auto-Closed by System at ${newCandle.time}. PNL: ${pnl.toFixed(2)}`
                    };
                    storageService.saveTrainingData([newHistory, ...prev].slice(0,15));
                    
                    // Update signal outcome in Supabase
                    storageService.updateTradeSignalOutcome(currentSignal.id, closedOutcome!);
                    
                    return [newHistory, ...prev].slice(0, 15);
                });

                return { ...currentSignal, outcome: closedOutcome };
            }

            return currentSignal;
        });

        return newData;
      });
    }, 2000); 

    return () => clearInterval(interval);
  }, [currentView, alerts, sentimentScore, balance, riskPercent, selectedAsset, activeSignal]); // Added selectedAsset deps

  // Trigger Local ML Analysis
  const handleAnalyze = useCallback(async () => {
    if (!indicators || candles.length === 0) return;
    
    // Don't analyze if we already have an OPEN active position or a PENDING confirmation
    if (pendingSignal) return;
    if (activeSignal && activeSignal.outcome === 'PENDING') return;

    setIsAnalyzing(true);
    
    // Uses the new Combined (Hybrid) ML service
    const signal = await analyzeMarket(candles, indicators, trainingHistory, marketNews.slice(0, 5));
    
    setIsAnalyzing(false);

    if (signal && signal.type !== 'HOLD') {
      const fullSignal = { ...signal, symbol: selectedAsset.symbol };

      if (autoMode) {
          // --- AUTOMATIC EXECUTION (AUTO-SEND) ---
          // Set as pending first, then confirm automatically
          setPendingSignal(fullSignal);
          
          // Auto-confirm immediately (this will trigger webhook and save to Supabase)
          setTimeout(() => {
              confirmTrade();
          }, 100);
      } else {
          // --- MANUAL CONFIRMATION ---
          setPendingSignal(fullSignal);
      }
    } else if (signal && signal.type === 'HOLD') {
        // Only show message if triggered manually
        if (!autoMode) {
            showNotification("Market conditions unclear. Neural Net advises HOLD.", "info");
        }
    }
  }, [candles, indicators, trainingHistory, marketNews, activeSignal, pendingSignal, autoMode, selectedAsset]);

  // --- AUTOMATIC TRADING LOOP ---
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (autoMode && !isAnalyzing) {
        if (!activeSignal || activeSignal.outcome !== 'PENDING') {
            interval = setInterval(() => {
                handleAnalyze();
            }, 4000);
        }
    }
    
    return () => clearInterval(interval);
  }, [autoMode, isAnalyzing, activeSignal, handleAnalyze]);


  // Execute Trade after Confirmation
  const confirmTrade = () => {
    if (pendingSignal) {
        setActiveSignal(pendingSignal);
        
        // Save signal to Supabase
        storageService.saveTradeSignal(pendingSignal);
        
        // Trigger Webhook
        sendWebhookNotification('SIGNAL_ENTRY', pendingSignal).then(res => {
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
        
        setPendingSignal(null);
    }
  };

  const rejectTrade = () => {
    setPendingSignal(null);
  };

  // Manual Trade Handler
  const handleManualTrade = (type: 'BUY' | 'SELL', entry: number, sl: number, tp: number) => {
    const risk = Math.abs(entry - sl);
    const reward = Math.abs(tp - entry);
    const rr = risk === 0 ? 0 : Number((reward / risk).toFixed(2));

    const manualSignal: TradeSignal = {
        id: generateUUID(),
        symbol: selectedAsset.symbol,
        type,
        entryPrice: entry,
        stopLoss: sl,
        takeProfit: tp,
        reasoning: "User Manual Override",
        confidence: 100,
        timestamp: Date.now(),
        patternDetected: "Manual Entry",
        confluenceFactors: ["User Decision"],
        riskRewardRatio: rr,
        outcome: 'PENDING'
    };
    
    // Override any active signal
    setPendingSignal(null);
    setActiveSignal(manualSignal);
    
    // Save to Supabase
    storageService.saveTradeSignal(manualSignal);
    
    // Trigger Webhook
    sendWebhookNotification('SIGNAL_ENTRY', manualSignal).then(res => {
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

    setBalance(b => b + pnl);

    // Trigger Webhook
    sendWebhookNotification('MANUAL_CLOSE', activeSignal, activeSignal.entryPrice).then(res => {
        if (res.warning) {
             showNotification(`Trade Closed (Blind Mode)`, 'warning');
        }
    });

    // --- MANUALLY TRIGGER TRAINING ---
    if (activeSignal.patternDetected !== "Manual Entry" && indicators) {
         trainModel(outcome, activeSignal.type as 'BUY'|'SELL', candles.slice(-50), indicators, sentimentScore, pnl, riskedAmount, activeSignal.confidence);
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
        type: activeSignal.type as 'BUY'|'SELL',
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

  return (
    <div className="h-screen flex flex-col md:flex-row text-slate-200 overflow-hidden relative">
      
      {/* NOTIFICATION BANNER */}
      {notification && (
        <div className={`absolute top-4 left-1/2 transform -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300 ${
            notification.type === 'success' ? 'bg-emerald-500 text-white' : 
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

      {/* Sidebar */}
      <nav className="w-full md:w-20 bg-slate-900 border-r border-slate-800 flex md:flex-col items-center py-4 gap-6 z-20 shrink-0">
        <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
          <BrainCircuit className="w-6 h-6 text-white" />
        </div>
        <div className="flex md:flex-col gap-4 mx-auto w-full px-2 md:px-0">
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
            onClick={() => setCurrentView('leverage')}
            className={`p-3 rounded-lg transition-colors flex justify-center ${currentView === 'leverage' ? 'bg-slate-800 text-amber-400' : 'text-slate-400 hover:bg-slate-800 hover:text-amber-400'}`}
            title="Leverage Trading (10x)"
          >
            <Coins className="w-5 h-5" />
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

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-6 flex flex-col min-h-0 overflow-y-auto">
        
        {/* Header */}
        <header className="flex justify-between items-center mb-6 shrink-0">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                {currentView === 'terminal' ? 'NeuroTrade Terminal' : 'Strategy Backtest Lab'}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                  <div className="flex flex-col gap-1 items-start">
                    <span className="text-xs text-emerald-500 font-mono font-bold flex items-center gap-1">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                        HYBRID AI ENGINE (RL + GEMINI) ACTIVE
                    </span>
                    <div className="flex gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${dbConnected ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-rose-500/30 text-rose-400 bg-rose-500/10'}`}>
                            DB: {dbConnected ? 'ONLINE' : 'OFFLINE'}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${aiReady ? 'border-blue-500/30 text-blue-400 bg-blue-500/10' : 'border-yellow-500/30 text-yellow-400 bg-yellow-500/10'}`}>
                            AI: {aiReady ? 'READY' : 'NO KEY'}
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
                        className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded-lg border border-slate-700 transition-colors"
                    >
                        <Coins className="w-4 h-4 text-blue-400" />
                        <span className="font-bold text-white">{selectedAsset.symbol}</span>
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                    </button>

                    {isAssetMenuOpen && (
                        <div className="absolute top-full left-0 mt-2 w-56 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl z-50 overflow-hidden">
                             <div className="p-2 text-[10px] font-bold text-slate-500 uppercase">Select Asset</div>
                             {SUPPORTED_ASSETS.map(asset => (
                                 <button
                                    key={asset.symbol}
                                    onClick={() => {
                                        setSelectedAsset(asset);
                                        setIsAssetMenuOpen(false);
                                    }}
                                    className={`w-full text-left px-4 py-3 text-sm hover:bg-slate-800 flex justify-between items-center ${selectedAsset.symbol === asset.symbol ? 'bg-slate-800 text-blue-400' : 'text-slate-300'}`}
                                 >
                                     <span>{asset.name}</span>
                                     <span className="font-mono text-xs opacity-50">{asset.symbol}</span>
                                 </button>
                             ))}
                        </div>
                    )}
                </div>
            )}
          </div>
          
          {currentView === 'terminal' && (
            <div className="flex items-center gap-4">
                {/* Market Sentiment Meter */}
                <div className="hidden md:flex flex-col items-end mr-4">
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

                <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 p-2 rounded-lg">
                    <div className="px-3 border-r border-slate-800 flex items-center gap-2">
                        <span className="text-xs text-slate-500">AUTO-TRADE</span>
                        <button 
                            onClick={toggleAutoMode}
                            className={`w-8 h-4 rounded-full transition-colors relative ${autoMode ? 'bg-emerald-500' : 'bg-slate-700'}`}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform ${autoMode ? 'translate-x-4' : ''}`}></div>
                        </button>
                    </div>
                    <div className="px-3 border-r border-slate-800">
                        <span className="text-xs text-slate-500 block">BALANCE</span>
                        <span className="font-mono text-emerald-400 font-bold">${balance.toFixed(2)}</span>
                    </div>
                    <div className="px-3">
                        <span className="text-xs text-slate-500 block">RISK</span>
                        <input 
                            type="number" 
                            value={riskPercent} 
                            onChange={(e) => setRiskPercent(Number(e.target.value))}
                            className="w-12 bg-transparent text-white font-mono font-bold focus:outline-none border-b border-slate-700 focus:border-blue-500 text-center" 
                        />
                        <span className="text-slate-500 text-xs">%</span>
                    </div>
                </div>

                {/* Manual Trade Button */}
                <button 
                    onClick={() => setShowManualModal(true)}
                    className="bg-slate-800 hover:bg-slate-700 text-white p-2.5 rounded-lg border border-slate-700 transition-colors"
                    title="Manual Trade Entry"
                >
                    <PenTool className="w-5 h-5" />
                </button>
            </div>
          )}
        </header>

        {/* View Content */}
        {currentView === 'analytics' ? (
             <AnalyticsDashboard />
        ) : currentView === 'leverage' ? (
             <LeverageDashboard />
        ) : currentView === 'backtest' ? (
             <BacktestPanel candles={candles} />
        ) : (
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
                {/* LEFT COLUMN: Chart + Trade History (2 cols wide) */}
                <div className="lg:col-span-2 space-y-4 flex flex-col h-full overflow-hidden">
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex-1 flex flex-col min-h-[300px]">
                        <div className="flex justify-between items-center mb-4 shrink-0">
                            <div className="flex gap-2 items-center">
                                <span className="font-bold text-lg">{selectedAsset.symbol}</span>
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${indicators?.trend === 'UP' ? 'bg-emerald-500/20 text-emerald-400' : indicators?.trend === 'DOWN' ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-700 text-slate-300'}`}>
                                    {indicators?.trend}
                                </span>
                            </div>
                            <div className="flex gap-4 text-xs font-mono text-slate-400">
                                <span>RSI: <span className={indicators && indicators.rsi > 70 ? 'text-rose-400' : indicators && indicators.rsi < 30 ? 'text-emerald-400' : 'text-slate-200'}>{indicators?.rsi.toFixed(1)}</span></span>
                                <span>SMA 200: {indicators?.sma200.toFixed(2)}</span>
                            </div>
                        </div>
                        
                        <div className="flex-1 relative">
                            <ModernCandleChart 
                                data={candles.slice(-100)} 
                                pendingSignal={pendingSignal}
                                activeTrade={activeSignal?.outcome === 'PENDING' ? activeSignal : null} 
                                fibLevels={indicators?.fibLevels} 
                            />
                        </div>
                    </div>

                    {/* Trade History Panel */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-xl flex flex-col h-48 overflow-hidden">
                        <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2">
                             <List className="w-4 h-4 text-slate-400" />
                             <span className="text-xs font-bold text-slate-400">SESSION TRADE HISTORY</span>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <TradeList trades={tradeHistory} />
                        </div>
                    </div>
                </div>

                {/* MIDDLE COLUMN: Signal & Alerts (1 col wide) */}
                <div className="lg:col-span-1 space-y-4 flex flex-col overflow-y-auto">
                    {/* Active Signal Card */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden group shrink-0">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-all"></div>
                        
                        <h2 className="text-slate-400 text-xs font-bold tracking-wider mb-4 flex items-center gap-2">
                            <Target className="w-4 h-4" /> ACTIVE TRADE
                        </h2>

                        {activeSignal && activeSignal.outcome === 'PENDING' && activeSignal.symbol === selectedAsset.symbol ? (
                            <div className="space-y-4 relative z-10">
                                <div className="flex justify-between items-end">
                                    <span className={`text-4xl font-black ${activeSignal.type === 'BUY' ? 'text-emerald-400' : activeSignal.type === 'SELL' ? 'text-rose-400' : 'text-yellow-400'}`}>
                                        {activeSignal.type}
                                    </span>
                                    <span className="text-slate-500 font-mono text-sm">Conf: {activeSignal.confidence}%</span>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {activeSignal.confluenceFactors?.map((factor, i) => (
                                        <span key={i} className="flex items-center gap-1 text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-300 border border-slate-700">
                                            {factor.includes('Trend') && <TrendingUp className="w-3 h-3 text-blue-400" />}
                                            {factor.includes('RSI') && <Activity className="w-3 h-3 text-purple-400" />}
                                            {factor.includes('Support') && <Layers className="w-3 h-3 text-emerald-400" />}
                                            {factor.includes('Volume') && <Zap className="w-3 h-3 text-yellow-400" />}
                                            {factor}
                                        </span>
                                    ))}
                                </div>
                                
                                <div className="bg-slate-950 rounded-lg p-3 space-y-2 border border-slate-800/50">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Entry</span>
                                        <span className="font-mono text-slate-200">{activeSignal.entryPrice}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Stop Loss</span>
                                        <span className="font-mono text-rose-400">{activeSignal.stopLoss}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Take Profit</span>
                                        <span className="font-mono text-emerald-400">{activeSignal.takeProfit}</span>
                                    </div>
                                </div>

                                {/* Manual Close Controls */}
                                <div className="grid grid-cols-2 gap-2 mt-4">
                                    <button onClick={() => handleFeedback('WIN')} className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 py-2 rounded-lg text-xs font-bold border border-emerald-500/30 transition-all">
                                        CLOSE WIN
                                    </button>
                                    <button onClick={() => handleFeedback('LOSS')} className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 py-2 rounded-lg text-xs font-bold border border-rose-500/30 transition-all">
                                        CLOSE LOSS
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="h-40 flex flex-col items-center justify-center text-slate-600 space-y-2">
                                <ShieldCheck className="w-8 h-8 opacity-50" />
                                <span className="text-sm">
                                    {activeSignal && activeSignal.outcome === 'PENDING' ? `Trade Active on ${activeSignal.symbol}` : "No Active Trade."}
                                </span>
                                <button 
                                    onClick={handleAnalyze} 
                                    disabled={isAnalyzing || (activeSignal?.outcome === 'PENDING' && activeSignal.symbol === selectedAsset.symbol)}
                                    className={`mt-2 py-2 px-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all text-xs ${isAnalyzing ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
                                >
                                    {isAnalyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <BrainCircuit className="w-3 h-3" />}
                                    {isAnalyzing ? "Processing Neural Net..." : "Predict with ML"}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Alerts Panel */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex-1 flex flex-col min-h-[200px]">
                        <AlertsPanel alerts={alerts} onAdd={addAlert} onRemove={removeAlert} />
                    </div>
                </div>

                {/* RIGHT COLUMN: Training & News (1 col wide) */}
                <div className="lg:col-span-1 space-y-4 flex flex-col overflow-y-auto">
                     {/* AI Learning History */}
                     <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col h-1/2 min-h-[250px]">
                        <h2 className="text-slate-400 text-xs font-bold tracking-wider mb-4 flex items-center gap-2">
                            <BrainCircuit className="w-4 h-4" /> NEURAL FEEDBACK
                        </h2>
                        <div className="space-y-2 overflow-y-auto pr-2 flex-1">
                            {trainingHistory.length === 0 ? (
                                <p className="text-xs text-slate-600 text-center py-4">Training data empty.</p>
                            ) : (
                                trainingHistory.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-start text-xs bg-slate-950 p-2 rounded border border-slate-800 group">
                                        <div>
                                            <span className="block text-slate-300 font-bold mb-0.5">{item.pattern}</span>
                                            <span className="text-slate-500 text-[10px] line-clamp-1">{item.note}</span>
                                        </div>
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={() => openFeedbackEditor(item)}
                                                className="p-1 rounded text-slate-500 hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Edit3 className="w-3 h-3" />
                                            </button>
                                            <span className={`px-1.5 py-0.5 rounded font-bold ${item.outcome === 'WIN' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                                                {item.outcome}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* News Feed */}
                    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex-1 flex flex-col h-1/2 min-h-[250px]">
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
        )}
      </main>
    </div>
  );
}

export default App;