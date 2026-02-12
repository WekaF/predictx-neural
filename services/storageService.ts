
import { TrainingData, BacktestConfig, AppSettings } from '../types';
import { supabase } from './supabaseClient';
import { isValidUUID } from '../utils/uuid';

const TRAINING_STORAGE_KEY = 'neurotrade_training_data';
const CONFIG_STORAGE_KEY = 'neurotrade_backtest_configs';
const MODEL_WEIGHTS_KEY = 'neurotrade_ml_weights';
const SETTINGS_STORAGE_KEY = 'neurotrade_settings';
const AUTO_TRADE_KEY = 'neurotrade_auto_mode';

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
      .limit(50);

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
          useTestnet: parsed.useTestnet ?? false
        };
      }
      return { webhookUrl: defaultUrl, webhookMethod: 'POST', enableNotifications: false, useTestnet: false };
    } catch (e) {
      return { webhookUrl: defaultUrl, webhookMethod: 'POST', enableNotifications: false, useTestnet: false };
    }
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

  // --- Trading Journal (NEW) ---
  getTradingLogs: (): any[] => {
    try {
      const key = 'neurotrade_trading_logs';
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Failed to load trading logs", e);
      return [];
    }
  },

  saveTradingLog: async (log: any) => {
    try {
      const key = 'neurotrade_trading_logs';
      const existing = storageService.getTradingLogs();
      const updated = [log, ...existing];
      localStorage.setItem(key, JSON.stringify(updated));

      if (supabase) {
        const { error } = await supabase
          .from('trading_journal')
          .insert({
            id: log.id,
            trade_id: log.id,
            symbol: log.symbol,
            type: log.type,
            entry_price: log.entryPrice,
            exit_price: log.exitPrice,
            stop_loss: log.stopLoss,
            take_profit: log.takeProfit,
            quantity: log.quantity,
            pnl: log.pnl,
            outcome: log.outcome,
            source: log.source,
            market_context: log.marketContext,
            pattern_detected: log.patternDetected,
            confluence_factors: log.confluenceFactors,
            ai_confidence: log.aiConfidence,
            ai_reasoning: log.aiReasoning,
            hold_duration: log.holdDuration,
            actual_rr: log.actualRR
          });

        if (error) console.error('[Supabase] Journal save error:', error);
        else console.log('[Supabase] ✅ Trade saved to journal:', log.symbol, log.type);
      }
    } catch (e) {
      console.error("Failed to save trading log", e);
    }
  },

  // Fetch from Supabase (New)
  fetchTradingLogsFromSupabase: async (): Promise<any[]> => {
    if (!supabase) return [];

    try {
      const { data, error } = await supabase
        .from('trading_journal')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('[Supabase] Trading logs fetch error:', error);
        return [];
      }

      // Map Supabase snake_case to camelCase
      const mappedData = data?.map(d => ({
        id: d.id,
        symbol: d.symbol,
        type: d.type,
        entryPrice: d.entry_price,
        exitPrice: d.exit_price,
        stopLoss: d.stop_loss,
        takeProfit: d.take_profit,
        quantity: d.quantity,
        pnl: d.pnl,
        outcome: d.outcome,
        source: d.source,
        marketContext: d.market_context,
        patternDetected: d.pattern_detected,
        confluenceFactors: d.confluence_factors,
        aiConfidence: d.ai_confidence,
        aiReasoning: d.ai_reasoning,
        holdDuration: d.hold_duration,
        actualRR: d.actual_rr,
        entryTime: d.created_at, // Use created_at as entryTime if needed
        exitTime: d.updated_at // Approximate
      })) || [];

      // Update local storage
      if (mappedData.length > 0) {
        localStorage.setItem('neurotrade_trading_logs', JSON.stringify(mappedData));
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