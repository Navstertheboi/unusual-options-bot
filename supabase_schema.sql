-- Unusual Options Activity Bot - Supabase Schema
-- Based on Tradier API response structure
-- Created: 2025-10-26

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABLE: unusual_signals
-- Stores detected unusual options activity signals
-- =============================================================================
CREATE TABLE unusual_signals (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Option identification (from Tradier API)
    symbol TEXT NOT NULL, -- OCC format: e.g., "NVDA250919C00175000"
    ticker TEXT NOT NULL, -- Underlying ticker: e.g., "NVDA"
    description TEXT, -- Human-readable: "NVDA Sep 19 2025 $175.00 Call"

    -- Option details
    option_type TEXT NOT NULL CHECK (option_type IN ('call', 'put')),
    strike NUMERIC(10, 2) NOT NULL,
    expiration_date DATE NOT NULL,
    dte INTEGER NOT NULL, -- Days to expiration at detection
    contract_size INTEGER DEFAULT 100,

    -- Unusual activity metrics (detection criteria)
    volume INTEGER NOT NULL,
    open_interest INTEGER NOT NULL,
    volume_oi_ratio NUMERIC(10, 2) NOT NULL, -- Key metric: volume / open_interest
    premium NUMERIC(12, 2) NOT NULL, -- Trade premium in dollars (volume * last_price * 100)

    -- Price data at detection (from Tradier quotes API)
    last_price NUMERIC(10, 4) NOT NULL, -- Last traded price of option
    bid NUMERIC(10, 4),
    ask NUMERIC(10, 4),
    bid_size INTEGER, -- In hundreds (Tradier format)
    ask_size INTEGER, -- In hundreds (Tradier format)
    bid_ask_spread_pct NUMERIC(6, 3), -- Calculated: (ask - bid) / mid * 100

    -- Underlying stock data
    underlying_price NUMERIC(10, 4) NOT NULL,
    underlying_change NUMERIC(10, 4), -- Daily change in dollars
    underlying_change_pct NUMERIC(6, 3), -- Daily change percentage

    -- Greeks (from ORATS via Tradier)
    delta NUMERIC(8, 6),
    gamma NUMERIC(8, 6),
    theta NUMERIC(8, 6),
    vega NUMERIC(8, 6),
    rho NUMERIC(8, 6),
    phi NUMERIC(8, 6),
    implied_volatility NUMERIC(8, 6), -- mid_iv or smv_vol from Tradier
    greeks_updated_at TIMESTAMP WITH TIME ZONE,

    -- Signal quality indicators
    moneyness NUMERIC(6, 3), -- % OTM/ITM: (strike - underlying_price) / underlying_price * 100
    moneyness_category TEXT CHECK (moneyness_category IN ('deep_itm', 'itm', 'atm', 'otm', 'deep_otm')),
    signal_strength TEXT CHECK (signal_strength IN ('high', 'medium', 'low')),

    -- Metadata
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    trade_date BIGINT, -- Unix timestamp from Tradier
    exchange TEXT, -- Exchange code from Tradier

    -- Indexes for performance
    CONSTRAINT unique_signal UNIQUE (symbol, detected_at)
);

-- Indexes for common queries
CREATE INDEX idx_unusual_signals_ticker ON unusual_signals(ticker);
CREATE INDEX idx_unusual_signals_detected_at ON unusual_signals(detected_at DESC);
CREATE INDEX idx_unusual_signals_volume_oi_ratio ON unusual_signals(volume_oi_ratio DESC);
CREATE INDEX idx_unusual_signals_expiration ON unusual_signals(expiration_date);
CREATE INDEX idx_unusual_signals_signal_strength ON unusual_signals(signal_strength);

-- =============================================================================
-- TABLE: paper_trades
-- Simulated trades for P/L tracking
-- =============================================================================
CREATE TABLE paper_trades (
    -- Primary identification
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    signal_id UUID NOT NULL REFERENCES unusual_signals(id) ON DELETE CASCADE,

    -- Trade execution details
    direction TEXT NOT NULL CHECK (direction IN ('long', 'short')), -- For future: allow shorting
    quantity INTEGER NOT NULL DEFAULT 1, -- Number of contracts

    -- Entry details
    entry_price NUMERIC(10, 4) NOT NULL, -- Mid-price at signal detection
    entry_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    entry_underlying_price NUMERIC(10, 4), -- Underlying price at entry

    -- Exit details
    exit_price NUMERIC(10, 4),
    exit_time TIMESTAMP WITH TIME ZONE,
    exit_underlying_price NUMERIC(10, 4),
    exit_reason TEXT CHECK (exit_reason IN ('manual', 'time_limit', 'expired', 'stop_loss', 'take_profit')),

    -- P/L calculations
    pnl NUMERIC(12, 2), -- Dollar P/L: (exit_price - entry_price) * quantity * 100
    pnl_pct NUMERIC(8, 3), -- Percentage P/L: (exit_price - entry_price) / entry_price * 100
    max_pnl NUMERIC(12, 2), -- Peak P/L during trade lifetime
    max_pnl_pct NUMERIC(8, 3),
    min_pnl NUMERIC(12, 2), -- Worst P/L during trade lifetime
    min_pnl_pct NUMERIC(8, 3),

    -- Trade status
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'expired')),

    -- Metadata
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_trade UNIQUE (signal_id)
);

