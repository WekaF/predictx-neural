import React, { useMemo } from 'react';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, Cell, PieChart, Pie
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Target, Clock, 
  Brain, Zap, BarChart3, PieChart as PieIcon,
  Calendar, Info, AlertCircle, CheckCircle2
} from 'lucide-react';
import { EnhancedExecutedTrade, TradeAnalytics } from '../types/enhanced';
import { tradeAnalyticsService } from '../services/tradeAnalyticsService';

interface Props {
  trades: EnhancedExecutedTrade[];
}

export const TradeAnalyticsDashboard: React.FC<Props> = ({ trades }) => {
  const analytics = useMemo(() => tradeAnalyticsService.calculateTradeAnalytics(trades), [trades]);
  const overview = analytics.overview;

  if (overview.totalTrades === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-[#0a0a0f] rounded-xl border border-white/5">
        <div className="p-4 bg-blue-500/10 rounded-full mb-4">
          <BarChart3 className="w-8 h-8 text-blue-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">No Trade Data Available</h3>
        <p className="text-gray-400 text-center max-w-sm">
          Execute some trades with the AI to see detailed performance analytics and pattern insights.
        </p>
      </div>
    );
  }

  // Equity Curve Data
  const equityCurveData = useMemo(() => {
    let balance = 0;
    return trades
      .slice()
      .reverse()
      .map(t => {
        balance += t.pnl;
        return {
          time: t.exitTime,
          equity: balance
        };
      });
  }, [trades]);

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0a0a0f] p-5 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all group">
          <div className="flex justify-between items-start mb-2">
            <p className="text-gray-400 text-sm font-medium">Net Profit</p>
            <div className={`p-2 rounded-lg ${overview.totalPnl >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              {overview.totalPnl >= 0 ? <TrendingUp className="w-4 h-4 text-green-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
            </div>
          </div>
          <p className={`text-2xl font-bold ${overview.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            ${overview.totalPnl.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-2">Across {overview.totalTrades} total trades</p>
        </div>

        <div className="bg-[#0a0a0f] p-5 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all group">
          <div className="flex justify-between items-start mb-2">
            <p className="text-gray-400 text-sm font-medium">Win Rate</p>
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Target className="w-4 h-4 text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            {overview.overallWinRate.toFixed(1)}%
          </p>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 flex-1 bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500" 
                style={{ width: `${overview.overallWinRate}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-[#0a0a0f] p-5 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all group">
          <div className="flex justify-between items-start mb-2">
            <p className="text-gray-400 text-sm font-medium">Profit Factor</p>
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            {overview.profitFactor === Infinity ? '∞' : overview.profitFactor.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-2">Gross Profit / Gross Loss</p>
        </div>

        <div className="bg-[#0a0a0f] p-5 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all group">
          <div className="flex justify-between items-start mb-2">
            <p className="text-gray-400 text-sm font-medium">Avg PnL</p>
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <BarChart3 className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <p className={`text-2xl font-bold ${overview.avgPnl >= 0 ? 'text-white' : 'text-red-400'}`}>
            ${overview.avgPnl.toFixed(2)}
          </p>
          <p className="text-xs text-gray-500 mt-2">Per trade average</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Equity Curve */}
        <div className="lg:col-span-2 bg-[#0a0a0f] p-6 rounded-xl border border-white/5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              Equity Curve
            </h3>
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-white/5 rounded text-[10px] text-gray-400 uppercase tracking-wider">Historical Performance</span>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={equityCurveData}>
                <defs>
                  <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis 
                  dataKey="time" 
                  stroke="#ffffff20" 
                  fontSize={10}
                  tickFormatter={(val) => val.split(' ')[0]}
                />
                <YAxis stroke="#ffffff20" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0f', borderColor: '#ffffff10', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: '#fff' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="equity" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorEquity)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Market Conditions */}
        <div className="bg-[#0a0a0f] p-6 rounded-xl border border-white/5">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            Optimal Conditions
          </h3>
          <div className="space-y-4">
            <div className="p-4 bg-white/5 rounded-lg border border-white/5 flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-full">
                <Target className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Best Trend</p>
                <p className="text-white font-bold">{analytics.marketConditions.bestTrend}</p>
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-lg border border-white/5 flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-full">
                <Zap className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Volatility</p>
                <p className="text-white font-bold">{analytics.marketConditions.bestVolatility}</p>
              </div>
            </div>

            <div className="p-4 bg-white/5 rounded-lg border border-white/5 flex items-center gap-4">
              <div className="p-3 bg-purple-500/10 rounded-full">
                <PieIcon className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Sentiment</p>
                <p className="text-white font-bold">{analytics.marketConditions.bestSentiment}</p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-500/5 rounded-xl border border-blue-500/10">
              <div className="flex gap-2 text-blue-400 mb-2">
                <Info className="w-4 h-4" />
                <p className="text-xs font-bold uppercase tracking-wider">AI Insight</p>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                The model is showing {analytics.overview.overallWinRate > 50 ? 'positive' : 'adaptive'} expectancy in {analytics.marketConditions.bestTrend.toLowerCase()} markets with {analytics.marketConditions.bestVolatility.toLowerCase()} volatility.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pattern Performance Table */}
        <div className="bg-[#0a0a0f] p-6 rounded-xl border border-white/5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              Pattern Performance
            </h3>
          </div>
          <div className="overflow-hidden border border-white/5 rounded-lg">
            <table className="w-full text-left">
              <thead className="bg-white/5">
                <tr>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider">Pattern</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Trades</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Win %</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Net PnL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {analytics.byPattern.map((p, i) => (
                  <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${p.winRate > 60 ? 'bg-green-500' : p.winRate > 40 ? 'bg-amber-500' : 'bg-red-500'}`} />
                        <span className="text-white font-medium text-sm">{p.patternName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400 text-sm">{p.totalTrades}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-sm font-bold ${p.winRate > 50 ? 'text-green-400' : 'text-red-400'}`}>
                        {p.winRate.toFixed(1)}%
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-right text-sm font-bold ${p.totalPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${p.totalPnl.toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Confidence Calibration */}
        <div className="bg-[#0a0a0f] p-6 rounded-xl border border-white/5">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-400" />
              Confidence Calibration
            </h3>
            <div className="flex gap-2">
              <span className="px-2 py-1 bg-white/5 rounded text-[10px] text-gray-400 uppercase tracking-wider">Reliability Analysis</span>
            </div>
          </div>
          <div className="h-[250px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.byConfidence}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                <XAxis dataKey="confidenceRange" stroke="#ffffff20" fontSize={10} />
                <YAxis stroke="#ffffff20" fontSize={10} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0a0a0f', borderColor: '#ffffff10', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend iconType="circle" />
                <Bar name="Actual Win Rate" dataKey="actualWinRate" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar name="Expected Win Rate" dataKey="expectedWinRate" fill="#ffffff10" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex items-center gap-2 p-3 bg-white/5 rounded-lg">
            <Info className="w-4 h-4 text-blue-400" />
            <p className="text-[11px] text-gray-400">
              Compares the AI's predicted confidence vs. the actual win rate for trades in that range. Ideally, these should be equal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
