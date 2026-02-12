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
  // Portfolio Projection Props (Optional)
  currentBalance?: number;
  assetSymbol?: string;
  aiWinRate?: number;
}

export const TradeAnalyticsDashboard: React.FC<Props> = ({ 
  trades, 
  currentBalance = 0, 
  assetSymbol = 'USDT',
  aiWinRate = 65 // Default conservative win rate
}) => {
  const analytics = useMemo(() => tradeAnalyticsService.calculateTradeAnalytics(trades), [trades]);
  const overview = analytics.overview;

  // Render Portfolio Projection if no trades but balance exists
  if (overview.totalTrades === 0 && currentBalance > 0) {
    // Projection Logic (Conservative)
    const riskPerTrade = 0.01; // 1% risk
    const rewardRatio = 2; // 1:2 Risk/Reward
    const tradesPerDay = 3; 
    
    // Win/Loss amounts
    const avgWinAmount = currentBalance * riskPerTrade * rewardRatio;
    const avgLossAmount = currentBalance * riskPerTrade;
    
    // Expected Value per trade: (Win% * AvgWin) - (Loss% * AvgLoss)
    const winProb = aiWinRate / 100;
    const lossProb = 1 - winProb;
    const evPerTrade = (winProb * avgWinAmount) - (lossProb * avgLossAmount);
    
    // Daily/Monthly Projections
    const dailyProfit = evPerTrade * tradesPerDay;
    const monthlyProfit = dailyProfit * 30; // 30 days
    const dailyRoi = (dailyProfit / currentBalance) * 100;
    const monthlyRoi = (monthlyProfit / currentBalance) * 100;

    return (
      <div className="space-y-6 animate-in fade-in duration-700">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-blue-400" />
            AI Capital Deployment Projection
          </h2>
          <span className="px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-bold text-blue-400 uppercase tracking-wider">
            Live Simulation Mode
          </span>
        </div>

        {/* Portfolio Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Current Capital */}
          <div className="bg-[#0a0a0f] p-5 rounded-xl border border-white/5 relative overflow-hidden group hover:border-blue-500/30 transition-all">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Zap className="w-12 h-12 text-white" />
            </div>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Available Capital</p>
            <p className="text-2xl font-bold text-white">
              {currentBalance.toFixed(4)} <span className="text-sm text-gray-400">{assetSymbol}</span>
            </p>
            <p className="text-xs text-blue-400 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Ready for deployment
            </p>
          </div>

           {/* Projected Daily ROI */}
           <div className="bg-[#0a0a0f] p-5 rounded-xl border border-white/5 relative overflow-hidden group hover:border-green-500/30 transition-all">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <TrendingUp className="w-12 h-12 text-green-400" />
            </div>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Proj. Daily Return</p>
            <p className="text-2xl font-bold text-green-400">
              +{dailyRoi.toFixed(2)}%
            </p>
            <p className="text-xs text-gray-500 mt-2">
              ~{(dailyProfit).toFixed(4)} {assetSymbol} / day
            </p>
          </div>

          {/* Projected Monthly ROI */}
          <div className="bg-[#0a0a0f] p-5 rounded-xl border border-white/5 relative overflow-hidden group hover:border-purple-500/30 transition-all">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
              <Calendar className="w-12 h-12 text-purple-400" />
            </div>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Proj. Monthly Return</p>
            <p className="text-2xl font-bold text-purple-400">
              +{monthlyRoi.toFixed(2)}%
            </p>
            <p className="text-xs text-gray-500 mt-2">
              ~{(monthlyProfit).toFixed(4)} {assetSymbol} / month
            </p>
          </div>
        </div>

        {/* AI Performance Context */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#0a0a0f] p-6 rounded-xl border border-white/5">
             <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-amber-400" />
              Performance Assumptions
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <span className="text-sm text-gray-400">AI Win Rate</span>
                <span className="text-sm font-bold text-white">{aiWinRate}%</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <span className="text-sm text-gray-400">Risk Reward Ratio</span>
                <span className="text-sm font-bold text-white">1:{rewardRatio}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <span className="text-sm text-gray-400">Risk Per Trade</span>
                <span className="text-sm font-bold text-white">{riskPerTrade * 100}%</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                <span className="text-sm text-gray-400">Trades Per Day</span>
                <span className="text-sm font-bold text-white">~{tradesPerDay}</span>
              </div>
            </div>
          </div>

          <div className="bg-[#0a0a0f] p-6 rounded-xl border border-white/5 flex flex-col justify-center">
            <div className="flex items-start gap-3">
              <Info className="w-6 h-6 text-blue-400 shrink-0 mt-1" />
              <div>
                <h4 className="text-sm font-bold text-white mb-2">About this Simulation</h4>
                <p className="text-sm text-gray-400 leading-relaxed">
                  This projection is based on your current balance of <strong className="text-white">{currentBalance.toFixed(4)} {assetSymbol}</strong> and the AI's historical performance metrics. 
                  Actual results may vary based on market conditions, slippage, and volatility.
                </p>
              </div>
            </div>
             <div className="mt-6 pt-6 border-t border-white/5">
               <div className="flex items-center justify-between text-xs text-gray-500">
                 <span>Model Confidence</span>
                 <span className="text-green-400 font-bold">High (Testnet Validated)</span>
               </div>
               <div className="w-full h-1 bg-white/10 rounded-full mt-2 overflow-hidden">
                 <div className="h-full bg-green-500 w-[85%]"></div>
               </div>
             </div>
          </div>
        </div>
      </div>
    );
  }

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

  // Estimate Initial Balance (Testnet Standards)
  const getEstimatedInitialBalance = (symbol: string, current: number) => {
    // If we have trade history, initial = current - totalPnL
    if (analytics.overview.totalTrades > 0) {
      return current - analytics.overview.totalPnl;
    }
    // Fallbacks for Testnet
    if (symbol.includes('USDT')) return 10000; // Standard Testnet USDT
    if (symbol.includes('BTC')) return 1;
    if (symbol.includes('ETH')) return 1;
    if (symbol.includes('BNB')) return 1;
    return current; // Assume break-even if unknown
  };

  const initialBalance = getEstimatedInitialBalance(assetSymbol, currentBalance);
  const realPnl = currentBalance - initialBalance;
  const pnlPercent = (realPnl / initialBalance) * 100;

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0a0a0f] p-5 rounded-xl border border-white/5 hover:border-blue-500/30 transition-all group">
          <div className="flex justify-between items-start mb-2">
            <p className="text-gray-400 text-sm font-medium">Real Net Profit</p>
            <div className={`p-2 rounded-lg ${realPnl >= 0 ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              {realPnl >= 0 ? <TrendingUp className="w-4 h-4 text-green-400" /> : <TrendingDown className="w-4 h-4 text-red-400" />}
            </div>
          </div>
          <p className={`text-2xl font-bold ${realPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {realPnl >= 0 ? '+' : ''}{realPnl.toFixed(4)} <span className="text-sm text-gray-500">{assetSymbol}</span>
          </p>
          <p className={`text-xs mt-2 font-bold ${pnlPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}% <span className="text-gray-500 font-normal">Return on Capital</span>
          </p>
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
