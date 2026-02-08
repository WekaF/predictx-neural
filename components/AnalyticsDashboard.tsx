import React, { useState, useEffect } from 'react';
import { analyticsService, PerformanceMetrics, AssetPerformance, TradeSignalData, RiskMetrics, GrowthData } from '../services/analyticsService';
import { MetricCard } from './MetricCard';
import { PieChart } from './PieChart';
import { RiskRadarChart } from './RiskRadarChart';
import { GrowthChart } from './GrowthChart';
import { updateLearningRate, updateEpsilon, resetModel, exportWeights, importWeights, getModelStats } from '../services/mlService';

export const AnalyticsDashboard: React.FC = () => {
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
  }, []);

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
    { label: 'Losses', value: metrics.lossRate, color: '#ef4444' },
    { label: 'Pending', value: metrics.pendingRate, color: '#6366f1' }
  ] : [];

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">📊 Professional Performance</h1>
          <p className="text-gray-400">Advanced Analytics & Metric Tracking</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 border border-blue-500/30"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon="📈"
          title="Total Trades"
          value={metrics?.totalTrades || 0}
          color="blue"
        />
        <MetricCard
          icon="🎯"
          title="Win Rate"
          value={`${(metrics?.winRate || 0).toFixed(1)}%`}
          trend={metrics && metrics.winRate > 50 ? 'up' : metrics && metrics.winRate < 50 ? 'down' : 'neutral'}
          color="green"
        />
        <MetricCard
          icon="💰"
          title="Expectancy"
          value={`$${(metrics?.expectancy || 0).toFixed(2)}`}
          color={metrics && metrics.expectancy > 0 ? "green" : "red"}
        />
        <MetricCard
          icon="🛡️"
          title="Max Drawdown"
          value={`${(metrics?.maxDrawdown || 0).toFixed(1)}%`}
          color="red"
        />
      </div>

      {/* Advanced Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Growth Chart */}
        <div className="lg:col-span-2 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">Equity Growth Curve</h2>
          <GrowthChart data={growthData} />
        </div>

        {/* Risk Radar */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">Performance Radar</h2>
          {riskMetrics && <RiskRadarChart metrics={riskMetrics} />}
        </div>
      </div>

      {/* Detailed Stats & Pie Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">Trade Distribution</h2>
              <PieChart data={pieData} size={200} />
          </div>

          <div className="col-span-2 bg-gray-800/50 border border-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4">Detailed Statistics</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-3 bg-gray-900/50 rounded border border-gray-700">
                      <div className="text-gray-400 text-xs">Profit Factor</div>
                      <div className="text-xl font-bold text-white">{metrics?.profitFactor.toFixed(2)}</div>
                  </div>
                  <div className="p-3 bg-gray-900/50 rounded border border-gray-700">
                      <div className="text-gray-400 text-xs">Sharpe Ratio</div>
                      <div className="text-xl font-bold text-white">{metrics?.sharpeRatio.toFixed(2)}</div>
                  </div>
                  <div className="p-3 bg-gray-900/50 rounded border border-gray-700">
                      <div className="text-gray-400 text-xs">Average Win</div>
                      <div className="text-xl font-bold text-emerald-400">${metrics?.avgWin.toFixed(2)}</div>
                  </div>
                  <div className="p-3 bg-gray-900/50 rounded border border-gray-700">
                      <div className="text-gray-400 text-xs">Average Loss</div>
                      <div className="text-xl font-bold text-rose-400">${metrics?.avgLoss.toFixed(2)}</div>
                  </div>
                   <div className="p-3 bg-gray-900/50 rounded border border-gray-700">
                      <div className="text-gray-400 text-xs">Total Net Profit</div>
                      <div className={`text-xl font-bold ${metrics && metrics.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        ${metrics?.netProfit.toFixed(2)}
                      </div>
                  </div>
                  <div className="p-3 bg-gray-900/50 rounded border border-gray-700">
                      <div className="text-gray-400 text-xs">Avg Confidence</div>
                      <div className="text-xl font-bold text-purple-400">{metrics?.avgConfidence.toFixed(1)}%</div>
                  </div>
              </div>
          </div>
      </div>

      {/* AI Tuning & Asset Performance (Existing functionality kept) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Asset Performance */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">Asset Performance</h2>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
            {assetPerf.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No asset data yet</p>
            ) : (
              assetPerf.map((asset, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                  <div>
                    <p className="font-bold text-white">{asset.symbol}</p>
                    <p className="text-xs text-gray-400">{asset.totalTrades} trades</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${asset.winRate >= 50 ? 'text-green-400' : 'text-red-400'}`}>
                      {asset.winRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-400">
                      {asset.wins}W / {asset.losses}L
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* AI Tuning Controls */}
        <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">🎛️ AI Model Tuning</h2>
            {/* ... Only critical controls ... */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Learning Rate: <span className="text-white font-bold">{learningRate.toFixed(4)}</span>
                </label>
                <input
                  type="range"
                  min="0.001"
                  max="0.1"
                  step="0.001"
                  value={learningRate}
                  onChange={(e) => handleLearningRateChange(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Exploration Rate: <span className="text-white font-bold">{(epsilon * 100).toFixed(1)}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={epsilon}
                  onChange={(e) => handleEpsilonChange(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
             <div className="flex flex-wrap gap-3">
              <button onClick={handleExportWeights} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded text-sm hover:bg-blue-500/30">💾 Export Weights</button>
              <button onClick={handleImportWeights} className="px-3 py-1 bg-green-500/20 text-green-400 rounded text-sm hover:bg-green-500/30">📥 Import</button>
              <button onClick={handleResetModel} className="px-3 py-1 bg-red-500/20 text-red-400 rounded text-sm hover:bg-red-500/30">🔄 Reset</button>
            </div>
        </div>
      </div>
      
    </div>
  );
};
