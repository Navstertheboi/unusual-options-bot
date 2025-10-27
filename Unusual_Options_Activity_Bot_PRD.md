# PRD: Unusual Options Activity Signal Bot

## Goal
Build a system that scans live unusual options activity (UOA) across a selected universe of small-mid cap stocks, identifies high-conviction trades based on refined rules, and instantly notifies the user via Twilio SMS or Lovable dashboard alerts. Initial phase: paper trading only — no live funds or broker execution.

## Objectives
- Detect high-signal UOA (unusual call/put sweeps)
- Focus on small-mid cap stocks where retail may have information edge
- Alert instantly via Twilio SMS
- Support paper trading via Supabase
- Future expandability (insiders, earnings context, live trading)

---

## Core Features (Phase 1 MVP)

### 1. Data Ingestion
- Poll or subscribe to UOA API feeds (Tradier, Intrinio, or Unusual Whales API in future)
- **Critical**: Confirm API provides real-time or near-real-time data (not 15min+ delayed)
- Target update frequency: tick-by-tick or minute-level for true unusual detection

### 2. Signal Engine - Refined Unusual Criteria

**Base Filters (All must be met):**
- **Premium ≥ $25,000** (lowered from $50k to capture small/mid-cap institutional activity)
- **Volume ≥ 3× Open Interest AND Volume ≥ 100 contracts** (prevents false signals from low-liquidity options)
- **DTE ≤ 45 days** (focuses on near-term directional plays with potential catalyst information)

**Enhanced Filters (Phase 1.5 - Optional):**
- **Directionality tracking**: Separate signals for calls (bullish) vs puts (bearish)
- **Moneyness filter**: Prioritize strikes ≥10% OTM (stronger conviction signal than ITM)
- **IV Rank/Percentile**: Flag options with elevated IV relative to historical norms (signals informed activity vs normal volatility)

**Known Limitations & Mitigations:**
- **Open Interest lag**: OI updates once daily (after close), so intraday ratios use stale data
  - *Mitigation*: Calculate Volume/OI ratio using prior day's OI; monitor for EOD recalculation
- **Small-cap liquidity**: Wide bid-ask spreads may distort paper trading P/L
  - *Mitigation*: Use mid-price for simulated fills; flag high-spread contracts (>10% spread)
- **Data freshness**: Most free APIs have delays
  - *Mitigation*: Document API latency; consider upgrading to paid tier for production

### 3. Notifications
- **Twilio SMS**: Instant alerts with ticker, strike, expiry, premium, volume/OI ratio
- **Lovable Dashboard**: Real-time feed with sortable/filterable signals

### 4. Paper Trading
- Simulated order creation in Supabase
- Track entry price (mid-price at signal detection)
- Update P/L at regular intervals (e.g., every 15 min during market hours)
- Exit simulation after 24h or at expiration (whichever comes first)

### 5. Dashboard
- **Live Signal Feed**: Real-time unusual activity as it's detected
- **Ticker Detail Pages**: Individual contract history, Greeks, underlying chart
- **P/L Summary**: Running paper trade performance (win rate, avg return, Sharpe ratio)
- **Signal Breakdown**: Calls vs Puts, sector distribution, volume distribution

---

## Architecture Overview

**Frontend**: Lovable (React + Supabase client)
**Backend**: Node.js/TypeScript serverless functions (Vercel/Netlify)
**Database**: Supabase (PostgreSQL)
**Messaging**: Twilio SMS
**Execution**: Paper trading simulation (no broker integration in Phase 1)

### Database Schema (Initial)

**Table: `unusual_signals`**
```sql
- id (uuid, primary key)
- ticker (text)
- option_type (text) -- 'call' or 'put'
- strike (numeric)
- expiry_date (date)
- dte (integer) -- days to expiration
- premium (numeric) -- trade premium in dollars
- volume (integer)
- open_interest (integer)
- volume_oi_ratio (numeric)
- detected_at (timestamp)
- underlying_price (numeric)
- moneyness (numeric) -- % OTM/ITM
- iv_percentile (numeric) -- optional, for Phase 1.5
```

**Table: `paper_trades`**
```sql
- id (uuid, primary key)
- signal_id (uuid, foreign key)
- entry_price (numeric) -- mid-price at detection
- entry_time (timestamp)
- exit_price (numeric)
- exit_time (timestamp)
- pnl (numeric)
- pnl_pct (numeric)
- status (text) -- 'open', 'closed', 'expired'
```