-- Indexes for performance
CREATE INDEX idx_paper_trades_signal_id ON paper_trades(signal_id);
CREATE INDEX idx_paper_trades_status ON paper_trades(status);
CREATE INDEX idx_paper_trades_entry_time ON paper_trades(entry_time DESC);
CREATE INDEX idx_paper_trades_pnl ON paper_trades(pnl DESC);

-- =============================================================================
-- TABLE: paper_trade_snapshots
-- Periodic price snapshots for tracking P/L over time
-- =============================================================================
CREATE TABLE paper_trade_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID NOT NULL REFERENCES paper_trades(id) ON DELETE CASCADE,

    -- Snapshot data
    option_price NUMERIC(10, 4) NOT NULL,
    underlying_price NUMERIC(10, 4),
    pnl NUMERIC(12, 2), -- Calculated P/L at this snapshot
    pnl_pct NUMERIC(8, 3),

    -- Greeks at snapshot (optional - for analysis)
    delta NUMERIC(8, 6),
    implied_volatility NUMERIC(8, 6),

    -- Timestamp
    snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_snapshot UNIQUE (trade_id, snapshot_at)
);

-- Indexes for performance
CREATE INDEX idx_snapshots_trade_id ON paper_trade_snapshots(trade_id);
CREATE INDEX idx_snapshots_snapshot_at ON paper_trade_snapshots(snapshot_at DESC);

-- =============================================================================
-- TABLE: alert_log
-- Track SMS alerts sent to users
-- =============================================================================
CREATE TABLE alert_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    signal_id UUID NOT NULL REFERENCES unusual_signals(id) ON DELETE CASCADE,

    -- Alert details
    recipient_phone TEXT NOT NULL,
    message_body TEXT NOT NULL,

    -- Twilio response
    twilio_sid TEXT, -- Twilio message SID
    twilio_status TEXT, -- queued, sent, delivered, failed, undelivered
    twilio_error_code TEXT,
    twilio_error_message TEXT,

    -- Timing
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    delivered_at TIMESTAMP WITH TIME ZONE,

    -- Metadata
    alert_type TEXT DEFAULT 'signal_detected' CHECK (alert_type IN ('signal_detected', 'trade_update', 'daily_summary'))
);

-- Indexes for performance
CREATE INDEX idx_alert_log_signal_id ON alert_log(signal_id);
CREATE INDEX idx_alert_log_sent_at ON alert_log(sent_at DESC);
CREATE INDEX idx_alert_log_status ON alert_log(twilio_status);

-- =============================================================================
-- TABLE: stock_watchlist
-- User-defined list of tickers to monitor
-- =============================================================================
CREATE TABLE stock_watchlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticker TEXT NOT NULL UNIQUE,

    -- Stock metadata
    company_name TEXT,
    market_cap NUMERIC(20, 2), -- For filtering small/mid-cap
    sector TEXT,
    industry TEXT,

    -- Monitoring settings
    enabled BOOLEAN DEFAULT true,
    min_premium NUMERIC(12, 2) DEFAULT 25000, -- Per-ticker override
    min_volume_oi_ratio NUMERIC(6, 2) DEFAULT 3.0,

    -- Metadata
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_scanned_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- =============================================================================
-- TABLE: api_rate_limits
-- Track API usage for rate limit monitoring
-- =============================================================================
CREATE TABLE api_rate_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_provider TEXT NOT NULL, -- 'tradier', 'twilio', etc.
    endpoint TEXT, -- Specific endpoint called

    -- Rate limit tracking
    requests_made INTEGER DEFAULT 1,
    requests_allowed INTEGER, -- Daily/hourly limit
    period TEXT CHECK (period IN ('minute', 'hour', 'day')), -- Rate limit period

    -- Timing
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,

    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_rate_limit UNIQUE (api_provider, endpoint, period_start)
);

-- =============================================================================
-- VIEWS: Convenience views for dashboard queries
-- =============================================================================

-- Recent signals with paper trade status
CREATE VIEW signals_with_trades AS
SELECT
    s.*,
    pt.id as trade_id,
    pt.status as trade_status,
    pt.entry_price as trade_entry_price,
    pt.pnl as trade_pnl,
    pt.pnl_pct as trade_pnl_pct
FROM unusual_signals s
LEFT JOIN paper_trades pt ON s.id = pt.signal_id
ORDER BY s.detected_at DESC;

