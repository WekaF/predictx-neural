import React, { useState } from 'react';
import { 
  Play, RotateCcw, CheckCircle2, AlertCircle, 
  Loader2, History, Database, TrendingUp, 
  ChevronRight, Brain, Zap
} from 'lucide-react';
import { EnhancedExecutedTrade } from '../types/enhanced';
import { batchTrainModel } from '../services/mlService';
import { BatchTrainingProgress, BatchTrainingResult } from '../services/batchTrainingService';

interface Props {
  trades: EnhancedExecutedTrade[];
  onComplete?: () => void;
}

export const BatchTrainingPanel: React.FC<Props> = ({ trades, onComplete }) => {
  const [isTraining, setIsTraining] = useState(false);
  const [progress, setProgress] = useState<BatchTrainingProgress | null>(null);
  const [result, setResult] = useState<BatchTrainingResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const completedTrades = trades.filter(t => t.outcome !== 'OPEN');

  const startTraining = async () => {
    if (completedTrades.length === 0) {
      setError("No completed trades available for training.");
      return;
    }

    setIsTraining(true);
    setResult(null);
    setError(null);
    setProgress({ current: 0, total: completedTrades.length, percentage: 0 });

    try {
      const trainingResult = await batchTrainModel(completedTrades, (p) => {
        setProgress(p);
      });

      setResult(trainingResult);
      if (onComplete) onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete batch training");
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <div className="bg-[#0a0a0f] p-6 rounded-xl border border-white/5 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">Batch Retraining</h3>
            <p className="text-xs text-gray-500">Train model from historical trade experience</p>
          </div>
        </div>
        
        {!isTraining && !result && (
          <button
            onClick={startTraining}
            disabled={completedTrades.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all font-bold text-sm shadow-lg shadow-blue-500/20"
          >
            <Play className="w-4 h-4" />
            Start Retraining
          </button>
        )}
      </div>

      {!isTraining && !result && !error && (
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-white/5 rounded-lg border border-white/5">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Database className="w-3 h-3" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Available Records</span>
            </div>
            <p className="text-xl font-bold text-white">{completedTrades.length}</p>
          </div>
          <div className="p-4 bg-white/5 rounded-lg border border-white/5">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Brain className="w-3 h-3" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Learning Rate</span>
            </div>
            <p className="text-xl font-bold text-white">0.08</p>
          </div>
        </div>
      )}

      {isTraining && progress && (
        <div className="space-y-4 py-4">
          <div className="flex justify-between items-end mb-1">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              <span className="text-sm font-medium text-white">
                Retraining on {progress.currentTrade || 'historical data'}...
              </span>
            </div>
            <span className="text-sm font-bold text-blue-400">{Math.round(progress.percentage)}%</span>
          </div>
          
          <div className="h-2 bg-white/5 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-300" 
              style={{ width: `${progress.percentage}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] text-gray-500 font-bold uppercase tracking-wider">
            <span>{progress.current} / {progress.total} TRADES</span>
            {progress.eta !== undefined && <span>ETA: {progress.eta}s</span>}
          </div>
        </div>
      )}

      {result && result.success && (
        <div className="space-y-4">
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center gap-4">
            <div className="p-2 bg-green-500/20 rounded-full">
              <CheckCircle2 className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h4 className="text-green-400 font-bold">Retraining Successful</h4>
              <p className="text-xs text-green-400/70">Processed {result.tradesProcessed} trades using experience replay.</p>
            </div>
          </div>

          {result.improvementMetrics && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Before WR</p>
                <p className="text-lg font-bold text-white">{result.improvementMetrics.beforeWinRate.toFixed(1)}%</p>
              </div>
              <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <p className="text-[10px] text-blue-400 uppercase font-bold mb-1">After WR</p>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-white">{result.improvementMetrics.afterWinRate.toFixed(1)}%</p>
                  <div className="flex items-center text-green-400 text-xs font-bold">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    +{result.improvementMetrics.improvement.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => setResult(null)}
            className="w-full py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all text-xs font-bold uppercase tracking-wider"
          >
            Done
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-4">
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
          <div>
            <h4 className="text-red-400 font-bold text-sm">Training Failed</h4>
            <p className="text-xs text-red-400/70">{error}</p>
          </div>
          <button 
            onClick={startTraining}
            className="ml-auto p-1 hover:bg-red-500/10 rounded"
          >
            <RotateCcw className="w-4 h-4 text-red-400" />
          </button>
        </div>
      )}

      <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/10">
        <div className="flex gap-2 text-blue-400 mb-2">
          <Zap className="w-4 h-4" />
          <p className="text-[10px] font-bold uppercase tracking-wider">How it works</p>
        </div>
        <p className="text-xs text-gray-400 leading-relaxed">
          The system reconstructs the exact market state for each historical trade and "re-plays" it through the neural network. This allows the AI to learn from its past wins and losses without waiting for real-time market movement.
        </p>
      </div>
    </div>
  );
};
