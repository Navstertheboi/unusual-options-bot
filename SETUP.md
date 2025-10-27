# Unusual Options Bot - Setup Guide

## Quick Start

### 1. Supabase Setup (5 minutes)

#### A. Create Supabase Project
1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click **"New Project"**
3. Fill in:
   - Name: `unusual-options-bot`
   - Database Password: (save this!)
   - Region: Choose closest to you
4. Click **"Create new project"** (takes ~2 minutes)

#### B. Get API Credentials
Once your project is created:

1. Go to **Settings** (gear icon) → **API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public** key: `eyJhbG...` (long string)
   - **service_role** key: `eyJhbG...` (different long string, keep secret!)

#### C. Add to .env File
Open `/Users/ivanknoepflmacher/tradingbot/.env` and add:

```bash
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_role_key_here
```

#### D. Run the Database Schema
1. Go to your Supabase project dashboard
2. Click **SQL Editor** (in left sidebar)
3. Click **"New query"**
4. Open `/Users/ivanknoepflmacher/tradingbot/supabase_schema.sql`
5. Copy **ALL** the SQL code
6. Paste into Supabase SQL Editor
7. Click **"Run"** (bottom right)
8. Wait for "Success. No rows returned" message

#### E. Verify Setup
```bash
npx tsx src/init-database.ts
```

You should see all tables marked with ✅

---

### 2. Twilio Setup (3 minutes)

#### A. Sign Up for Twilio
1. Go to [twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up (free trial gives you $15 credit)
3. Verify your phone number

#### B. Get Credentials
From the Twilio Console:
1. Copy **Account SID**: `ACxxxxx...`
2. Copy **Auth Token**: `xxxxx...` (click "show" to reveal)
3. Get a phone number:
   - Click **"Get a trial number"**
   - Accept the number (format: `+1234567890`)

#### C. Add to .env File
```bash
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
ALERT_RECIPIENT_PHONE=+1YOUR_PHONE_NUMBER
```

**Note**: For trial accounts, you can only send to verified phone numbers. Verify your personal number in Twilio Console.

#### D. Test SMS
```bash
npx tsx src/test-twilio.ts
```

You should receive a test SMS!

---

### 3. Run the Scanner

#### Test Mode (One-Time Scan)
```bash
npm run scan
```

This will:
- Scan your watchlist tickers (NVDA, PLTR, SOFI)
- Detect unusual options activity
- Save signals to Supabase
- Send SMS alerts

#### Continuous Mode (Every 1 Minute)
```bash
npm run dev
```

This runs the scanner continuously during market hours.

---

## Configuration

### Signal Detection Thresholds

Edit these in `.env`:

```bash
MIN_PREMIUM=25000           # Minimum $25k trade premium
MIN_VOLUME_OI_RATIO=3.0     # Volume must be 3x open interest
MIN_ABSOLUTE_VOLUME=100     # Minimum 100 contracts traded
MAX_DTE=45                  # Maximum 45 days to expiration
MIN_OTM_PERCENT=10          # Prefer options >10% OTM
```

### Scanner Frequency

```bash
SCAN_INTERVAL_MS=60000      # Scan every 60 seconds (1 minute)
```

**Warning**: Be mindful of API rate limits. Free Tradier sandbox might have limits.

---

## Project Structure

```
tradingbot/
├── src/
│   ├── clients/
│   │   ├── tradier.ts          # Tradier API client
│   │   └── supabase.ts         # Supabase database client
│   ├── services/
│   │   ├── signalDetector.ts   # Unusual activity detection logic
│   │   └── alertService.ts     # SMS alert service (Twilio)
│   ├── types/
│   │   └── index.ts            # TypeScript type definitions
│   ├── utils/
│   │   ├── calculations.ts     # Options math (moneyness, premium, etc.)
│   │   └── config.ts           # Configuration loader
│   ├── scanner.ts              # Main scanner loop
│   ├── test-tradier.ts         # Test Tradier API
│   ├── test-supabase.ts        # Test Supabase connection
│   └── init-database.ts        # Database verification script
├── supabase_schema.sql         # Database schema (run in Supabase)
├── package.json
└── .env                        # Your credentials (DO NOT COMMIT!)
```

---

## Troubleshooting

### "API connection failed"
- Check your `TRADIER_API_KEY` in `.env`
- Ensure you're using `https://sandbox.tradier.com/v1` for paper trading account

### "Supabase connection failed"
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in `.env`
- Check that you ran the SQL schema in Supabase SQL Editor

### "No signals detected"
- The market might be closed
- Try lowering thresholds in `.env` (e.g., `MIN_PREMIUM=10000`)
- Check different tickers with more options activity

### "SMS not received"
- For Twilio trial accounts, verify recipient phone number in console
- Check `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`
- Ensure phone numbers include country code (e.g., `+1234567890`)

---

## Next Steps

1. ✅ **Tradier API** - Connected and working
2. 🔄 **Supabase** - Set up project and run schema
3. 🔄 **Twilio** - Get SMS credentials
4. ⏭️ **Scanner** - Run continuous monitoring
5. ⏭️ **Lovable Dashboard** - Build frontend to visualize signals
6. ⏭️ **Paper Trading** - Automatically track P/L on detected signals

---

## Support

- Tradier API Docs: https://docs.tradier.com
- Supabase Docs: https://supabase.com/docs
- Twilio Docs: https://www.twilio.com/docs

---

## Security Notes

- **Never commit `.env` file** (already in `.gitignore`)
- Keep your `SUPABASE_SERVICE_KEY` secret (it has full database access)
- Keep your `TWILIO_AUTH_TOKEN` secret
- For production, use environment variables on your hosting platform
