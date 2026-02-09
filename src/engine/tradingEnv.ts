export interface State {
    price: number;
    rsi: number;
    lstmSignal: number;
}

export class TradingEnv {
    private balance: number;
    private position: number = 0; // 0: None, 1: Long

    constructor(initialBalance: number) {
        this.balance = initialBalance;
    }

    // Risk-Averse Reward Function
    calculateReward(action: number, currentPrice: number, prevPrice: number, drawdown: number): number {
        let reward = 0;
        const logReturn = Math.log(currentPrice / prevPrice);

        if (action === 1) reward = logReturn; // Buy/Hold
        
        // Penalty for Drawdown > 5%
        if (drawdown > 0.05) reward -= (drawdown * 2);
        
        // Transaction fee penalty
        reward -= 0.001; 

        return reward;
    }
}