/**
 * Binance Analytics Service
 * Fetches ONLY Binance API data and computes trading performance metrics.
 * Used by the BinanceAnalyticsDashboard component.
 */

import { getTradeHistory, getIncomeHistory, getAccountInfo } from './binanceTradingService';

// --- TYPES ---

export interface TradeRecord {
    id: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    price: number;
    qty: number;
    quoteQty: number;
    realizedPnl: number;
    commission: number;
    commissionAsset: string;
    time: number;
    buyer: boolean;
    maker: boolean;
    positionSide: string;
}

export interface IncomeRecord {
    symbol: string;
    incomeType: string;
    income: number;
    asset: string;
    time: number;
    info: string;
    tranId: number;
    tradeId: string;
}

export interface DailyPnl {
    date: string;
    pnl: number;
    trades: number;
    wins: number;
    losses: number;
}

export interface PerformanceMetrics {
    // Core KPIs
    totalTrades: number;
    winRate: number;
    totalPnl: number;
    avgReturn: number;
    profitFactor: number;
    maxDrawdown: number;

    // Detail metrics
    grossProfit: number;
    grossLoss: number;
    avgWin: number;
    avgLoss: number;
    bestTrade: number;
    worstTrade: number;
    winStreak: number;
    lossStreak: number;
    currentStreak: { type: 'WIN' | 'LOSS' | 'NONE'; count: number };

    // Financial
    totalCommissions: number;
    totalFundingFees: number;
    netPnl: number; // totalPnl - commissions - funding

    // Equity curve
    equityCurve: { time: number; equity: number; pnl: number }[];
    dailyPnl: DailyPnl[];

    // Account
    walletBalance: number;
    unrealizedPnl: number;
    marginBalance: number;

    // Raw data
    trades: TradeRecord[];
    incomeRecords: IncomeRecord[];

    // AI Readiness
    aiReadinessScore: number;
    aiReadinessVerdict: string;
    aiReadinessFactors: { name: string; score: number; weight: number; detail: string }[];
}

// --- FETCH & COMPUTE ---

/**
 * Fetch all data from Binance and compute analytics
 */
export async function fetchBinanceAnalytics(symbol?: string): Promise<PerformanceMetrics> {
    // Fetch data in parallel
    const [rawTrades, incomeData, accountInfo] = await Promise.all([
        fetchAllTrades(symbol),
        fetchAllIncome(symbol),
        getAccountInfo().catch(() => null)
    ]);

    // Parse trades
    const trades: TradeRecord[] = rawTrades.map((t: any) => ({
        id: t.id?.toString() || t.orderId?.toString(),
        symbol: t.symbol,
        side: t.side,
        price: parseFloat(t.price),
        qty: parseFloat(t.qty),
        quoteQty: parseFloat(t.quoteQty || '0'),
        realizedPnl: parseFloat(t.realizedPnl || '0'),
        commission: parseFloat(t.commission || '0'),
        commissionAsset: t.commissionAsset || 'USDT',
        time: t.time,
        buyer: t.buyer,
        maker: t.maker,
        positionSide: t.positionSide || 'BOTH'
    }));

    // Parse income
    const incomeRecords: IncomeRecord[] = incomeData.map((i: any) => ({
        symbol: i.symbol,
        incomeType: i.incomeType,
        income: parseFloat(i.income || '0'),
        asset: i.asset,
        time: i.time,
        info: i.info || '',
        tranId: i.tranId,
        tradeId: i.tradeId || ''
    }));

    // Account info
    const walletBalance = accountInfo?.totalWalletBalance ? parseFloat(accountInfo.totalWalletBalance) : 0;
    const unrealizedPnl = accountInfo?.totalUnrealizedProfit ? parseFloat(accountInfo.totalUnrealizedProfit) : 0;
    const marginBalance = accountInfo?.totalMarginBalance ? parseFloat(accountInfo.totalMarginBalance) : 0;

    // Compute metrics
    return computeMetrics(trades, incomeRecords, walletBalance, unrealizedPnl, marginBalance);
}

/**
 * Fetch trades across multiple symbols if needed
 */