-- Performance summary
CREATE VIEW performance_summary AS
SELECT
    COUNT(*) as total_trades,
    COUNT(*) FILTER (WHERE status = 'closed' AND pnl > 0) as winning_trades,
    COUNT(*) FILTER (WHERE status = 'closed' AND pnl < 0) as losing_trades,
    COUNT(*) FILTER (WHERE status = 'closed' AND pnl = 0) as breakeven_trades,
    ROUND(AVG(pnl) FILTER (WHERE status = 'closed'), 2) as avg_pnl,
    ROUND(AVG(pnl_pct) FILTER (WHERE status = 'closed'), 2) as avg_pnl_pct,
    ROUND(MAX(pnl) FILTER (WHERE status = 'closed'), 2) as max_pnl,
    ROUND(MIN(pnl) FILTER (WHERE status = 'closed'), 2) as min_pnl,
    ROUND(SUM(pnl) FILTER (WHERE status = 'closed'), 2) as total_pnl,
    ROUND(
        COUNT(*) FILTER (WHERE status = 'closed' AND pnl > 0)::NUMERIC /
        NULLIF(COUNT(*) FILTER (WHERE status = 'closed'), 0) * 100,
        2
    ) as win_rate_pct
FROM paper_trades;

-- =============================================================================
-- FUNCTIONS: Utility functions
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for paper_trades
CREATE TRIGGER update_paper_trades_updated_at
    BEFORE UPDATE ON paper_trades
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate signal strength
CREATE OR REPLACE FUNCTION calculate_signal_strength(
    p_volume_oi_ratio NUMERIC,
    p_premium NUMERIC,
    p_dte INTEGER,
    p_moneyness NUMERIC
) RETURNS TEXT AS $$
BEGIN
    -- High conviction: Volume >5x OI, >$100k premium, <30 DTE, >10% OTM
    IF p_volume_oi_ratio >= 5.0
       AND p_premium >= 100000
       AND p_dte <= 30
       AND ABS(p_moneyness) >= 10 THEN
        RETURN 'high';

    -- Medium conviction: Volume 3-5x OI, $25-100k premium, 30-45 DTE
    ELSIF p_volume_oi_ratio >= 3.0
          AND p_premium >= 25000
          AND p_dte <= 45 THEN
        RETURN 'medium';

    -- Low conviction: Just meets minimum criteria
    ELSE
        RETURN 'low';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SAMPLE DATA INSERTION (for testing)
-- =============================================================================

-- Insert sample watchlist tickers (small/mid-cap focus)
INSERT INTO stock_watchlist (ticker, company_name, market_cap, sector, notes) VALUES
('NVDA', 'NVIDIA Corp', 3500000000000, 'Technology', 'High volume options'),
('PLTR', 'Palantir Technologies', 45000000000, 'Technology', 'Frequent unusual activity'),
('SOFI', 'SoFi Technologies', 12000000000, 'Financial Services', 'Small-cap fintech'),
('RBLX', 'Roblox Corp', 28000000000, 'Technology', 'Mid-cap gaming');

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Note: Enable these once you have user authentication set up in Lovable
-- =============================================================================

-- Enable RLS on tables
-- ALTER TABLE unusual_signals ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE paper_trades ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE stock_watchlist ENABLE ROW LEVEL SECURITY;

-- Example policy (customize based on your auth setup)
-- CREATE POLICY "Users can view their own signals" ON unusual_signals
--     FOR SELECT USING (auth.uid() = user_id);

-- =============================================================================
-- NOTES FOR IMPLEMENTATION
-- =============================================================================

-- 1. REALTIME DATA REQUIREMENT:
--    - Tradier free/sandbox API has 15-min delay for options
--    - You MUST have a Tradier Brokerage account for real-time data
--    - Alternative: Consider Unusual Whales API (paid) or Polygon.io
--
-- 2. OPEN INTEREST LAG:
--    - OI updates once per day (after market close)
--    - Volume/OI ratio uses PRIOR day's OI during market hours
--    - Add job to update OI daily at 6pm ET
--
-- 3. DATA REFRESH STRATEGY:
--    - Poll quotes endpoint every 1-5 minutes for watchlist tickers
--    - Calculate volume/OI ratio on each poll
--    - Insert into unusual_signals when criteria met
--    - Avoid duplicate signals: check unique_signal constraint
--
-- 4. PAPER TRADE SIMULATION:
--    - Use mid-price for entry/exit (bid + ask) / 2
--    - Update snapshots every 15 min during market hours
--    - Auto-close trades after 24h or at expiration
--    - Consider slippage: add 2-5% spread cost for realism
--
-- 5. PERFORMANCE OPTIMIZATION:
--    - Partition unusual_signals by detected_at (monthly) if >1M rows
--    - Archive old signals/trades to separate table after 90 days
--    - Use materialized views for dashboard if queries are slow
