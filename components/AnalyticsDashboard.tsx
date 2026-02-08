import React, { useState, useEffect } from 'react';
import { analyticsService, PerformanceMetrics, AssetPerformance, TradeSignalData } from '../services/analyticsService';
import { MetricCard } from './MetricCard';
import { PieChart } from './PieChart';
import { updateLearningRate, updateEpsilon, resetModel, exportWeights, importWeights, getModelStats } from '../services/mlService';

export const AnalyticsDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [assetPerf, setAssetPerf] = useState<AssetPerformance[]>([]);
  const [recentTrades, setRecentTrades] = useState<TradeSignalData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // AI Tuning States
  const [learningRate, setLearningRate] = useState(0.01);
  const [epsilon, setEpsilon] = useState(0.2);
  const [modelStats, setModelStats] = useState<any>(null);

  // Load data
  const loadData = async () => {
    setLoading(true);
    try {
      const [metricsData, assetData, tradesData] = await Promise.all([
        analyticsService.getPerformanceMetrics(),
        analyticsService.getAssetPerformance(),
        analyticsService.getRecentTrades()
      ]);
      
      setMetrics(metricsData);
      setAssetPerf(assetData);
      setRecentTrades(tradesData);
      
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
          <h1 className="text-3xl font-bold text-white mb-1">📊 AI Analytics</h1>
          <p className="text-gray-400">Performance metrics & model tuning</p>
        </div>
        <button
          onClick={loadData}
          className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 border border-blue-500/30"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Metrics Grid */}
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
          icon="💡"
          title="Avg Confidence"
          value={`${(metrics?.avgConfidence || 0).toFixed(1)}%`}
          color="purple"
        />
        <MetricCard
          icon="🔥"
          title="Best Trade"
          value={metrics?.bestTrade ? `${metrics.bestTrade.confidence.toFixed(1)}%` : 'N/A'}
          subtitle={metrics?.bestTrade?.symbol}
          color="green"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Win/Loss Distribution */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">Win/Loss Distribution</h2>
          <PieChart data={pieData} size={220} />
        </div>

        {/* Asset Performance */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold text-white mb-4">Asset Performance</h2>
          <div className="space-y-3">
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
      </div>

      {/* AI Tuning Controls */}
      <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">🎛️ AI Model Tuning</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Learning Rate */}
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
            <p className="text-xs text-gray-500 mt-1">How fast the AI learns from mistakes</p>
          </div>

          {/* Epsilon (Exploration) */}
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
            <p className="text-xs text-gray-500 mt-1">How often AI tries random actions</p>
          </div>
        </div>

        {/* Model Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800/50 p-3 rounded-lg">
            <p className="text-xs text-gray-400">Training Iterations</p>
            <p className="text-lg font-bold text-white">{modelStats?.trainingCount || 0}</p>
          </div>
          <div className="bg-gray-800/50 p-3 rounded-lg">
            <p className="text-xs text-gray-400">Input Nodes</p>
            <p className="text-lg font-bold text-white">{modelStats?.inputNodes || 0}</p>
          </div>
          <div className="bg-gray-800/50 p-3 rounded-lg">
            <p className="text-xs text-gray-400">Hidden Nodes</p>
            <p className="text-lg font-bold text-white">{modelStats?.hiddenNodes || 0}</p>
          </div>
          <div className="bg-gray-800/50 p-3 rounded-lg">
            <p className="text-xs text-gray-400">Output Nodes</p>
            <p className="text-lg font-bold text-white">{modelStats?.outputNodes || 3}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportWeights}
            className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 border border-blue-500/30"
          >
            💾 Export Weights
          </button>
          <button
            onClick={handleImportWeights}
            className="px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 border border-green-500/30"
          >
            📥 Import Weights
          </button>
          <button
            onClick={handleResetModel}
            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 border border-red-500/30"
          >
            🔄 Reset Model
          </button>
        </div>
      </div>

      {/* Recent Trades Table */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4">Recent Trades</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left text-gray-400 pb-2">Time</th>
                <th className="text-left text-gray-400 pb-2">Asset</th>
                <th className="text-left text-gray-400 pb-2">Type</th>
                <th className="text-left text-gray-400 pb-2">Entry</th>
                <th className="text-left text-gray-400 pb-2">Confidence</th>
                <th className="text-left text-gray-400 pb-2">Outcome</th>
                <th className="text-left text-gray-400 pb-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {recentTrades.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-gray-500 py-8">
                    No trades yet
                  </td>
                </tr>
              ) : (
                recentTrades.map((trade) => (
                  <tr key={trade.id} className="border-b border-gray-800">
                    <td className="py-3 text-gray-300">
                      {new Date(trade.created_at).toLocaleString('en-US', { 
                        month: 'short', 
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </td>
                    <td className="py-3 text-white font-bold">{trade.symbol}</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        trade.type === 'BUY' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {trade.type}
                      </span>
                    </td>
                    <td className="py-3 text-gray-300">${trade.entry_price.toFixed(2)}</td>
                    <td className="py-3 text-gray-300">{trade.confidence.toFixed(1)}%</td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        trade.outcome === 'WIN' ? 'bg-green-500/20 text-green-400' :
                        trade.outcome === 'LOSS' ? 'bg-red-500/20 text-red-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {trade.outcome}
                      </span>
                    </td>
                    <td className="py-3 text-gray-400 text-xs">{trade.source}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
