
import { TrainingData, BacktestConfig, AppSettings } from '../types';
import { supabase } from './supabaseClient';
import { isValidUUID } from '../utils/uuid';

const TRAINING_STORAGE_KEY = 'neurotrade_training_data';
const CONFIG_STORAGE_KEY = 'neurotrade_backtest_configs';
const MODEL_WEIGHTS_KEY = 'neurotrade_ml_weights';
const SETTINGS_STORAGE_KEY = 'neurotrade_settings';
const AUTO_TRADE_KEY = 'neurotrade_auto_mode';
const BALANCE_STORAGE_KEY = 'neurotrade_balance';
const LEVERAGE_STORAGE_KEY = 'neurotrade_leverage';
const TRADING_MODE_STORAGE_KEY = 'neurotrade_trading_mode';
const LAST_ANALYSIS_STORAGE_KEY = 'neurotrade_last_analysis';

export const storageService = {
  // --- Training Data ---
  getTrainingData: (): TrainingData[] => {
    try {
      const data = localStorage.getItem(TRAINING_STORAGE_KEY);
      if (!data) return [];

      const parsed = JSON.parse(data);

      // Filter out old data with invalid UUID format
      const validData = parsed.filter((item: TrainingData) => {
        if (!item.id || !isValidUUID(item.id)) {
          console.warn(`[Storage] Removing old training data with invalid UUID: ${item.id}`);
          return false;
        }
        return true;
      });

      // Save cleaned data back to localStorage
      if (validData.length !== parsed.length) {
        localStorage.setItem(TRAINING_STORAGE_KEY, JSON.stringify(validData));
        console.log(`[Storage] ✅ Cleaned ${parsed.length - validData.length} old training data entries`);
      }

      return validData;
    } catch (e) {
      console.error("Failed to load training data from storage", e);
      return [];
    }
  },

  // Async fetch from Supabase to sync/refresh
  fetchTrainingDataFromSupabase: async (): Promise<TrainingData[]> => {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('training_data')
      .select('*')
      .order('created_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      console.error("Supabase fetch error:", error);
      return [];
    }

    // Update local cache
    if (data && data.length > 0) {
      localStorage.setItem(TRAINING_STORAGE_KEY, JSON.stringify(data));
    }
    return data as TrainingData[] || [];
  },

  saveTrainingData: async (data: TrainingData[]) => {
    try {
      console.log('[Storage] Saving training data...', { count: data.length, data });

      // 1. Save Local
      localStorage.setItem(TRAINING_STORAGE_KEY, JSON.stringify(data));
      console.log('[Storage] ✅ Saved to localStorage');

      // 2. Save to Supabase
      if (supabase) {
        // Deduplicate by ID to prevent constraint violations
        const uniqueData = Array.from(
          new Map(data.map(item => [item.id, item])).values()
        );

        const supabaseData = uniqueData.map(item => ({
          id: item.id,
          pattern: item.pattern,
          outcome: item.outcome,
          confluence: item.confluence,
          risk_reward: item.riskReward, // Map to snake_case
          note: item.note
        }));

        console.log('[Supabase] Upserting training data...', { count: supabaseData.length, deduplicated: data.length - uniqueData.length });

        // Upsert one at a time to avoid "cannot affect row a second time" error
        for (const item of supabaseData) {
          const { error } = await supabase
            .from('training_data')
            .upsert(item, { onConflict: 'id' });

          if (error) {
            console.error(`[Supabase] ❌ Training data save error for ID ${item.id}:`, error);
          }
        }

        console.log('[Supabase] ✅ Training data synced successfully!', { count: supabaseData.length });
      } else {
        console.warn('[Supabase] ⚠️ Supabase client not initialized');
      }
    } catch (e) {
      console.error("❌ Failed to save training data:", e);
    }
  },

  // --- Trade Signals (NEW) ---
  saveTradeSignal: async (signal: any) => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('trade_signals')
        .insert({
          id: signal.id,
          symbol: signal.symbol,
          type: signal.type,
          entry_price: signal.entryPrice,
          stop_loss: signal.stopLoss,
          take_profit: signal.takeProfit,
          confidence: signal.confidence,
          reasoning: signal.reasoning,
          source: signal.patternDetected?.includes('Gemini') ? 'GEMINI' : signal.patternDetected?.includes('Manual') ? 'MANUAL' : 'AI',
          outcome: signal.outcome || 'PENDING'
        });

      if (error) console.error('[Supabase] Signal save error:', error);
      else console.log('[Supabase] Signal saved ✅', signal.symbol, signal.type);
    } catch (e) {
      console.error('[Supabase] Signal save failed:', e);
    }
  },

  updateTradeSignalOutcome: async (signalId: string, outcome: 'WIN' | 'LOSS' | 'CANCELLED') => {
    if (!supabase) return;

    try {
      const { error } = await supabase
        .from('trade_signals')
        .update({ outcome })
        .eq('id', signalId);

      if (error) console.error('[Supabase] Signal update error:', error);
      else console.log('[Supabase] Signal outcome updated:', signalId, outcome);
    } catch (e) {
      console.error('[Supabase] Signal update failed:', e);
    }
  },

  // Fetch activity logs from Supabase
  fetchActivityLogs: async (limit: number = 100): Promise<any[]> => {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[Supabase] Activity logs fetch error:', error);
        return [];
      }

      console.log(`[Supabase] ✅ Fetched ${data?.length || 0} activity logs`);
      return data || [];
    } catch (e) {
      console.error('[Supabase] Activity logs fetch failed:', e);
      return [];
    }
  },

  clearData: () => {
    localStorage.removeItem(TRAINING_STORAGE_KEY);
    localStorage.removeItem(MODEL_WEIGHTS_KEY);
  },

  // --- Machine Learning Model ---
  getModelWeights: (): any => {
    try {
      const data = localStorage.getItem(MODEL_WEIGHTS_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error("Failed to load ML model", e);
      return null;
    }
  },

  saveModelWeights: async (weights: any) => {
    try {
      localStorage.setItem(MODEL_WEIGHTS_KEY, JSON.stringify(weights));

      if (supabase) {
        const { error } = await supabase.from('model_storage').upsert({
          id: 'main_dqn_model',
          weights_ih: weights.weightsIH,
          weights_ho: weights.weightsHO,
          bias_h: weights.biasH,
          bias_o: weights.biasO,
          metadata: { updated: new Date().toISOString() }
        });

        if (error) console.error("Supabase model save error:", error);
      }
    } catch (e) {
      console.error("Failed to save ML model", e);
    }
  },

  // --- Pattern Memory Persistence ---
  savePatternMemory: async (memory: any[]) => {
    try {
      localStorage.setItem('neurotrade_pattern_memory', JSON.stringify(memory));

      if (supabase) {
        const { error } = await supabase.from('model_storage').upsert({
          id: 'pattern_memory',
          metadata: { memory: memory, updated: new Date().toISOString() }
        });

        if (error) console.error("Supabase memory save error:", error);
      }
    } catch (e) {
      console.error("Failed to save pattern memory", e);
    }
  },

  getPatternMemory: async (): Promise<any[] | null> => {
    try {
      // Try Supabase first for sync
      if (supabase) {
        const { data, error } = await supabase
          .from('model_storage')
          .select('*')
          .eq('id', 'pattern_memory')
          .maybeSingle();

        if (data && data.metadata && data.metadata.memory) {
          // Update local
          localStorage.setItem('neurotrade_pattern_memory', JSON.stringify(data.metadata.memory));
          return data.metadata.memory;
        }
      }

      // Fallback to local
      const data = localStorage.getItem('neurotrade_pattern_memory');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error("Failed to load pattern memory", e);
      return null;
    }
  },

  fetchModelWeightsFromSupabase: async () => {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('model_storage')
        .select('*')
        .eq('id', 'main_dqn_model')
        .maybeSingle(); // Use maybeSingle instead of single to avoid error if no rows

      if (error) {
        // 406 or PGRST116 means no rows found, which is OK for first run
        if (error.code === 'PGRST116' || error.message.includes('406')) {
          console.log('[Supabase] No model weights found in cloud (first run). Using local.');
          return null;
        }
        console.error('[Supabase] Model fetch error:', error);
        return null;
      }

      if (data) {
        const weights = {
          weightsIH: data.weights_ih,
          weightsHO: data.weights_ho,
          biasH: data.bias_h,
          biasO: data.bias_o
        };
        localStorage.setItem(MODEL_WEIGHTS_KEY, JSON.stringify(weights));
        return weights;
      }
      return null;
    } catch (err) {
      console.error('[Supabase] Unexpected error fetching model:', err);
      return null;
    }
  },

  // --- Backtest Configurations ---
  getBacktestConfigs: (): BacktestConfig[] => {
    try {
      const data = localStorage.getItem(CONFIG_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Failed to load backtest configs", e);
      return [];
    }
  },

  saveBacktestConfig: (config: BacktestConfig) => {
    try {
      const existing = storageService.getBacktestConfigs();
      const filtered = existing.filter(c => c.id !== config.id);
      const updated = [...filtered, config];
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save backtest config", e);
    }
  },

  deleteBacktestConfig: (id: string) => {
    try {
      const existing = storageService.getBacktestConfigs();
      const updated = existing.filter(c => c.id !== id);
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to delete backtest config", e);
    }
  },

  // --- App Settings (Webhooks) ---
  getSettings: (): AppSettings => {
    const defaultUrl = 'https://weka.app.n8n.cloud/webhook/trading-webhook';

    try {
      const data = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        const urlToUse = (parsed.webhookUrl && parsed.webhookUrl.trim() !== '')
          ? parsed.webhookUrl
          : defaultUrl;

        return {
          webhookUrl: urlToUse,
          webhookMethod: parsed.webhookMethod || 'POST',
          enableNotifications: parsed.enableNotifications ?? false,
          useTestnet: parsed.useTestnet ?? false,
          autoSLTP: parsed.autoSLTP ?? true
        };
      }
      return { webhookUrl: defaultUrl, webhookMethod: 'POST', enableNotifications: false, useTestnet: false, autoSLTP: true };
    } catch (e) {
      return { webhookUrl: defaultUrl, webhookMethod: 'POST', enableNotifications: false, useTestnet: false, autoSLTP: true };
    }
  },

  // --- Balance Persistence ---
  saveBalance: (balance: number) => {
    localStorage.setItem(BALANCE_STORAGE_KEY, balance.toString());
  },

  getBalance: (): number | null => {
    const saved = localStorage.getItem(BALANCE_STORAGE_KEY);
    return saved ? parseFloat(saved) : null;
  },

  saveSettings: async (settings: AppSettings) => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));

    // Sync to Supabase
    if (supabase) {
      try {
        const { error } = await supabase
          .from('app_settings')
          .upsert({
            id: 'main_settings', // Single row for app settings
            // Don't store webhook URL in DB for security
            risk_tolerance: 1.0, // TODO: Add to AppSettings type
            auto_trade_enabled: false // TODO: Add to AppSettings type
          });

        if (error) console.error('[Supabase] Settings save error:', error);
      } catch (e) {
        console.error('[Supabase] Settings save failed:', e);
      }
    }
  },

  // --- Auto Trade State ---
  getAutoTradeState: (): boolean => {
    try {
      return localStorage.getItem(AUTO_TRADE_KEY) === 'true';
    } catch {
      return false;
    }
  },

  saveAutoTradeState: async (enabled: boolean) => {
    localStorage.setItem(AUTO_TRADE_KEY, String(enabled));

    // Sync to Supabase
    if (supabase) {
      try {
        const { error } = await supabase
          .from('app_settings')
          .upsert({
            id: 'main_settings',
            auto_trade_enabled: enabled
          });

    if (error) console.error('[Supabase] Auto-trade state save error:', error);
      } catch (e) {
        console.error('[Supabase] Auto-trade state save failed:', e);
      }
    }
  },

  // --- Leverage Persistence ---
  saveLeverage: (leverage: number) => {
    localStorage.setItem(LEVERAGE_STORAGE_KEY, leverage.toString());
  },

  getLeverage: (): number | null => {
    const saved = localStorage.getItem(LEVERAGE_STORAGE_KEY);
    return saved ? parseInt(saved) : null;
  },

  // --- Trading Mode Persistence ---
  saveTradingMode: (mode: 'paper' | 'live') => {
    localStorage.setItem(TRADING_MODE_STORAGE_KEY, mode);
  },

  getTradingMode: (): 'paper' | 'live' | null => {
    const saved = localStorage.getItem(TRADING_MODE_STORAGE_KEY);
    return (saved === 'paper' || saved === 'live') ? saved : null;
  },

  // --- Last Analysis Persistence (Engine Scan Results) ---
  saveLastAnalysis: (symbol: string, analysis: any) => {
    try {
      const existingData = localStorage.getItem(LAST_ANALYSIS_STORAGE_KEY);
      const analysisMap: Record<string, any> = existingData ? JSON.parse(existingData) : {};
      
      analysisMap[symbol] = analysis;
      localStorage.setItem(LAST_ANALYSIS_STORAGE_KEY, JSON.stringify(analysisMap));
    } catch (e) {
      console.error('[Storage] Failed to save last analysis:', e);
    }
  },

  getLastAnalysis: (symbol: string): any | null => {
    try {
      const data = localStorage.getItem(LAST_ANALYSIS_STORAGE_KEY);
      if (!data) return null;
      
      const analysisMap = JSON.parse(data);
      return analysisMap[symbol] || null;
    } catch {
      return null;
    }
  },

  // --- Active Signal Persistence (State Restore) ---
  getActiveSignal: (symbol?: string): any | null => {
    try {
      const data = localStorage.getItem('neurotrade_active_signal');
      if (!data) return null;
      
      const parsed = JSON.parse(data);
      
      // Migration: if it's an old signal object and not a map
      if (parsed && parsed.id && !symbol) return parsed;
      if (parsed && parsed.id && symbol) {
        return parsed.symbol === symbol ? parsed : null;
      }
      
      // New Map-based storage
      if (symbol) {
        return parsed[symbol] || null;
      }
      
      // Fallback: return the first one found or null
      const firstKey = Object.keys(parsed)[0];
      return firstKey ? parsed[firstKey] : null;

    } catch {
      return null;
    }
  },

  saveActiveSignal: (signal: any | null, symbol?: string) => {
    try {
      const existingData = localStorage.getItem('neurotrade_active_signal');
      let signalMap: Record<string, any> = {};
      
      if (existingData) {
        const parsed = JSON.parse(existingData);
        // Migration: convert old single signal to map
        if (parsed && parsed.id) {
          signalMap[parsed.symbol] = parsed;
        } else {
          signalMap = parsed;
        }
      }

      if (signal) {
        const targetSymbol = symbol || signal.symbol;
        if (targetSymbol) {
          signalMap[targetSymbol] = signal;
          localStorage.setItem('neurotrade_active_signal', JSON.stringify(signalMap));
        }
      } else if (symbol) {
        // Clear specific symbol if provided
        delete signalMap[symbol];
        localStorage.setItem('neurotrade_active_signal', JSON.stringify(signalMap));
      } else {
        // Fallback: if no symbol/signal, clear everything (legacy behavior)
        localStorage.removeItem('neurotrade_active_signal');
      }
    } catch (e) {
      console.error('[Storage] Failed to save active signal:', e);
    }
  },

  clearActiveSignal: (symbol?: string) => {
    storageService.saveActiveSignal(null, symbol);
  },

  // --- Active Signal Cloud Sync (NEW) ---
  saveActiveSignalToSupabase: async (signal: any | null, symbol: string) => {
    if (!supabase) return;
    try {
      if (signal) {
        // Upsert active signal
        const { error } = await supabase
          .from('active_trades')
          .upsert({
            symbol: symbol,
            signal_data: signal,
            updated_at: new Date().toISOString()
          }, { onConflict: 'symbol' });
          
        if (error) {
          const isAbort = error.message?.includes('AbortError') || error.details?.includes('AbortError');
          if (!isAbort) console.error('[Supabase] Active signal save error:', error);
        }
      } else {
        // DELETE active signal record
        const { error } = await supabase
          .from('active_trades')
          .delete()
          .eq('symbol', symbol);
          
        if (error) {
          const isAbort = error.message?.includes('AbortError') || error.details?.includes('AbortError');
          if (!isAbort) console.error('[Supabase] Active signal delete error:', error);
        }
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError' && !e?.message?.includes('AbortError')) {
        console.error('[Supabase] Active signal sync failed:', e);
      }
    }
  },

  fetchActiveSignalFromSupabase: async (symbol: string): Promise<any | null> => {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase
        .from('active_trades')
        .select('signal_data')
        .eq('symbol', symbol)
        .maybeSingle();
        
      if (error) {
        console.error('[Supabase] Active signal fetch error:', error);
        return null;
      }
      
      return data?.signal_data || null;
    } catch (e) {
      console.error('[Supabase] Active signal fetch failed:', e);
      return null;
    }
  },

  // --- Trading Journal (NEW) ---
  getTradingLogs: (): any[] => {
    try {
      const key = 'neurotrade_trading_logs';
      const data = localStorage.getItem(key);
      if (!data) return [];
      
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];

      // Deduplicate on load to clean up existing bad data
      const uniqueMap = new Map();
      parsed.forEach((item: any) => {
        if (item && item.id) {
          uniqueMap.set(item.id, item);
        }
      });
      
      return Array.from(uniqueMap.values());
    } catch (e) {
      console.error("Failed to load trading logs", e);
      return [];
    }
  },

  saveTradingLog: async (log: any) => {
    try {
      const key = 'neurotrade_trading_logs';
      const existing = storageService.getTradingLogs();
      
      // Filter out existing log with same ID to prevent duplicates
      const filtered = existing.filter(l => l.id !== log.id);
      const updated = [log, ...filtered];
      
      localStorage.setItem(key, JSON.stringify(updated));

      if (supabase) {
        const { error } = await supabase
          .from('trade_signals')
          .insert({
            id: log.id,
            symbol: log.symbol,
            type: log.type,
            entry_price: log.entryPrice || log.items?.snapshot?.price,
            exit_price: log.exitPrice,
            stop_loss: log.stopLoss,
            take_profit: log.takeProfit,
            pnl: log.pnl,
            outcome: log.outcome,
            source: log.source || (log.tags?.includes('AI') ? 'AI' : 'MANUAL'),
            confidence: log.aiConfidence || log.items?.aiConfidence,
            reasoning: log.aiReasoning || log.items?.aiReasoning,
            trading_mode: log.tradingMode
          });

        // Ignore duplicate-key errors (23505) and AbortErrors silently
        if (error && error.code !== '23505') {
          const isAbort = error.message?.includes('AbortError') || error.details?.includes('AbortError');
          if (!isAbort) {
            console.error('[Supabase] Signal/Log save error:', error);
          }
        } else if (!error) {
          console.log('[Supabase] ✅ Trade saved to trade_signals:', log.symbol, log.type);
        }
      }
    } catch (e: any) {
      // Silently ignore AbortError — caused by browser cancelling the request (navigation, unmount, etc)
      if (e?.name !== 'AbortError' && !e?.message?.includes('AbortError')) {
        console.error("Failed to save trading log", e);
      }
    }
  },

  // Fetch from Supabase (New)
  fetchTradingLogsFromSupabase: async (): Promise<any[]> => {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('trade_signals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('[Supabase] Trading logs fetch error:', error);
        return [];
      }

      // Map Supabase snake_case to camelCase and NEST items for TradingLog compliance
      const mappedData = data?.map(d => ({
        id: d.id,
        tradeId: d.trade_id || d.id,
        symbol: d.symbol,
        type: d.type,
        timestamp: new Date(d.created_at).getTime(),
        entryPrice: d.entry_price, // Keep flat for some components
        exitPrice: d.exit_price,
        stopLoss: d.stop_loss,
        takeProfit: d.take_profit,
        quantity: d.quantity,
        pnl: d.pnl,
        outcome: d.outcome,
        source: d.source,
        notes: d.notes,
        items: {
          snapshot: d.market_context || {
            price: d.entry_price,
            rsi: 50,
            trend: 'SIDEWAYS',
            newsSentiment: 0,
            condition: 'Neutral'
          },
          chartHistory: [], // Not stored in DB to save space, fetching live if needed
          aiReasoning: d.ai_reasoning || 'No reasoning available',
          aiConfidence: d.ai_confidence || 0,
          aiPrediction: d.pattern_detected
        },
        tradingMode: d.trading_mode || (d.source === 'BINANCE_IMPORT' ? 'live' : 'paper')
      })) || [];

      // Update local storage - Merge with existing to avoid losing local-only trades
      if (mappedData.length > 0) {
        const localLogs = storageService.getTradingLogs();
        const logMap = new Map();
        
        // Add existing local logs
        localLogs.forEach(l => { if (l.id) logMap.set(l.id, l); });
        // Add/Overwrite with cloud logs
        mappedData.forEach(l => { if (l.id) logMap.set(l.id, l); });
        
        localStorage.setItem('neurotrade_trading_logs', JSON.stringify(Array.from(logMap.values())));
      }

      console.log(`[Supabase] ✅ Fetched ${mappedData.length} trading logs`);
      return mappedData;
    } catch (e) {
      console.error('[Supabase] Trading logs fetch failed:', e);
      return [];
    }
  },

  // --- Backtest Event Logs (NEW) ---
  saveBacktestLog: async (log: { time: string; msg: string; type: string; backtestId?: string }) => {
    try {
      if (supabase) {
        const { error } = await supabase
          .from('backtest_logs')
          .insert({
            backtest_id: log.backtestId || 'default',
            log_type: log.type,
            message: log.msg,
            timestamp: log.time
          });

        if (error) {
          console.error('[Supabase] Backtest log save error:', error);
          return false;
        }

        return true;
      }
      return false;
    } catch (e) {
      console.error("Failed to save backtest log", e);
      return false;
    }
  },

  fetchBacktestLogs: async (backtestId: string = 'default', limit: number = 100): Promise<any[]> => {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('backtest_logs')
        .select('*')
        .eq('backtest_id', backtestId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[Supabase] Backtest logs fetch error:', error);
        return [];
      }

      console.log(`[Supabase] ✅ Fetched ${data?.length || 0} backtest logs`);
      return data || [];
    } catch (e) {
      console.error('[Supabase] Backtest logs fetch failed:', e);
      return [];
    }
  },

  saveBacktestResults: async (results: {
    id: string;
    symbol: string;
    strategy: string;
    totalTrades: number;
    winRate: number;
    netProfit: number;
    stats: any;
  }) => {
    try {
      if (supabase) {
        const { error } = await supabase
          .from('backtest_results')
          .insert({
            id: results.id,
            symbol: results.symbol,
            strategy: results.strategy,
            total_trades: results.totalTrades,
            win_rate: results.winRate,
            net_profit: results.netProfit,
            stats: results.stats
          });

        if (error) console.error('[Supabase] Backtest results save error:', error);
        else console.log('[Supabase] ✅ Backtest results saved');
      }
    } catch (e) {
      console.error("Failed to save backtest results", e);
    }
  }
};