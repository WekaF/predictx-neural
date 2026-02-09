import { BacktestTrade, BacktestStats, Candle } from '../types';

/**
 * Calculates max drawdown from a series of balance updates.
 * @param balances Array of account balance over time
 * @returns Max drawdown as a percentage (0-100)
 */
export const calculateMaxDrawdown = (balances: number[]): number => {
    let maxBalance = 0;
    let maxDrawdown = 0;

    for (const balance of balances) {
        if (balance > maxBalance) {
            maxBalance = balance;
        }
        const drawdown = (maxBalance - balance) / maxBalance;
        if (drawdown > maxDrawdown) {
            maxDrawdown = drawdown;
        }
    }
    return maxDrawdown * 100;
};

/**
 * Calculates Sharpe Ratio
 * Not annualized, based on per-trade returns for simplicity in this context.
 * For more accuracy, we could use daily returns if available.
 */
export const calculateSharpeRatio = (trades: BacktestTrade[]): number => {
    if (trades.length < 2) return 0;

    // Calculate returns per trade (assuming linear returns for now)
    // Sharpe = (Mean Return - Risk Free Rate) / StdDev of Returns
    // We assume Risk Free Rate ~ 0 for short term backtests
    
    // Convert to % returns relative to entry price to normalize
    const returns = trades.map(t => (t.pnl / (t.entryPrice * t.quantity)));
    
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    
    const variance = returns.reduce((a, b) => a + Math.pow(b - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev === 0) return 0;
    
    // Annualize (Optional, assuming roughly 252 trading days, but here we just return the raw ratio)
    // A raw Sharpe > 1 is good, > 2 is very good.
    return meanReturn / stdDev;
};

/**
 * Calculates Calmar Ratio
 * Annualized Return / Max Drawdown
 * Here we use Total Return / Max Drawdown as a proxy for the backtest period
 */
export const calculateCalmarRatio = (totalReturnPercent: number, maxDrawdownPercent: number): number => {
    if (maxDrawdownPercent === 0) return totalReturnPercent > 0 ? 100 : 0;
    return totalReturnPercent / maxDrawdownPercent;
};

export const calculateAdvancedStats = (
    trades: BacktestTrade[], 
    initialBalance: number, 
    currentBalance: number,
    candles: Candle[] // Full history for Buy & Hold comparison
): BacktestStats => {
    const wins = trades.filter(t => t.outcome === 'WIN');
    const losses = trades.filter(t => t.outcome === 'LOSS');
    const totalTrades = trades.length;

    // 1. Returns
    const netProfit = currentBalance - initialBalance;
    const agentReturn = (netProfit / initialBalance) * 100;

    // Buy & Hold Return
    // (Last Price - First Price) / First Price * 100
    const firstPrice = candles.length > 0 ? candles[0].close : 1;
    const lastPrice = candles.length > 0 ? candles[candles.length - 1].close : 1;
    const buyHoldReturn = ((lastPrice - firstPrice) / firstPrice) * 100;
    
    // Avg Monthly Profit (Estimate)
    // Count days covered
    let avgMonthlyProfit = 0;
    if (candles.length > 0) {
        const startTime = new Date(candles[0].time).getTime();
        const endTime = new Date(candles[candles.length - 1].time).getTime();
        const days = (endTime - startTime) / (1000 * 3600 * 24);
        const months = Math.max(days / 30, 0.5); // Min 0.5 months to avoid infinity
        avgMonthlyProfit = netProfit / months;
    }

    // 2. Risk Metrics
    // Simulate balance curve
    let balance = initialBalance;
    const balanceCurve = [initialBalance];
    // Sort trades by time to build curve accurately
    const sortedTrades = [...trades].sort((a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime());
    
    for (const t of sortedTrades) {
        balance += t.pnl;
        balanceCurve.push(balance);
    }
    
    const maxDrawdown = calculateMaxDrawdown(balanceCurve);
    const sharpeRatio = calculateSharpeRatio(sortedTrades);
    const calmarRatio = calculateCalmarRatio(agentReturn, maxDrawdown);

    // 3. Trade Stats
    const totalWins = wins.length;
    const totalLosses = losses.length;
    const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
    
    const grossProfit = wins.reduce((acc, t) => acc + t.pnl, 0);
    const grossLoss = Math.abs(losses.reduce((acc, t) => acc + t.pnl, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);
    
    const avgWin = totalWins > 0 ? grossProfit / totalWins : 0;
    const avgLoss = totalLosses > 0 ? grossLoss / totalLosses : 0;
    
    // Expectancy = (Win % * Avg Win) - (Loss % * Avg Loss)
    const winProb = totalTrades > 0 ? totalWins / totalTrades : 0;
    const lossProb = totalTrades > 0 ? totalLosses / totalTrades : 0;
    const expectancy = (winProb * avgWin) - (lossProb * avgLoss);
    
    // Avg Risk:Reward (Realized)
    // Sum of (Profit amount / Risk amount) / total trades? 
    // Or just Avg Win / Avg Loss?
    // Using Avg Win / Avg Loss is a common simplified proxy for realized RR
    const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 0; 
    
    // Time in Market
    // Sum duration of all trades / Total duration of backtest
    let totalTradeDurationMs = 0;
    for (const t of sortedTrades) {
        if (t.exitTime) {
            const entry = new Date(t.entryTime).getTime();
            const exit = new Date(t.exitTime).getTime();
            totalTradeDurationMs += (exit - entry);
        }
    }
    
    let totalBacktestDurationMs = 1;
    if (candles.length > 0) {
        const start = new Date(candles[0].time).getTime();
        const end = new Date(candles[candles.length - 1].time).getTime();
        totalBacktestDurationMs = end - start;
    }
    
    const timeInMarket = (totalTradeDurationMs / totalBacktestDurationMs) * 100;

    // 4. Counts
    const longCount = trades.filter(t => t.type === 'BUY').length;
    const shortCount = trades.filter(t => t.type === 'SELL').length;

    return {
        netProfit,
        agentReturn,
        avgMonthlyProfit,
        buyHoldReturn,
        
        maxDrawdown,
        sharpeRatio,
        calmarRatio,
        
        totalTrades,
        wins: totalWins,
        losses: totalLosses,
        winRate,
        profitFactor,
        expectancy,
        riskRewardRatio,
        avgWin,
        avgLoss,
        timeInMarket,
        
        longCount,
        shortCount
    };
};
