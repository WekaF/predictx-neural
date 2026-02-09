-- =====================================================
-- PREDICTX TRADING APP - ENHANCED SUPABASE SCHEMA
-- =====================================================
-- This schema includes activity logging, performance tracking,
-- and optimized indexes for analytics queries
-- =====================================================

-- 1. TRAINING DATA TABLE
-- Stores ML training history and pattern outcomes
CREATE TABLE IF NOT EXISTS training_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    pattern TEXT,
    outcome TEXT CHECK (outcome IN ('WIN', 'LOSS', 'PENDING')),
    confluence TEXT,
    risk_reward NUMERIC,
    note TEXT,
    market_state JSONB, -- Store full context if needed
    
    -- Additional tracking fields
    symbol TEXT, -- Which asset this training is for
    pnl NUMERIC, -- Profit/Loss amount
    duration_minutes INTEGER -- How long trade was open
);

-- 2. TRADE SIGNALS TABLE
-- Stores all trade predictions and their outcomes
CREATE TABLE IF NOT EXISTS trade_signals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Trade Details
    symbol TEXT NOT NULL,
    type TEXT CHECK (type IN ('BUY', 'SELL', 'HOLD')),
    entry_price NUMERIC NOT NULL,
    stop_loss NUMERIC,
    take_profit NUMERIC,
    
    -- AI Metadata
    confidence NUMERIC CHECK (confidence >= 0 AND confidence <= 100),
    reasoning TEXT,
    source TEXT DEFAULT 'AI', -- 'AI', 'MANUAL', 'GEMINI', 'HYBRID'
    
    -- Outcome Tracking
    outcome TEXT CHECK (outcome IN ('WIN', 'LOSS', 'PENDING', 'CANCELLED')) DEFAULT 'PENDING',
    exit_price NUMERIC, -- Actual exit price
    pnl NUMERIC, -- Profit/Loss
    closed_at TIMESTAMPTZ, -- When trade was closed
    
    -- Performance Metrics
    risk_reward_actual NUMERIC, -- Actual R:R achieved
    duration_minutes INTEGER -- Trade duration
);

-- 3. MODEL STORAGE TABLE
-- Stores ML model weights for persistence
CREATE TABLE IF NOT EXISTS model_storage (
    id TEXT PRIMARY KEY, -- e.g., 'main_dqn_model'
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    weights_ih JSONB,
    weights_ho JSONB,
    bias_h JSONB,
    bias_o JSONB,
    metadata JSONB, -- Store learning rate, epsilon, etc.
    
    -- Version tracking
    version INTEGER DEFAULT 1,
    performance_score NUMERIC -- Win rate or other metric
);

-- 4. APP SETTINGS TABLE
-- Stores user preferences and configuration
CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY DEFAULT 'main_settings',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- API Keys (encrypted in production!)
    gemini_api_key TEXT,
    webhook_url TEXT,
    
    -- Trading Settings
    risk_tolerance NUMERIC DEFAULT 1.0,
    auto_trade_enabled BOOLEAN DEFAULT FALSE,
    default_asset TEXT DEFAULT 'BTC/USD',
    
    -- AI Settings
    learning_rate NUMERIC DEFAULT 0.05,
    epsilon NUMERIC DEFAULT 0.2,
    
    -- Notification Settings
    notifications_enabled BOOLEAN DEFAULT TRUE
);

-- 5. ACTIVITY LOGS TABLE (NEW!)
-- Records all user actions and system events
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Activity Details
    event_type TEXT NOT NULL, -- 'TRADE_OPENED', 'TRADE_CLOSED', 'MODEL_TRAINED', 'SETTINGS_CHANGED', 'ANALYSIS_RUN', 'MODEL_RESET', 'WEIGHTS_EXPORTED', 'WEIGHTS_IMPORTED'
    event_category TEXT CHECK (event_category IN ('TRADING', 'AI', 'SYSTEM', 'USER')),
    
    -- Context
    description TEXT,
    metadata JSONB, -- Store additional context (asset, confidence, etc.)
    
    -- User/Session Info
    user_agent TEXT,
    session_id TEXT,
    
    -- Performance Impact
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT
);

-- 6. AI PERFORMANCE TRACKING TABLE (NEW!)
-- Tracks AI model performance over time
CREATE TABLE IF NOT EXISTS ai_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Time Window
    period TEXT CHECK (period IN ('HOURLY', 'DAILY', 'WEEKLY')),
    period_start TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    
    -- Performance Metrics
    total_trades INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    win_rate NUMERIC,
    avg_confidence NUMERIC,
    avg_pnl NUMERIC,
    
    -- Model State
    epsilon NUMERIC,
    learning_rate NUMERIC,
    training_count INTEGER,
    
    -- Asset Breakdown
    asset_performance JSONB -- { "BTC/USD": { wins: 5, losses: 2 }, ... }
);

-- 7. USER SESSIONS TABLE (NEW!)
-- Track app usage sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    
    -- Session Info
    duration_minutes INTEGER,
    trades_executed INTEGER DEFAULT 0,
    analyses_run INTEGER DEFAULT 0,
    
    -- Device Info
    user_agent TEXT,
    ip_address TEXT
);