async function fetchAllTrades(symbol?: string): Promise<any[]> {
    if (symbol) {
        return await getTradeHistory(symbol, 1000);
    }

    // Fetch for common symbols
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT'];
    const allTrades: any[] = [];

    for (const sym of symbols) {
        try {
            const trades = await getTradeHistory(sym, 500);
            if (trades.length > 0) {
                allTrades.push(...trades);
            }
        } catch {
            // Skip symbols with no trades
        }
    }

    // Sort by time, newest first
    allTrades.sort((a, b) => b.time - a.time);
    return allTrades;
}

/**
 * Fetch income across multiple symbols if needed
 */
async function fetchAllIncome(symbol?: string): Promise<any[]> {
    if (symbol) {
        return await getIncomeHistory({ symbol, limit: 1000 });
    }
    // Fetch all income regardless of symbol
    return await getIncomeHistory({ limit: 1000 });
}

// --- COMPUTATION ENGINE ---

function computeMetrics(
    trades: TradeRecord[],
    incomeRecords: IncomeRecord[],
    walletBalance: number,
    unrealizedPnl: number,
    marginBalance: number
): PerformanceMetrics {
    // Filter trades with realized PnL (closed positions)
    const closedTrades = trades.filter(t => t.realizedPnl !== 0);

    // Sort by time ascending for equity curve
    const sortedTrades = [...closedTrades].sort((a, b) => a.time - b.time);

    // Win/Loss
    const wins = sortedTrades.filter(t => t.realizedPnl > 0);
    const losses = sortedTrades.filter(t => t.realizedPnl < 0);

    const totalTrades = sortedTrades.length;
    const winRate = totalTrades > 0 ? (wins.length / totalTrades) * 100 : 0;

    // PnL
    const grossProfit = wins.reduce((sum, t) => sum + t.realizedPnl, 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.realizedPnl, 0));
    const totalPnl = grossProfit - grossLoss;
    const avgReturn = totalTrades > 0 ? totalPnl / totalTrades : 0;
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    // Best/Worst
    const bestTrade = wins.length > 0 ? Math.max(...wins.map(t => t.realizedPnl)) : 0;
    const worstTrade = losses.length > 0 ? Math.min(...losses.map(t => t.realizedPnl)) : 0;
    const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
    const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;

    // Streaks
    let winStreak = 0, lossStreak = 0, currentWin = 0, currentLoss = 0;
    let lastOutcome: 'WIN' | 'LOSS' | 'NONE' = 'NONE';
    let lastCount = 0;

    for (const trade of sortedTrades) {
        if (trade.realizedPnl > 0) {
            currentWin++;
            currentLoss = 0;
            winStreak = Math.max(winStreak, currentWin);
            lastOutcome = 'WIN';
            lastCount = currentWin;
        } else {
            currentLoss++;
            currentWin = 0;
            lossStreak = Math.max(lossStreak, currentLoss);
            lastOutcome = 'LOSS';
            lastCount = currentLoss;
        }
    }

    // Equity Curve
    // Establish a baseline starting balance to avoid artifact drawdown > 100%
    const startingBalance = walletBalance - totalPnl;
    const baseEquity = startingBalance > 0 ? startingBalance : 1000; // fallback to 1000 if negative
    
    let cumPnl = 0;
    const equityCurve = sortedTrades.map(t => {
        cumPnl += t.realizedPnl;
        return { time: t.time, equity: baseEquity + cumPnl, pnl: t.realizedPnl };
    });

    // Max Drawdown
    let peak = 0, maxDrawdown = 0;
    for (const point of equityCurve) {
        if (point.equity > peak) peak = point.equity;
        const drawdown = peak > 0 ? ((peak - point.equity) / peak) * 100 : 0;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }

    // Daily PnL
    const dailyMap = new Map<string, DailyPnl>();
    for (const trade of sortedTrades) {
        const date = new Date(trade.time).toISOString().split('T')[0];
        const existing = dailyMap.get(date) || { date, pnl: 0, trades: 0, wins: 0, losses: 0 };
        existing.pnl += trade.realizedPnl;
        existing.trades++;
        if (trade.realizedPnl > 0) existing.wins++;
        else existing.losses++;
        dailyMap.set(date, existing);
    }
    const dailyPnl = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Commissions & Funding
    const totalCommissions = trades.reduce((sum, t) => sum + t.commission, 0);
    const fundingIncome = incomeRecords.filter(i => i.incomeType === 'FUNDING_FEE');
    const totalFundingFees = fundingIncome.reduce((sum, i) => sum + i.income, 0);
    const netPnl = totalPnl - totalCommissions + totalFundingFees;

    // AI Readiness Score
    const { score, verdict, factors } = computeAIReadiness(
        winRate, profitFactor, maxDrawdown, totalTrades, avgReturn, dailyPnl
    );

    return {
        totalTrades,
        winRate,
        totalPnl,
        avgReturn,
        profitFactor,
        maxDrawdown,
        grossProfit,
        grossLoss,
        avgWin,
        avgLoss,
        bestTrade,
        worstTrade,
        winStreak,
        lossStreak,
        currentStreak: { type: lastOutcome, count: lastCount },
        totalCommissions,
        totalFundingFees,
        netPnl,
        equityCurve,
        dailyPnl,
        walletBalance,
        unrealizedPnl,
        marginBalance,
        trades,
        incomeRecords,
        aiReadinessScore: score,
        aiReadinessVerdict: verdict,
        aiReadinessFactors: factors
    };
}

