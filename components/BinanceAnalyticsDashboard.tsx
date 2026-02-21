/**
 * Binance Analytics Dashboard
 * Premium dark-themed analytics showing ONLY Binance API data.
 * Includes AI Readiness Gauge, Equity Curve, KPI Cards, and Trade Table.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    X, RefreshCw, TrendingUp, TrendingDown, Target, BarChart3,
    Shield, Zap, Award, Activity, AlertTriangle, CheckCircle,
    ChevronDown, ChevronUp, Flame, Coins
} from 'lucide-react';
import {
    ResponsiveContainer, LineChart, Line, BarChart, Bar,
    XAxis, YAxis, Tooltip, CartesianGrid, Area, AreaChart,
    Cell, PieChart, Pie
} from 'recharts';
import { fetchBinanceAnalytics, PerformanceMetrics } from '../services/binanceAnalyticsService';

interface Props {
    symbol?: string;
    onClose: () => void;
}

const BinanceAnalyticsDashboard: React.FC<Props> = ({ symbol, onClose }) => {
    const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterSymbol, setFilterSymbol] = useState(symbol || '');
    const [showAllTrades, setShowAllTrades] = useState(false);

    const loadAnalytics = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await fetchBinanceAnalytics(filterSymbol || undefined);
            setMetrics(data);
        } catch (err: any) {
            setError(err.message || 'Failed to load analytics');
        } finally {
            setIsLoading(false);
        }
    }, [filterSymbol]);

    useEffect(() => {
        loadAnalytics();
    }, [loadAnalytics]);

    // AI Readiness color
    const getReadinessColor = (score: number) => {
        if (score >= 75) return { bg: 'from-emerald-500/20 to-emerald-600/5', text: 'text-emerald-400', ring: 'stroke-emerald-500', glow: 'shadow-emerald-500/20' };
        if (score >= 55) return { bg: 'from-amber-500/20 to-amber-600/5', text: 'text-amber-400', ring: 'stroke-amber-500', glow: 'shadow-amber-500/20' };
        if (score >= 35) return { bg: 'from-orange-500/20 to-orange-600/5', text: 'text-orange-400', ring: 'stroke-orange-500', glow: 'shadow-orange-500/20' };
        return { bg: 'from-rose-500/20 to-rose-600/5', text: 'text-rose-400', ring: 'stroke-rose-500', glow: 'shadow-rose-500/20' };
    };

    // Format number
    const fmt = (n: number, decimals = 2) => {
        if (Math.abs(n) >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
        return n.toFixed(decimals);
    };

    // SVG Gauge
    const GaugeChart: React.FC<{ score: number; size?: number }> = ({ score, size = 180 }) => {
        const colors = getReadinessColor(score);
        const radius = (size - 20) / 2;
        const circumference = Math.PI * radius; // Semi-circle
        const progress = (score / 100) * circumference;
        const cx = size / 2;
        const cy = size / 2 + 10;

        return (
            <svg width={size} height={size / 2 + 30} viewBox={`0 0 ${size} ${size / 2 + 30}`}>
                {/* Background arc */}
                <path
                    d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
                    fill="none"
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth="12"
                    strokeLinecap="round"
                />
                {/* Progress arc */}
                <path
                    d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
                    fill="none"
                    className={colors.ring}
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${progress} ${circumference}`}
                    style={{ transition: 'stroke-dasharray 1s ease-out' }}
                />
                {/* Score text */}
                <text x={cx} y={cy - 15} textAnchor="middle" className="fill-white text-3xl font-black"
                    style={{ fontSize: '36px', fontWeight: 900 }}>
                    {score}
                </text>
                <text x={cx} y={cy + 5} textAnchor="middle" className="fill-slate-500 text-xs"
                    style={{ fontSize: '11px' }}>
                    / 100
                </text>
            </svg>
        );
    };

    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center py-20">
                <div className="text-center space-y-4">
                    <RefreshCw className="w-10 h-10 text-blue-400 animate-spin mx-auto" />
                    <p className="text-slate-400 text-sm font-medium">Loading Binance Analytics...</p>
                    <p className="text-slate-600 text-xs">Fetching trade history & income data</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 flex items-center justify-center py-20">
                <div className="bg-slate-900 border border-rose-500/30 rounded-2xl p-8 max-w-md text-center space-y-4">
                    <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
                    <h3 className="text-white font-bold text-lg">Failed to Load Analytics</h3>
                    <p className="text-slate-400 text-sm">{error}</p>
                    <div className="flex gap-3 justify-center">
                        <button onClick={loadAnalytics} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold">
                            Retry
                        </button>
                        <button onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-bold">
                            Back to Terminal
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!metrics) return null;

    const readinessColors = getReadinessColor(metrics.aiReadinessScore);
    const visibleTrades = showAllTrades ? metrics.trades.slice(0, 100) : metrics.trades.slice(0, 15);

    return (
        <div className="flex-1 overflow-y-auto pb-20">
            {/* Header Row */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-violet-500/20 to-blue-500/20 rounded-xl border border-violet-500/20">
                        <BarChart3 className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-white font-black text-lg tracking-tight">Trade Analytics</h1>
                        <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider">Binance Futures • Live Data</p>
                    </div>
                </div>
                <button
                    onClick={loadAnalytics}
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all"
                    title="Refresh"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            <div className="space-y-4">
                {/* Row 1: AI Readiness + Account Overview */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* AI Readiness Gauge */}
                    <div className={`bg-gradient-to-br ${readinessColors.bg} border border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center shadow-xl ${readinessColors.glow}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <Award className="w-4 h-4 text-slate-400" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">AI Readiness</span>
                        </div>
                        <GaugeChart score={metrics.aiReadinessScore} />
                        <span className={`text-sm font-black mt-1 ${readinessColors.text}`}>
                            {metrics.aiReadinessVerdict}
                        </span>

                        {/* Factor breakdown */}
                        <div className="w-full mt-4 space-y-2">
                            {metrics.aiReadinessFactors.map((f, i) => (
                                <div key={i} className="flex items-center gap-2">
                                    <span className="text-[10px] text-slate-500 w-20 shrink-0 font-bold">{f.name}</span>
                                    <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-700 ${f.score >= 70 ? 'bg-emerald-500' : f.score >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                            style={{ width: `${Math.min(100, f.score)}%` }}
                                        />
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-mono w-8 text-right">{Math.round(f.score)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Account Overview */}
                    <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {/* Wallet Balance */}
                        <KPICard
                            icon={<Coins className="w-4 h-4" />}
                            label="Wallet Balance"
                            value={`$${fmt(metrics.walletBalance)}`}
                            color="text-white"
                            bgColor="bg-slate-800/50"
                        />
                        {/* Total PnL */}
                        <KPICard
                            icon={metrics.totalPnl >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            label="Total Realized PnL"
                            value={`${metrics.totalPnl >= 0 ? '+' : ''}$${fmt(metrics.totalPnl)}`}
                            color={metrics.totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                            bgColor={metrics.totalPnl >= 0 ? 'bg-emerald-500/5' : 'bg-rose-500/5'}
                        />
                        {/* Win Rate */}
                        <KPICard
                            icon={<Target className="w-4 h-4" />}
                            label="Win Rate"
                            value={`${metrics.winRate.toFixed(1)}%`}
                            sub={`${metrics.trades.filter(t => t.realizedPnl > 0).length}W / ${metrics.trades.filter(t => t.realizedPnl < 0).length}L`}
                            color={metrics.winRate >= 50 ? 'text-emerald-400' : 'text-rose-400'}
                            bgColor={metrics.winRate >= 50 ? 'bg-emerald-500/5' : 'bg-rose-500/5'}
                        />
                        {/* Profit Factor */}
                        <KPICard
                            icon={<Shield className="w-4 h-4" />}
                            label="Profit Factor"
                            value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
                            color={metrics.profitFactor >= 1.5 ? 'text-emerald-400' : metrics.profitFactor >= 1 ? 'text-amber-400' : 'text-rose-400'}
                            bgColor="bg-slate-800/50"
                        />
                        {/* Avg Return */}
                        <KPICard
                            icon={<Activity className="w-4 h-4" />}
                            label="Avg Return/Trade"
                            value={`${metrics.avgReturn >= 0 ? '+' : ''}$${fmt(metrics.avgReturn)}`}
                            color={metrics.avgReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                            bgColor="bg-slate-800/50"
                        />
                        {/* Max Drawdown */}
                        <KPICard
                            icon={<AlertTriangle className="w-4 h-4" />}
                            label="Max Drawdown"
                            value={`${metrics.maxDrawdown.toFixed(1)}%`}
                            color={metrics.maxDrawdown < 10 ? 'text-emerald-400' : metrics.maxDrawdown < 25 ? 'text-amber-400' : 'text-rose-400'}
                            bgColor="bg-slate-800/50"
                        />
                    </div>
                </div>

                {/* Row 2: Equity Curve */}
                {metrics.equityCurve.length > 0 && (
                    <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-blue-400" />
                                <h3 className="text-sm font-black text-white uppercase tracking-wider">Equity Curve</h3>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${metrics.totalPnl >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                {metrics.totalPnl >= 0 ? '+' : ''}{fmt(metrics.totalPnl)} USDT
                            </span>
                        </div>
                        <div className="h-52">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={metrics.equityCurve}>
                                    <defs>
                                        <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={metrics.totalPnl >= 0 ? '#10b981' : '#f43f5e'} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={metrics.totalPnl >= 0 ? '#10b981' : '#f43f5e'} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                                    <XAxis
                                        dataKey="time"
                                        tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        stroke="rgba(255,255,255,0.1)"
                                        tick={{ fill: '#64748b', fontSize: 10 }}
                                    />
                                    <YAxis
                                        stroke="rgba(255,255,255,0.1)"
                                        tick={{ fill: '#64748b', fontSize: 10 }}
                                        tickFormatter={(v) => `$${v.toFixed(0)}`}
                                    />
                                    <Tooltip
                                        contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }}
                                        labelFormatter={(v) => new Date(v).toLocaleString()}
                                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Equity']}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="equity"
                                        stroke={metrics.totalPnl >= 0 ? '#10b981' : '#f43f5e'}
                                        strokeWidth={2}
                                        fill="url(#equityGrad)"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

                {/* Row 3: Daily PnL + Extra Stats */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Daily PnL Chart */}
                    {metrics.dailyPnl.length > 0 && (
                        <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800/50 rounded-2xl p-5">
                            <div className="flex items-center gap-2 mb-4">
                                <BarChart3 className="w-4 h-4 text-violet-400" />
                                <h3 className="text-sm font-black text-white uppercase tracking-wider">Daily PnL</h3>
                            </div>
                            <div className="h-44">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={metrics.dailyPnl}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(v) => {
                                                const d = new Date(v);
                                                return `${d.getMonth() + 1}/${d.getDate()}`;
                                            }}
                                            stroke="rgba(255,255,255,0.1)"
                                            tick={{ fill: '#64748b', fontSize: 10 }}
                                        />
                                        <YAxis
                                            stroke="rgba(255,255,255,0.1)"
                                            tick={{ fill: '#64748b', fontSize: 10 }}
                                            tickFormatter={(v) => `$${v}`}
                                        />
                                        <Tooltip
                                            contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '12px', fontSize: '12px' }}
                                            formatter={(value: number) => [`$${value.toFixed(2)}`, 'PnL']}
                                        />
                                        <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                                            {metrics.dailyPnl.map((entry, i) => (
                                                <Cell
                                                    key={i}
                                                    fill={entry.pnl >= 0 ? '#10b981' : '#f43f5e'}
                                                    fillOpacity={0.8}
                                                />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* Detailed Stats */}
                    <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                            <Flame className="w-4 h-4 text-orange-400" />
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">Details</h3>
                        </div>

                        <StatRow label="Total Trades" value={metrics.totalTrades.toString()} />
                        <StatRow label="Best Trade" value={`+$${fmt(metrics.bestTrade)}`} color="text-emerald-400" />
                        <StatRow label="Worst Trade" value={`$${fmt(metrics.worstTrade)}`} color="text-rose-400" />
                        <StatRow label="Avg Win" value={`+$${fmt(metrics.avgWin)}`} color="text-emerald-400" />
                        <StatRow label="Avg Loss" value={`-$${fmt(metrics.avgLoss)}`} color="text-rose-400" />
                        <div className="border-t border-slate-800 pt-2"></div>
                        <StatRow label="Win Streak" value={`${metrics.winStreak} 🔥`} />
                        <StatRow label="Loss Streak" value={`${metrics.lossStreak}`} />
                        <StatRow
                            label="Current Streak"
                            value={`${metrics.currentStreak.count} ${metrics.currentStreak.type}`}
                            color={metrics.currentStreak.type === 'WIN' ? 'text-emerald-400' : metrics.currentStreak.type === 'LOSS' ? 'text-rose-400' : 'text-slate-400'}
                        />
                        <div className="border-t border-slate-800 pt-2"></div>
                        <StatRow label="Commissions" value={`-$${fmt(metrics.totalCommissions)}`} color="text-amber-400" />
                        <StatRow label="Funding Fees" value={`${metrics.totalFundingFees >= 0 ? '+' : ''}$${fmt(metrics.totalFundingFees)}`} color={metrics.totalFundingFees >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
                        <StatRow label="Net PnL" value={`${metrics.netPnl >= 0 ? '+' : ''}$${fmt(metrics.netPnl)}`} color={metrics.netPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'} bold />
                    </div>
                </div>

                {/* Row 4: Trade History Table */}
                <div className="bg-slate-900/50 border border-slate-800/50 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Activity className="w-4 h-4 text-cyan-400" />
                            <h3 className="text-sm font-black text-white uppercase tracking-wider">Trade History</h3>
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-bold">
                                {metrics.trades.filter(t => t.realizedPnl !== 0).length} closed
                            </span>
                        </div>
                    </div>

                    {metrics.trades.length === 0 ? (
                        <div className="py-12 text-center">
                            <BarChart3 className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                            <p className="text-slate-500 text-sm font-medium">No trade history found</p>
                            <p className="text-slate-600 text-xs mt-1">Start trading on Binance Futures to see analytics here</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="border-b border-slate-800">
                                            <th className="text-left text-slate-500 font-bold pb-2 pr-3">Date</th>
                                            <th className="text-left text-slate-500 font-bold pb-2 pr-3">Symbol</th>
                                            <th className="text-left text-slate-500 font-bold pb-2 pr-3">Side</th>
                                            <th className="text-right text-slate-500 font-bold pb-2 pr-3">Price</th>
                                            <th className="text-right text-slate-500 font-bold pb-2 pr-3">Qty</th>
                                            <th className="text-right text-slate-500 font-bold pb-2 pr-3">Realized PnL</th>
                                            <th className="text-right text-slate-500 font-bold pb-2">Fee</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleTrades.map((trade, idx) => (
                                            <tr key={idx} className="border-b border-slate-800/30 hover:bg-slate-800/20 transition-colors">
                                                <td className="py-2 pr-3 text-slate-400 font-mono whitespace-nowrap">
                                                    {new Date(trade.time).toLocaleString('en-US', {
                                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                    })}
                                                </td>
                                                <td className="py-2 pr-3 text-white font-bold">{trade.symbol}</td>
                                                <td className="py-2 pr-3">
                                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${trade.side === 'BUY'
                                                            ? 'bg-emerald-500/15 text-emerald-400'
                                                            : 'bg-rose-500/15 text-rose-400'
                                                        }`}>
                                                        {trade.side}
                                                    </span>
                                                </td>
                                                <td className="py-2 pr-3 text-right text-slate-300 font-mono">${fmt(trade.price)}</td>
                                                <td className="py-2 pr-3 text-right text-slate-400 font-mono">{trade.qty.toFixed(4)}</td>
                                                <td className={`py-2 pr-3 text-right font-mono font-bold ${trade.realizedPnl > 0 ? 'text-emerald-400' : trade.realizedPnl < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                                                    {trade.realizedPnl !== 0 ? `${trade.realizedPnl > 0 ? '+' : ''}$${fmt(trade.realizedPnl)}` : '-'}
                                                </td>
                                                <td className="py-2 text-right text-amber-400/70 font-mono">
                                                    ${trade.commission.toFixed(4)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {metrics.trades.length > 15 && (
                                <button
                                    onClick={() => setShowAllTrades(!showAllTrades)}
                                    className="w-full mt-3 py-2 text-xs text-slate-400 hover:text-white bg-slate-800/30 hover:bg-slate-800/60 rounded-lg flex items-center justify-center gap-1 transition-all font-bold"
                                >
                                    {showAllTrades ? (
                                        <><ChevronUp className="w-3 h-3" /> Show Less</>
                                    ) : (
                                        <><ChevronDown className="w-3 h-3" /> Show All ({metrics.trades.length} trades)</>
                                    )}
                                </button>
                            )}
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="text-center pb-6">
                    <p className="text-slate-600 text-[10px] font-bold uppercase tracking-[0.2em]">
                        Data sourced exclusively from Binance Futures API
                    </p>
                </div>
            </div>
        </div>
    );
};

// --- Sub-components ---

const KPICard: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: string;
    sub?: string;
    color?: string;
    bgColor?: string;
}> = ({ icon, label, value, sub, color = 'text-white', bgColor = 'bg-slate-800/50' }) => (
    <div className={`${bgColor} border border-white/5 rounded-xl p-4 transition-all hover:border-white/10`}>
        <div className="flex items-center gap-1.5 text-slate-500 mb-2">
            {icon}
            <span className="text-[10px] font-black uppercase tracking-wider">{label}</span>
        </div>
        <p className={`text-xl font-black font-mono ${color}`}>{value}</p>
        {sub && <p className="text-[10px] text-slate-500 mt-0.5 font-bold">{sub}</p>}
    </div>
);

const StatRow: React.FC<{
    label: string;
    value: string;
    color?: string;
    bold?: boolean;
}> = ({ label, value, color = 'text-white', bold = false }) => (
    <div className="flex justify-between items-center">
        <span className="text-[11px] text-slate-500 font-medium">{label}</span>
        <span className={`text-[11px] font-mono ${color} ${bold ? 'font-black' : 'font-semibold'}`}>{value}</span>
    </div>
);

export default BinanceAnalyticsDashboard;
