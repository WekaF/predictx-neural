-- =====================================================
-- LEVERAGE TRADING SYSTEM - SUPABASE SCHEMA
-- =====================================================
-- Schema for 10x leverage trading with historical data
-- =====================================================

-- 1. LEVERAGE TRADES TABLE
-- Stores all trades with 10x leverage calculations
CREATE TABLE IF NOT EXISTS leverage_trades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Trade Identification
    trade_date DATE NOT NULL,
    trade_time TIME,
    
    -- Trade Details
    order_type TEXT CHECK (order_type IN ('SHORT', 'LONG')) NOT NULL,
    open_price NUMERIC NOT NULL,
    target_price NUMERIC NOT NULL,
    close_price NUMERIC,
    
    -- Results
    result_percent NUMERIC, -- Actual % from historical data
    status TEXT CHECK (status IN ('FILLED', 'NOT FILLED', 'PENDING')) DEFAULT 'PENDING',
    balance NUMERIC NOT NULL,
    
    -- Leverage Calculations (10x)
    leverage_multiplier NUMERIC DEFAULT 10,
    position_size NUMERIC, -- balance * leverage
    pnl_amount NUMERIC, -- actual profit/loss in currency
    pnl_percent NUMERIC, -- % of balance (amplified by leverage)
    
    -- AI Predictions
    predicted_by_ai BOOLEAN DEFAULT FALSE,
    ai_confidence NUMERIC CHECK (ai_confidence >= 0 AND ai_confidence <= 100),
    ai_reasoning TEXT,
    ai_pattern TEXT,
    
    -- Risk Management
    stop_loss_price NUMERIC,
    take_profit_price NUMERIC,
    risk_reward_ratio NUMERIC,
    
    -- Metadata
    notes TEXT,
    source TEXT DEFAULT 'HISTORICAL' -- 'HISTORICAL', 'AI_PREDICTED', 'MANUAL'
);

-- 2. LEVERAGE TRAINING SESSIONS TABLE
-- Track training iterations and performance
CREATE TABLE IF NOT EXISTS leverage_training_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Training Config
    total_trades_used INTEGER,
    epochs INTEGER,
    learning_rate NUMERIC,
    epsilon NUMERIC,
    
    -- Results
    initial_accuracy NUMERIC,
    final_accuracy NUMERIC,
    win_rate NUMERIC,
    avg_pnl NUMERIC,
    total_iterations INTEGER,
    
    -- Model State
    patterns_discovered INTEGER,
    avg_confidence NUMERIC,
    
    -- Status
    status TEXT CHECK (status IN ('RUNNING', 'COMPLETED', 'FAILED')) DEFAULT 'RUNNING',
    error_message TEXT
);