-- 8. TRAINING SESSIONS TABLE (NEW!)
-- Logs backend training runs
CREATE TABLE IF NOT EXISTS training_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    symbol TEXT NOT NULL,
    epochs INTEGER NOT NULL,
    final_loss NUMERIC,
    status TEXT CHECK (status IN ('SUCCESS', 'FAILED', 'RUNNING')),
    duration_seconds NUMERIC,
    error_message TEXT,
    metadata JSONB -- Store additional params like learning rate, batch size
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Training Data Indexes
CREATE INDEX IF NOT EXISTS idx_training_data_created_at ON training_data(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_data_outcome ON training_data(outcome);
CREATE INDEX IF NOT EXISTS idx_training_data_symbol ON training_data(symbol);

-- Trade Signals Indexes
CREATE INDEX IF NOT EXISTS idx_trade_signals_created_at ON trade_signals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trade_signals_symbol ON trade_signals(symbol);
CREATE INDEX IF NOT EXISTS idx_trade_signals_outcome ON trade_signals(outcome);
CREATE INDEX IF NOT EXISTS idx_trade_signals_source ON trade_signals(source);

-- Activity Logs Indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_event_type ON activity_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_category ON activity_logs(event_category);

-- AI Performance Indexes
CREATE INDEX IF NOT EXISTS idx_ai_performance_period ON ai_performance(period, period_start DESC);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE training_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_storage ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLICIES (Public access for demo - restrict in production!)
-- =====================================================

-- Training Data Policies
CREATE POLICY "Enable read access for all users" ON training_data FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON training_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON training_data FOR UPDATE USING (true);

-- Trade Signals Policies
CREATE POLICY "Enable read/write for all users" ON trade_signals FOR ALL USING (true);

-- Model Storage Policies
CREATE POLICY "Enable read/write for all users" ON model_storage FOR ALL USING (true);

-- App Settings Policies
CREATE POLICY "Enable read/write for all users" ON app_settings FOR ALL USING (true);

-- Activity Logs Policies
CREATE POLICY "Enable read/write for all users" ON activity_logs FOR ALL USING (true);

-- AI Performance Policies
CREATE POLICY "Enable read/write for all users" ON ai_performance FOR ALL USING (true);

-- User Sessions Policies
CREATE POLICY "Enable read/write for all users" ON user_sessions FOR ALL USING (true);

-- =====================================================
-- TRIGGERS & FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_app_settings_modtime BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_model_storage_modtime BEFORE UPDATE ON model_storage FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_trade_signals_modtime BEFORE UPDATE ON trade_signals FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Function to auto-log trade events
CREATE OR REPLACE FUNCTION log_trade_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Log trade creation
    IF (TG_OP = 'INSERT') THEN
        INSERT INTO activity_logs (event_type, event_category, description, metadata)
        VALUES (
            'TRADE_OPENED',
            'TRADING',
            'New ' || NEW.type || ' trade on ' || NEW.symbol,
            jsonb_build_object(
                'trade_id', NEW.id,
                'symbol', NEW.symbol,
                'type', NEW.type,
                'confidence', NEW.confidence,
                'source', NEW.source
            )
        );
    END IF;
    
    -- Log trade closure
    IF (TG_OP = 'UPDATE' AND OLD.outcome = 'PENDING' AND NEW.outcome IN ('WIN', 'LOSS', 'CANCELLED')) THEN
        INSERT INTO activity_logs (event_type, event_category, description, metadata, success)
        VALUES (
            'TRADE_CLOSED',
            'TRADING',
            'Trade closed: ' || NEW.outcome || ' on ' || NEW.symbol,
            jsonb_build_object(
                'trade_id', NEW.id,
                'symbol', NEW.symbol,
                'outcome', NEW.outcome,
                'pnl', NEW.pnl,
                'confidence', NEW.confidence
            ),
            NEW.outcome = 'WIN'
        );
    END IF;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trade logging trigger
DROP TRIGGER IF EXISTS trade_event_logger ON trade_signals;
CREATE TRIGGER trade_event_logger
AFTER INSERT OR UPDATE ON trade_signals
FOR EACH ROW EXECUTE PROCEDURE log_trade_event();

-- =====================================================
-- HELPER VIEWS FOR ANALYTICS
-- =====================================================

-- View: Recent Activity Summary
CREATE OR REPLACE VIEW recent_activity AS
SELECT 
    event_type,
    event_category,
    description,
    created_at,
    success
FROM activity_logs
ORDER BY created_at DESC
LIMIT 50;

-- View: Daily Performance Summary
CREATE OR REPLACE VIEW daily_performance AS
SELECT 
    DATE(created_at) as trade_date,
    COUNT(*) as total_trades,
    SUM(CASE WHEN outcome = 'WIN' THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN outcome = 'LOSS' THEN 1 ELSE 0 END) as losses,
    ROUND(AVG(confidence), 2) as avg_confidence,
    SUM(pnl) as total_pnl
FROM trade_signals
WHERE outcome IN ('WIN', 'LOSS')
GROUP BY DATE(created_at)
ORDER BY trade_date DESC;

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Insert default settings if not exists
INSERT INTO app_settings (id, risk_tolerance, auto_trade_enabled)
VALUES ('main_settings', 1.0, false)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- SCHEMA VERSION
-- =====================================================
-- Version: 2.0
-- Last Updated: 2026-02-07
-- Changes: Added activity_logs, ai_performance, user_sessions tables
--          Added indexes for better query performance
--          Added auto-logging triggers
--          Added helper views for analytics
