import React, { useState, useMemo } from 'react';
import { 
  Settings2, Sliders, RefreshCw, CheckCircle2, 
  Target, Shield, TrendingUp, Info, 
  ArrowUpRight, AlertTriangle, Zap
} from 'lucide-react';
import { EnhancedExecutedTrade } from '../types/enhanced';
import { optimizeHyperparameters } from '../services/mlService';
import { OptimizationResult } from '../services/hyperparameterOptimizer';

interface Props {
  trades: EnhancedExecutedTrade[];
}

export const HyperparameterOptimizer: React.FC<Props> = ({ trades }) => {
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [results, setResults] = useState<OptimizationResult[] | null>(null);

  const startOptimization = () => {
    setIsOptimizing(true);
    // Simulate some work time
    setTimeout(() => {
      const optimizationResults = optimizeHyperparameters(trades);
      setResults(optimizationResults);
      setIsOptimizing(false);
    }, 1500);
  };

  return (
    <div className="bg-[#0a0a0f] p-6 rounded-xl border border-white/5 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
            <Settings2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">AI Optimization</h3>
            <p className="text-xs text-gray-500">Fine-tune model thresholds and risk params</p>
          </div>
        </div>
        
        {!isOptimizing && (
          <button
            onClick={startOptimization}
            disabled={trades.length < 5}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all font-bold text-sm shadow-lg shadow-amber-500/20"
          >
            <Sliders className="w-4 h-4" />
            Optimize Performance
          </button>
        )}

        {isOptimizing && (
          <div className="flex items-center gap-2 text-amber-400 text-sm font-bold animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Analyzing Data...
          </div>
        )}
      </div>

      {!results && !isOptimizing && (
        <div className="p-4 bg-white/5 rounded-lg border border-white/5 text-center py-10">
          <div className="flex justify-center mb-3">
            <Shield className="w-10 h-10 text-gray-600 opacity-30" />
          </div>
          <p className="text-sm text-gray-400 max-w-[250px] mx-auto">
            {trades.length < 5 
              ? "Need at least 5 completed trades before optimization suite can run." 
              : "Perform a grid search optimization to find the best thresholds for your current trading history."}
          </p>
        </div>
      )}

      {results && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
          {results.map((res, i) => (
            <div key={i} className="p-4 bg-white/5 rounded-xl border border-white/5 hover:border-amber-500/30 transition-all">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="text-white font-bold text-sm tracking-tight">{res.parameter}</h4>
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mt-1">Calibration Status</p>
                </div>
                {res.status === 'IMPROVED' ? (
                  <div className="px-2 py-1 bg-green-500/10 rounded flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                    <span className="text-[10px] font-bold text-green-400">OPTIMIZED</span>
                  </div>
                ) : (
                  <div className="px-2 py-1 bg-white/5 rounded">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Optimal</span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white">{res.optimizedValue}</span>
                    <span className="text-xs text-gray-500 line-through">{res.currentValue}</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full mt-2 overflow-hidden">
                    <div 
                      className="h-full bg-amber-500" 
                      style={{ width: `${(res.optimizedValue / 100) * 100}%` }} 
                    />
                  </div>
                </div>

                {res.estimatedImprovement > 0 && (
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1 text-right">Est. Gain</p>
                    <div className="flex items-center text-green-400 font-black text-lg">
                      <TrendingUp className="w-4 h-4 mr-1" />
                      +{res.estimatedImprovement}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
            <div className="flex gap-2 text-amber-400 mb-2">
              <Zap className="w-4 h-4" />
              <p className="text-[10px] font-bold uppercase tracking-wider">What happened?</p>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              We analyzed every potential threshold combination against your past {trades.length} trades. The optimized values maximize your **Profit Factor** and **Expectancy** while minimizing risky drawdowns based on your specific results.
            </p>
          </div>
        </div>
      )}

      {trades.length >= 5 && !isOptimizing && !results && (
        <div className="flex items-start gap-3 p-4 bg-white/5 rounded-lg text-amber-400/70 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p>Running optimization will adjust your AI's decision thresholds. Only run this if you believe the current market regime has shifted.</p>
        </div>
      )}
    </div>
  );
};
