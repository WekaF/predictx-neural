import React, { useState, useEffect } from 'react';
import { analyticsService, PerformanceMetrics, AssetPerformance, TradeSignalData, RiskMetrics, GrowthData } from '../services/analyticsService';
import { MetricCard } from './MetricCard';
import { PieChart } from './PieChart';
import { RiskRadarChart } from './RiskRadarChart';
import { GrowthChart } from './GrowthChart';
import { updateLearningRate, updateEpsilon, resetModel, exportWeights, importWeights, getModelStats } from '../services/mlService';
import { ArrowUp, ArrowDown, Activity, Clock, CheckCircle, XCircle } from 'lucide-react';
import { EnhancedExecutedTrade } from '../types/enhanced';

interface AnalyticsDashboardProps {
  trades?: EnhancedExecutedTrade[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ trades = [] }) => {
  console.log('[AnalyticsDashboard] Received trades:', trades.length, trades); 
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [assetPerf, setAssetPerf] = useState<AssetPerformance[]>([]);
  const [recentTrades, setRecentTrades] = useState<TradeSignalData[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [growthData, setGrowthData] = useState<GrowthData[]>([]);
  const [loading, setLoading] = useState(true);

  // AI Tuning States
  const [learningRate, setLearningRate] = useState(0.01);
  const [epsilon, setEpsilon] = useState(0.2);
  const [modelStats, setModelStats] = useState<any>(null);

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      // User requested to fetch from Supabase explicitly ("ambil saja dari table supabase")
      // So we will pass undefined to force the service to use its internal Supabase fetch
      // OR we can pass trades if they are valid, but the user implies the passed data might be empty/wrong.
      // Let's try passing empty to force fetch, as per user instruction.
      // Actually, let's just not pass 'trades' and let the service handle it (it now defaults to Supabase if empty)
      
      // If trades are empty, service will fetch. If trades has content but PnL is 0, we might want to ignore it?
      // To be safe and follow "ambil dari table", let's force fetch by passing undefined.
      
      const [metricsData, assetData, tradesData, riskData, growth] = await Promise.all([
        analyticsService.getPerformanceMetrics(),
        analyticsService.getAssetPerformance(),
        analyticsService.getRecentTrades(),
        analyticsService.getRiskMetrics(),
        analyticsService.getGrowthCurve()
      ]);

      setMetrics(metricsData);
      setAssetPerf(assetData);
      setRecentTrades(tradesData);
      setRiskMetrics(riskData);
      setGrowthData(growth);

      // Get model stats
      const stats = getModelStats();
      setModelStats(stats);
      setLearningRate(stats.learningRate);
      setEpsilon(stats.epsilon);
    } catch (e) {
      console.error('[Analytics] Load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [trades]);

  // Handle learning rate change
  const handleLearningRateChange = (value: number) => {
    setLearningRate(value);
    updateLearningRate(value);
  };

  // Handle epsilon change
  const handleEpsilonChange = (value: number) => {
    setEpsilon(value);
    updateEpsilon(value);
  };

  // Handle model reset
  const handleResetModel = () => {
    if (confirm('⚠️ Reset AI model? This will erase all learned patterns!')) {
      resetModel();
      loadData();
      alert('✅ Model reset successfully!');
    }
  };

  // Handle export weights
  const handleExportWeights = () => {
    const weights = exportWeights();
    const blob = new Blob([JSON.stringify(weights, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `model-weights-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle import weights
  const handleImportWeights = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const weights = JSON.parse(event.target?.result as string);
            importWeights(weights);
            alert('✅ Weights imported successfully!');
            loadData();
          } catch (err) {
            alert('❌ Invalid weights file!');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-2">⚙️</div>
          <p className="text-gray-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const pieData = metrics ? [
    { label: 'Wins', value: metrics.winRate, color: '#10b981' },
    { label: 'Losses', value: metrics.lossRate, color: '#f43f5e' },
    { label: 'Pending', value: metrics.pendingRate, color: '#6366f1' }
  ] : [];

  return (
    <div className="p-6 space-y-8 overflow-y-auto h-full pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">📊 Analytics Dashboard</h1>
          <p className="text-gray-400">Real-time performance metrics and AI insights</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 border border-blue-500/20 transition-all"
        >
          <Activity className="w-4 h-4" />
          Refresh Data
        </button>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          icon="💰"
          title="Net Profit"
          value={`$${(metrics?.netProfit || 0).toFixed(2)}`}
          subtitle="Total realized profit"
          trend={metrics && metrics.netProfit >= 0 ? 'up' : 'down'}
          color={metrics && metrics.netProfit >= 0 ? "green" : "red"}
          tooltip="Total profit minus total losses from closed trades"
        />
        <MetricCard
          icon="🎯"
          title="Win Rate"
          value={`${(metrics?.winRate || 0).toFixed(1)}%`}
          subtitle={`${metrics?.totalTrades} total trades`}
          progress={metrics?.winRate}
          color="indigo"
          tooltip="Percentage of trades that resulted in profit"
        />
        <MetricCard
          icon="📈"
          title="Profit Factor"
          value={(metrics?.profitFactor || 0).toFixed(2)}
          subtitle="Gross Profit / Gross Loss"
          color="yellow"
          tooltip="Ratio of gross profit to gross loss. > 1.5 is good."
        />
        <MetricCard
          icon="🛡️"
          title="Max Drawdown"
          value={`${(metrics?.maxDrawdown || 0).toFixed(1)}%`}
          subtitle="Peak to trough decline"
          color="red"
          progress={(metrics?.maxDrawdown || 0) * 2} // Visual scaling
          tooltip="Maximum observed loss from a peak"
        />
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Growth Chart */}
        <div className="lg:col-span-2 bg-gray-900/40 border border-gray-800 rounded-xl p-6 backdrop-blur-sm">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Equity Growth Curve
          </h2>
          <GrowthChart data={growthData} />
        </div>

        {/* Risk Radar */}
        <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-6 backdrop-blur-sm">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-purple-400" />
            Performance Radar
          </h2>
          {riskMetrics && <RiskRadarChart metrics={riskMetrics} />}
        </div>
      </div>

      {/* Recent Activity & Asset Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Recent Trades Table */}
        <div className="lg:col-span-3 bg-gray-900/40 border border-gray-800 rounded-xl p-6 backdrop-blur-sm">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            Recent Activity
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-500 font-medium border-b border-gray-800">
                <tr>
                  <th className="px-4 py-3">Asset</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3 text-right">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {recentTrades.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                      No recent trades found.
                    </td>
                  </tr>
                ) : (
                  recentTrades.map((trade) => (
                    <tr key={trade.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 font-bold text-gray-300">{trade.symbol}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 ${trade.type === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {trade.type === 'BUY' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                          {trade.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-400">${trade.entry_price.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${trade.confidence}%` }}></div>
                          </div>
                          <span className="text-xs text-gray-400">{trade.confidence}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${trade.outcome === 'WIN' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                          trade.outcome === 'LOSS' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                            'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                          {trade.outcome}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Asset Performance List */}
        <div className="lg:col-span-2 bg-gray-900/40 border border-gray-800 rounded-xl p-6 backdrop-blur-sm flex flex-col">
          <h2 className="text-xl font-bold text-white mb-4">Top Assets</h2>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[400px]">
            {assetPerf.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No asset data available.</p>
            ) : (
              assetPerf.map((asset, idx) => (
                <div key={idx} className="p-4 bg-gray-800/30 rounded-xl border border-gray-700/50 hover:bg-gray-800/50 transition-colors">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-white">{asset.symbol}</span>
                    <span className={`text-sm font-bold ${asset.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {asset.winRate.toFixed(1)}% WR
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${asset.winRate}%` }}></div>
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{asset.totalTrades} Trades</span>
                    <span>{asset.wins}W / {asset.losses}L</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Detailed Statistics & AI Tuning */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Detailed Stats Grid */}
        <div className="bg-gray-900/40 border border-gray-800 rounded-xl p-6 backdrop-blur-sm">
          <h2 className="text-xl font-bold text-white mb-4">Detailed Statistics</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Expected Value</div>
              <div className={`text-xl font-bold ${metrics && metrics.expectancy > 0 ? "text-emerald-400" : "text-gray-300"}`}>
                ${(metrics?.expectancy || 0).toFixed(2)}
              </div>
            </div>
            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Sharpe Ratio</div>
              <div className="text-xl font-bold text-white">{(metrics?.sharpeRatio || 0).toFixed(2)}</div>
            </div>
            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Avg Win</div>
              <div className="text-xl font-bold text-emerald-400">+${(metrics?.avgWin || 0).toFixed(2)}</div>
            </div>
            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700/50">
              <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Avg Loss</div>
              <div className="text-xl font-bold text-rose-400">-${Math.abs(metrics?.avgLoss || 0).toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* AI Model Tuning */}
        <div className="bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/20 rounded-xl p-6 backdrop-blur-sm">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-400" />
            AI Model Tuning
          </h2>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm text-gray-400">Learning Rate (Alpha)</label>
                <span className="text-white font-mono">{learningRate.toFixed(4)}</span>
              </div>
              <input
                type="range"
                min="0.001"
                max="0.1"
                step="0.001"
                value={learningRate}
                onChange={(e) => handleLearningRateChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm text-gray-400">Exploration Rate (Epsilon)</label>
                <span className="text-white font-mono">{(epsilon * 100).toFixed(1)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={epsilon}
                onChange={(e) => handleEpsilonChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <button onClick={handleExportWeights} className="px-4 py-2 bg-indigo-500/20 text-indigo-300 rounded-lg hover:bg-indigo-500/30 text-sm font-medium transition-colors border border-indigo-500/20">
                💾 Export Brain
              </button>
              <button onClick={handleImportWeights} className="px-4 py-2 bg-emerald-500/20 text-emerald-300 rounded-lg hover:bg-emerald-500/30 text-sm font-medium transition-colors border border-emerald-500/20">
                📥 Import Brain
              </button>
              <button onClick={handleResetModel} className="px-4 py-2 bg-rose-500/20 text-rose-300 rounded-lg hover:bg-rose-500/30 text-sm font-medium transition-colors border border-rose-500/20 ml-auto">
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