// --- AI READINESS SCORE ---

function computeAIReadiness(
    winRate: number,
    profitFactor: number,
    maxDrawdown: number,
    totalTrades: number,
    avgReturn: number,
    dailyPnl: DailyPnl[]
): { score: number; verdict: string; factors: { name: string; score: number; weight: number; detail: string }[] } {
    const factors: { name: string; score: number; weight: number; detail: string }[] = [];

    // 1. Win Rate (weight: 25%) — Target: >55%
    const wrScore = Math.min(100, Math.max(0, (winRate / 65) * 100));
    factors.push({
        name: 'Win Rate',
        score: wrScore,
        weight: 25,
        detail: `${winRate.toFixed(1)}% (target >55%)`
    });

    // 2. Profit Factor (weight: 25%) — Target: >1.5
    const pfScore = profitFactor === Infinity ? 100
        : Math.min(100, Math.max(0, (profitFactor / 2.0) * 100));
    factors.push({
        name: 'Profit Factor',
        score: pfScore,
        weight: 25,
        detail: `${profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)} (target >1.5)`
    });

    // 3. Max Drawdown (weight: 20%) — Target: <15%
    const ddScore = maxDrawdown === 0 ? 100
        : Math.min(100, Math.max(0, ((30 - maxDrawdown) / 30) * 100));
    factors.push({
        name: 'Max Drawdown',
        score: ddScore,
        weight: 20,
        detail: `${maxDrawdown.toFixed(1)}% (target <15%)`
    });

    // 4. Trade Count (weight: 15%) — Need >30 trades for confidence
    const tcScore = Math.min(100, (totalTrades / 50) * 100);
    factors.push({
        name: 'Sample Size',
        score: tcScore,
        weight: 15,
        detail: `${totalTrades} trades (need >30)`
    });

    // 5. Consistency (weight: 15%) — Profitable days ratio
    const profitableDays = dailyPnl.filter(d => d.pnl > 0).length;
    const totalDays = dailyPnl.length;
    const consistencyRatio = totalDays > 0 ? (profitableDays / totalDays) * 100 : 0;
    const csScore = Math.min(100, (consistencyRatio / 70) * 100);
    factors.push({
        name: 'Consistency',
        score: csScore,
        weight: 15,
        detail: `${profitableDays}/${totalDays} profitable days (${consistencyRatio.toFixed(0)}%)`
    });

    // Weighted score
    const score = factors.reduce((sum, f) => sum + (f.score * f.weight / 100), 0);
    const clampedScore = Math.min(100, Math.max(0, Math.round(score)));

    // Verdict
    let verdict: string;
    if (totalTrades < 10) {
        verdict = 'INSUFFICIENT DATA';
    } else if (clampedScore >= 75) {
        verdict = 'READY FOR LIVE';
    } else if (clampedScore >= 55) {
        verdict = 'PAPER RECOMMENDED';
    } else if (clampedScore >= 35) {
        verdict = 'EXPERIMENTAL';
    } else {
        verdict = 'NOT READY';
    }

    return { score: clampedScore, verdict, factors };
}