-- 3. LEVERAGE PATTERNS TABLE
-- Store discovered winning patterns
CREATE TABLE IF NOT EXISTS leverage_patterns (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Pattern Details
    pattern_name TEXT NOT NULL,
    pattern_signature TEXT, -- Technical signature (e.g., "RSI_oversold_downtrend_BB_lower")
    
    -- Performance
    win_count INTEGER DEFAULT 0,
    loss_count INTEGER DEFAULT 0,
    win_rate NUMERIC,
    avg_pnl NUMERIC,
    total_pnl NUMERIC,
    
    -- Confidence
    confidence_score NUMERIC,
    reliability_score NUMERIC, -- Based on sample size and consistency
    
    -- Context
    order_type_preference TEXT, -- 'SHORT', 'LONG', or 'NEUTRAL'
    market_conditions JSONB, -- Store conditions when pattern works best
    
    -- Metadata
    last_seen TIMESTAMPTZ,
    times_traded INTEGER DEFAULT 0
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_leverage_trades_date ON leverage_trades(trade_date DESC);
CREATE INDEX IF NOT EXISTS idx_leverage_trades_status ON leverage_trades(status);
CREATE INDEX IF NOT EXISTS idx_leverage_trades_order_type ON leverage_trades(order_type);
CREATE INDEX IF NOT EXISTS idx_leverage_trades_source ON leverage_trades(source);
CREATE INDEX IF NOT EXISTS idx_leverage_trades_ai_confidence ON leverage_trades(ai_confidence DESC);

CREATE INDEX IF NOT EXISTS idx_training_sessions_started ON leverage_training_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_sessions_status ON leverage_training_sessions(status);

CREATE INDEX IF NOT EXISTS idx_patterns_win_rate ON leverage_patterns(win_rate DESC);
CREATE INDEX IF NOT EXISTS idx_patterns_confidence ON leverage_patterns(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_patterns_updated ON leverage_patterns(updated_at DESC);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE leverage_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE leverage_training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leverage_patterns ENABLE ROW LEVEL SECURITY;

-- Public access policies (restrict in production!)
CREATE POLICY "Enable read/write for all users" ON leverage_trades FOR ALL USING (true);
CREATE POLICY "Enable read/write for all users" ON leverage_training_sessions FOR ALL USING (true);
CREATE POLICY "Enable read/write for all users" ON leverage_patterns FOR ALL USING (true);

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE TRIGGER update_leverage_trades_modtime 
    BEFORE UPDATE ON leverage_trades 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_leverage_patterns_modtime 
    BEFORE UPDATE ON leverage_patterns 
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Auto-calculate leverage metrics on insert/update
CREATE OR REPLACE FUNCTION calculate_leverage_metrics()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate position size
    NEW.position_size = NEW.balance * NEW.leverage_multiplier;
    
    -- Calculate PNL if trade is filled
    IF NEW.status = 'FILLED' AND NEW.close_price IS NOT NULL THEN
        -- Calculate price movement %
        DECLARE
            price_movement_percent NUMERIC;
        BEGIN
            IF NEW.order_type = 'SHORT' THEN
                -- SHORT: profit when price goes down
                price_movement_percent = (NEW.open_price - NEW.close_price) / NEW.open_price;
            ELSE
                -- LONG: profit when price goes up
                price_movement_percent = (NEW.close_price - NEW.open_price) / NEW.open_price;
            END IF;
            
            -- Apply leverage multiplier
            NEW.pnl_percent = price_movement_percent * NEW.leverage_multiplier * 100;
            NEW.pnl_amount = NEW.balance * (NEW.pnl_percent / 100);
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calculate_leverage_on_change ON leverage_trades;
CREATE TRIGGER calculate_leverage_on_change
    BEFORE INSERT OR UPDATE ON leverage_trades
    FOR EACH ROW EXECUTE PROCEDURE calculate_leverage_metrics();

-- =====================================================
-- HELPER VIEWS
-- =====================================================

-- View: Leverage Performance Summary
CREATE OR REPLACE VIEW leverage_performance_summary AS
SELECT 
    DATE_TRUNC('day', trade_date) as period,
    COUNT(*) as total_trades,
    SUM(CASE WHEN status = 'FILLED' THEN 1 ELSE 0 END) as filled_trades,
    SUM(CASE WHEN status = 'NOT FILLED' THEN 1 ELSE 0 END) as not_filled_trades,
    SUM(CASE WHEN pnl_percent > 0 THEN 1 ELSE 0 END) as winning_trades,
    SUM(CASE WHEN pnl_percent < 0 THEN 1 ELSE 0 END) as losing_trades,
    ROUND(AVG(CASE WHEN status = 'FILLED' THEN pnl_percent END), 2) as avg_pnl_percent,
    ROUND(SUM(CASE WHEN status = 'FILLED' THEN pnl_amount END), 2) as total_pnl_amount,
    ROUND(AVG(ai_confidence), 2) as avg_ai_confidence,
    MAX(balance) as ending_balance
FROM leverage_trades
GROUP BY DATE_TRUNC('day', trade_date)
ORDER BY period DESC;

-- View: Best Performing Patterns
CREATE OR REPLACE VIEW best_leverage_patterns AS
SELECT 
    pattern_name,
    pattern_signature,
    win_count,
    loss_count,
    win_rate,
    avg_pnl,
    confidence_score,
    order_type_preference,
    times_traded
FROM leverage_patterns
WHERE (win_count + loss_count) >= 3 -- Minimum sample size
ORDER BY win_rate DESC, confidence_score DESC
LIMIT 20;

-- View: Recent Leverage Trades
CREATE OR REPLACE VIEW recent_leverage_trades AS
SELECT 
    id,
    trade_date,
    order_type,
    open_price,
    close_price,
    status,
    pnl_percent,
    pnl_amount,
    balance,
    ai_confidence,
    ai_pattern,
    source
FROM leverage_trades
ORDER BY trade_date DESC, created_at DESC
LIMIT 50;

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function: Get overall leverage statistics
CREATE OR REPLACE FUNCTION get_leverage_stats()
RETURNS TABLE (
    total_trades BIGINT,
    filled_trades BIGINT,
    win_rate NUMERIC,
    avg_pnl_percent NUMERIC,
    total_return_percent NUMERIC,
    best_trade_percent NUMERIC,
    worst_trade_percent NUMERIC,
    avg_confidence NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT,
        SUM(CASE WHEN status = 'FILLED' THEN 1 ELSE 0 END)::BIGINT,
        ROUND(
            SUM(CASE WHEN pnl_percent > 0 THEN 1 ELSE 0 END)::NUMERIC / 
            NULLIF(SUM(CASE WHEN status = 'FILLED' THEN 1 ELSE 0 END), 0) * 100,
            2
        ),
        ROUND(AVG(CASE WHEN status = 'FILLED' THEN pnl_percent END), 2),
        ROUND(
            (MAX(balance) - MIN(balance)) / NULLIF(MIN(balance), 0) * 100,
            2
        ),
        ROUND(MAX(pnl_percent), 2),
        ROUND(MIN(pnl_percent), 2),
        ROUND(AVG(ai_confidence), 2)
    FROM leverage_trades;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SCHEMA VERSION
-- =====================================================
-- Version: 1.0
-- Created: 2026-02-08
-- Purpose: Leverage trading system with 10x multiplier
-- Features: Auto-calculation of PNL, pattern tracking, training sessions
