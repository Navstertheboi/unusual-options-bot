# 🤖 Unusual Options Activity Bot

A real-time options scanner that detects unusual trading activity, tracks paper trades, and sends SMS alerts.

## ✨ Features

- ✅ **Real-time Options Scanning** - Monitors watchlist for unusual volume/open interest ratios
- ✅ **Intelligent Signal Detection** - Filters by premium, DTE, moneyness, and signal strength
- ✅ **Automated Paper Trading** - Simulates trades and tracks P/L over 24 hours
- ✅ **SMS Alerts** - Twilio integration for instant notifications (optional)
- ✅ **Supabase Database** - Stores all signals, trades, and performance data
- ✅ **Lovable-Ready** - Database schema compatible with Lovable frontend

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` and add your credentials:
- **Tradier API** (sandbox or brokerage account)
- **Supabase** (project URL + service key)
- **Twilio** (optional, for SMS alerts)

### 3. Initialize Database
The SQL schema has already been run in Supabase at:
https://supabase.com/dashboard/project/mpjswlvzbnrofbyqazyp/editor

### 4. Run the Scanner

**One-time scan:**
```bash
npm run scan
```

**Continuous monitoring (every 60s):**
```bash
npm run dev
```

**View dashboard:**
```bash
npm run dashboard
```

---

## 📊 Current Status

### Detected Signals
**30 unusual signals** detected across 4 tickers:
- NVDA: 7 signals
- PLTR: 12 signals
- RBLX: 6 signals
- SOFI: 5 signals

### Notable Signals
1. **RBLX $80 PUT** - 253.83x Vol/OI ratio
2. **RBLX $117 PUT** - 140.3x Vol/OI ratio
3. **SOFI $29.5 PUT** - 24.17x Vol/OI ratio
4. **SOFI $19 PUT** - 23.28x Vol/OI (HIGH strength)
5. **NVDA $210 PUT** - 18.42x Vol/OI, $827k premium

All signals are stored in Supabase and ready for the Lovable dashboard!

---

## 🎯 Detection Criteria

### Current Thresholds
- **Premium**: ≥ $25,000
- **Volume/OI Ratio**: ≥ 3.0x
- **Min Volume**: ≥ 100 contracts
- **DTE**: ≤ 45 days
- **Moneyness**: Prefer ≥10% OTM

### Signal Strength
- **HIGH**: Vol/OI ≥5x, Premium ≥$100k, DTE ≤30, ≥10% OTM
- **MEDIUM**: Vol/OI ≥3x, Premium ≥$25k, DTE ≤45
- **LOW**: Just meets minimum criteria

---

## 📁 Project Structure

```
tradingbot/
├── src/
│   ├── clients/
│   │   ├── tradier.ts          # Tradier API wrapper
│   │   └── supabase.ts         # Supabase database client
│   ├── services/
│   │   ├── signalDetector.ts   # Unusual activity detection
│   │   ├── alertService.ts     # Twilio SMS alerts
│   │   └── paperTrading.ts     # Paper trading simulation
│   ├── types/
│   │   └── index.ts            # TypeScript definitions
│   ├── utils/
│   │   ├── calculations.ts     # Options math utilities
│   │   └── config.ts           # Configuration loader
│   ├── scanner.ts              # Main scanner loop
│   ├── view-dashboard.ts       # Terminal dashboard
│   └── test-tradier.ts         # API testing script
├── supabase_schema.sql         # Database schema (already run)
├── package.json
├── .env                        # Your credentials
└── README.md
```

---

## 🗄️ Database Schema

### Tables
- `unusual_signals` - Detected options activity
- `paper_trades` - Simulated trades with P/L
- `paper_trade_snapshots` - Price history for charting
- `alert_log` - SMS notification history
- `stock_watchlist` - Tickers to monitor
- `api_rate_limits` - API usage tracking

### Views
- `signals_with_trades` - Joins signals + trades
- `performance_summary` - Aggregate P/L statistics

---

## 💼 Paper Trading

### How It Works
1. **Auto-Enter**: When a signal is detected, automatically enters a paper trade
2. **Entry Price**: Uses mid-price (bid + ask) / 2 for realism
3. **Monitoring**: Updates P/L every scan cycle
4. **Exit Strategy**: Auto-closes after 24 hours or at expiration

### Configuration
Edit in `src/scanner.ts`:
```typescript
paperTrading = new PaperTradingService(tradier, supabase, {
  autoEnter: true,              // Auto-enter trades
  exitStrategy: 'time_limit',   // Exit after X hours
  timeLimitHours: 24,           // 24-hour hold period
  defaultQuantity: 1,           // 1 contract per trade
});
```

---

## 📱 SMS Alerts (Optional)

### Setup Twilio
1. Sign up at https://www.twilio.com/try-twilio
2. Get Account SID, Auth Token, and phone number
3. Add to `.env`:
```bash
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
ALERT_RECIPIENT_PHONE=+1YOUR_PHONE
```

### Alert Format
```
🔥 UNUSUAL OPTIONS DETECTED 📈

NVDA $210 PUT
Exp: 2025-10-31 (4d)