---

## Roadmap

**P0 – Setup & Infrastructure (Week 1)**
- Supabase project setup + schema creation
- API connection testing (Tradier or equivalent)
- Twilio account + SMS integration
- Basic Lovable dashboard scaffold

**P1 – Core Signal Detection (Weeks 2-3)**
- Implement polling/webhook for options data
- Build signal engine with refined filters
- SMS alerts for detected signals
- Store signals in Supabase

**P2 – Paper Trading & Dashboard (Week 4)**
- Simulated order entry/exit logic
- P/L tracking and updates
- Dashboard: signal feed, ticker pages, performance metrics

**P3 – Enhanced Filters & Context (Weeks 5-6)**
- Add call/put directionality
- Moneyness filtering (OTM prioritization)
- IV rank/percentile integration
- Insider trading data overlay (SEC Form 4)
- Earnings calendar integration

**P4 – Live Trading (Future)**
- Broker API integration (IBKR, Alpaca, etc.)
- Risk management rules (position sizing, max loss)
- Real-money execution with paper-tested strategies

---

## Success Metrics

**Latency & Reliability:**
- Alert latency < 60 seconds from signal detection
- 98%+ SMS delivery rate
- 99%+ dashboard uptime

**Signal Quality:**
- 30%+ of signals profitable within 24h (paper trading)
- False positive rate < 40% (signals that move <5% in either direction)
- Average return per signal > 10% (for profitable trades)

**User Engagement:**
- Daily active users (DAU) tracking
- Average signals per day: 5-20 (adjust filters if too noisy/quiet)

---

## Technical Considerations & Risks

### Data Quality Risks
- **Free API limitations**: Most free tiers have 15min+ delays or rate limits
  - *Risk Level*: HIGH
  - *Mitigation*: Budget for paid API tier (Tradier, Intrinio ~$50-200/mo) if latency is critical

- **Stale Open Interest**: OI only updates EOD
  - *Risk Level*: MEDIUM
  - *Mitigation*: Accept limitation for MVP; document in dashboard ("OI as of prior close")

### Small-Cap Specific Challenges
- **Illiquidity**: Low volume, wide spreads, gap risk
  - *Risk Level*: MEDIUM
  - *Mitigation*: Filter out options with >10% bid-ask spread; require minimum average volume

- **Corporate actions**: Splits, dividends, acquisitions can invalidate options data
  - *Risk Level*: LOW
  - *Mitigation*: Subscribe to corporate actions feed (Phase 3)

### Execution Risks (Future Live Trading)
- **Slippage**: Paper trading won't reflect real fills in illiquid options
  - *Risk Level*: HIGH (when live)
  - *Mitigation*: Extended paper trading period; start with liquid underlyings only

---

## Future Enhancements (Post-MVP)

- **Multi-leg strategies**: Detect spreads, straddles, unusual combinations
- **Sentiment integration**: Twitter/Reddit mention spikes for tickers with UOA
- **Machine learning**: Train model on historical UOA signals → next-day returns
- **Backtesting engine**: Historical UOA data → strategy optimization
- **Mobile app**: React Native app for push notifications
- **Unusual Whales API**: Upgrade to premium data provider for better signal quality

---

## Appendix: Unusual Options "Rules of Thumb"

### What Makes Activity "Unusual"?
1. **Volume spike**: 3x+ above normal (we use OI as proxy for "normal")
2. **Size matters**: Large premium ($25k+) indicates institutional interest
3. **Timeframe**: Near-term expiry (<45 DTE) suggests catalyst-driven positioning
4. **Directionality**: Calls = bullish, Puts = bearish (or hedging)
5. **Moneyness**: OTM = higher conviction (more leverage, less hedging)

### Signal Confidence Hierarchy (Strongest → Weakest)
1. **High-conviction**: Volume >5x OI, >$100k premium, <30 DTE, >10% OTM
2. **Medium-conviction**: Volume 3-5x OI, $25-100k premium, 30-45 DTE, at-the-money
3. **Low-conviction**: Volume ~3x OI, ~$25k premium, near ATM or ITM (likely hedging)

### Why Small/Mid-Caps?
- Less analyst coverage → information asymmetry
- Lower institutional ownership → unusual activity more meaningful
- Higher volatility → bigger % moves on catalysts
- Retail often late to react → edge opportunity

**Trade-off**: Less liquidity = harder to execute at desired prices (especially critical for live trading phase)