Vol: 350 (18.4x OI)
Premium: $827,750
Stock: $186.26
Moneyness: -12.8%
Strength: HIGH
```

---

## 🎨 Lovable Dashboard (Next Step)

### What's Ready
- ✅ Supabase database with all signals
- ✅ REST API automatically available
- ✅ Real-time subscriptions enabled
- ✅ 30 signals ready to display

### Lovable Integration
1. Create new Lovable project
2. Connect to Supabase:
   - URL: `https://mpjswlvzbnrofbyqazyp.supabase.co`
   - Anon Key: (use your `SUPABASE_ANON_KEY`)
3. Query the data:
```typescript
// Get recent signals
const { data } = await supabase
  .from('unusual_signals')
  .select('*')
  .order('detected_at', { ascending: false })
  .limit(50);

// Get performance summary
const { data: perf } = await supabase
  .from('performance_summary')
  .select('*')
  .single();
```

### Dashboard Features to Build
- **Signal Feed**: Live table of unusual activity
- **Ticker Pages**: Deep dive into specific stocks
- **Performance Charts**: P/L over time
- **Filters**: By ticker, date, signal strength
- **Watchlist Management**: Add/remove tickers

---

## 🔧 Configuration

### Signal Detection Thresholds
Edit in `.env`:
```bash
MIN_PREMIUM=25000           # $25k minimum trade size
MIN_VOLUME_OI_RATIO=3.0     # 3x volume vs open interest
MIN_ABSOLUTE_VOLUME=100     # 100 contracts minimum
MAX_DTE=45                  # 45 days to expiration max
MIN_OTM_PERCENT=10          # Prefer 10%+ OTM options
```

### Scanner Frequency
```bash
SCAN_INTERVAL_MS=60000      # Scan every 60 seconds
```

---

## 📈 Commands

| Command | Description |
|---------|-------------|
| `npm run scan` | Run scanner once (testing) |
| `npm run dev` | Continuous monitoring (60s intervals) |
| `npm run dashboard` | View data in terminal |
| `npm run build` | Compile TypeScript |
| `npx tsx src/test-tradier.ts` | Test Tradier API |

---

## ⚙️ API Integrations

### Tradier
- **Current**: Sandbox (15-min delayed data)
- **For Production**: Open brokerage account for real-time
- **Rate Limits**: Be mindful of API quotas

### Supabase
- **Project**: mpjswlvzbnrofbyqazyp
- **Region**: Your selected region
- **Storage**: Unlimited on free tier

### Twilio (Optional)
- **Free Trial**: $15 credit
- **SMS Cost**: ~$0.0075 per message
- **Rate Limit**: ~1 msg/second

---

## 🚨 Important Notes

### Data Limitations
- **Open Interest**: Updates once daily (after market close)
- **Volume/OI Ratio**: Uses prior day's OI during trading hours
- **Greeks**: Updated hourly (from ORATS via Tradier)

### Best Practices
1. **Start Small**: Test with 1-2 tickers first
2. **Monitor API Usage**: Free tiers have limits
3. **Validate Signals**: Always confirm before real trading
4. **Paper Trade First**: Test strategy for 30+ days

---

## 🎯 Next Steps

### Phase 1: MVP (✅ COMPLETE)
- ✅ Tradier API integration
- ✅ Signal detection engine
- ✅ Supabase database
- ✅ Paper trading system
- ✅ Scanner automation

### Phase 2: Enhancement (In Progress)
- ⏭️ Twilio SMS alerts
- ⏭️ Lovable dashboard
- ⏭️ Real-time P/L tracking
- ⏭️ Advanced filtering

### Phase 3: Production
- 🔜 Real-time data (Tradier brokerage account)
- 🔜 Multiple watchlists
- 🔜 Custom alert rules
- 🔜 Performance analytics
- 🔜 Mobile app (React Native)

### Phase 4: Advanced
- 🔜 Machine learning predictions
- 🔜 Backtesting engine
- 🔜 Multi-leg strategies
- 🔜 Sentiment analysis
- 🔜 Live broker integration

---

## 📚 Resources

- **Tradier API Docs**: https://docs.tradier.com
- **Supabase Docs**: https://supabase.com/docs
- **Twilio Docs**: https://www.twilio.com/docs
- **Options Trading**: https://www.investopedia.com/options-basics-tutorial-4583012

---

## ⚠️ Disclaimer

This bot is for **educational and research purposes only**. It detects unusual options activity but does NOT provide investment advice. Options trading involves substantial risk and is not suitable for every investor. Always do your own research and consult with a financial advisor before making any trading decisions.

The paper trading feature simulates trades but does NOT account for:
- Slippage and execution delays
- Bid-ask spread costs
- Commission fees
- Market impact
- Liquidity constraints

Past performance does not guarantee future results.

---

## 📝 License

MIT License - feel free to modify and use for your own projects!

---

## 🙏 Acknowledgments

Built with:
- **Tradier** - Options market data
- **Supabase** - Database and real-time infrastructure
- **Twilio** - SMS notifications
- **TypeScript** - Type-safe development
- **ORATS** - Options Greeks (via Tradier)

---

**Happy Trading! 🚀📈**

For questions or issues, check the code or ask for help!
