/**
 * Main Scanner - Continuously monitors options for unusual activity
 * Run with: npm run scan
 */

import { TradierClient } from './clients/tradier';
import { SupabaseService } from './clients/supabase';
import { SignalDetector } from './services/signalDetector';
import { AlertService } from './services/alertService';
import { PaperTradingService } from './services/paperTrading';
import { loadConfig, validateConfig } from './utils/config';
import type { UnusualSignal, StockWatchlist } from './types';

class OptionsScanner {
  private tradier: TradierClient;
  private supabase: SupabaseService;
  private detector: SignalDetector;
  private alertService: AlertService | null = null;
  private paperTrading: PaperTradingService;
  private config: ReturnType<typeof loadConfig>;
  private isRunning: boolean = false;
  private scanCount: number = 0;

  constructor() {
    console.log('🤖 Initializing Unusual Options Scanner...\n');

    // Load configuration
    this.config = loadConfig();

    // Validate configuration
    const validation = validateConfig(this.config);

    // Initialize Tradier client
    this.tradier = new TradierClient(this.config.tradier.apiKey, this.config.tradier.apiUrl);
    console.log('✅ Tradier API initialized');

    // Initialize Supabase client
    if (validation.supabase) {
      this.supabase = new SupabaseService(
        this.config.supabase.url,
        this.config.supabase.serviceKey
      );
      console.log('✅ Supabase initialized');
    } else {
      throw new Error('Supabase credentials are required. Please add to .env file.');
    }

    // Initialize signal detector
    this.detector = new SignalDetector(this.config.signal);
    console.log('✅ Signal detector initialized');
    console.log(`   Thresholds: Premium ≥ $${this.config.signal.minPremium.toLocaleString()}, Vol/OI ≥ ${this.config.signal.minVolumeOiRatio}x, DTE ≤ ${this.config.signal.maxDte}d\n`);

    // Initialize paper trading
    this.paperTrading = new PaperTradingService(this.tradier, this.supabase, {
      autoEnter: true,
      exitStrategy: 'time_limit',
      timeLimitHours: 24,
      defaultQuantity: 1,
    });
    console.log('✅ Paper trading initialized (24h time limit)\n');

    // Initialize Twilio (optional)
    if (validation.twilio) {
      this.alertService = new AlertService(
        this.config.twilio.accountSid,
        this.config.twilio.authToken,
        this.config.twilio.phoneNumber,
        this.config.twilio.recipientPhone
      );
      console.log('✅ Twilio SMS alerts enabled\n');
    } else {
      console.log('⚠️  Twilio not configured - SMS alerts disabled\n');
    }
  }

  /**
   * Scan a single ticker for unusual options activity
   */
  private async scanTicker(ticker: StockWatchlist): Promise<UnusualSignal[]> {
    try {
      console.log(`📊 Scanning ${ticker.ticker}...`);

      // Get stock quote
      const stockQuotes = await this.tradier.getQuotes(ticker.ticker, false);
      if (!stockQuotes || stockQuotes.length === 0) {
        console.log(`   ⚠️  No quote data for ${ticker.ticker}`);
        return [];
      }

      const stockQuote = stockQuotes[0];
      console.log(`   Stock price: $${stockQuote.last.toFixed(2)} (${stockQuote.change_percentage >= 0 ? '+' : ''}${stockQuote.change_percentage.toFixed(2)}%)`);

      // Get available expirations
      const expirations = await this.tradier.getExpirations(ticker.ticker);
      if (!expirations.date || expirations.date.length === 0) {
        console.log(`   ⚠️  No expirations found for ${ticker.ticker}`);
        return [];
      }

      // Filter to expirations within our DTE limit
      const validExpirations = expirations.date.filter(exp => {
        const daysToExp = Math.floor((new Date(exp).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return daysToExp > 0 && daysToExp <= this.config.signal.maxDte;
      });

      console.log(`   Found ${validExpirations.length} valid expirations (≤${this.config.signal.maxDte} DTE)`);

      const allSignals: UnusualSignal[] = [];

      // Scan first 3 expirations (to avoid rate limits)
      const expirationsToScan = validExpirations.slice(0, 3);

      for (const expiration of expirationsToScan) {
        try {
          // Get options chain
          const chain = await this.tradier.getOptionsChain(ticker.ticker, expiration, true);

          if (!chain.options || !chain.options.option) {
            continue;
          }

          const options = Array.isArray(chain.options.option)
            ? chain.options.option
            : [chain.options.option];

          // Analyze options for unusual activity
          const signals = this.detector.analyzeMultipleQuotes(options, stockQuote);

          if (signals.length > 0) {
            console.log(`   ✅ Found ${signals.length} signal(s) for ${expiration}`);
            allSignals.push(...signals);
          }

          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error(`   ❌ Error scanning ${expiration}:`, error instanceof Error ? error.message : error);
        }
      }

      // Update last scanned timestamp
      await this.supabase.updateLastScanned(ticker.ticker);

      return allSignals;

    } catch (error) {
      console.error(`❌ Error scanning ${ticker.ticker}:`, error);
      return [];
    }
  }

  /**
   * Process detected signals (save to DB, send alerts)
   */
  private async processSignals(signals: UnusualSignal[]): Promise<void> {
    if (signals.length === 0) return;

    console.log(`\n🎯 Processing ${signals.length} signal(s)...\n`);

    for (const signal of signals) {
      try {
        // Check if signal already exists (avoid duplicates)
        const exists = await this.supabase.signalExists(
          signal.symbol,
          new Date()
        );

        if (exists) {
          console.log(`   ⏭️  Signal ${signal.symbol} already logged, skipping...`);
          continue;
        }

        // Insert signal into database
        const insertedSignal = await this.supabase.insertSignal(signal);

        if (!insertedSignal) {
          console.log(`   ⚠️  Signal ${signal.symbol} not inserted (possible duplicate)`);
          continue;
        }

        console.log(`   ✅ Saved: ${signal.ticker} $${signal.strike} ${signal.option_type.toUpperCase()}`);
        console.log(`      Premium: $${signal.premium.toLocaleString()}, Vol/OI: ${signal.volume_oi_ratio}x`);
        console.log(`      Strength: ${signal.signal_strength?.toUpperCase()}`);

        // Send SMS alert (if Twilio is configured)
        if (this.alertService && insertedSignal.id) {
          const alertResult = await this.alertService.sendSignalAlert(signal);

          if (alertResult.success) {
            // Log alert to database
            await this.supabase.logAlert({
              signal_id: insertedSignal.id,
              recipient_phone: this.config.twilio.recipientPhone,
              message_body: this.alertService.formatSignalMessage(signal),
              twilio_sid: alertResult.messageSid || null,
              twilio_status: 'sent',
              twilio_error_code: null,
              twilio_error_message: null,
              alert_type: 'signal_detected',
            });

            console.log(`      📱 SMS alert sent!`);
          } else {
            console.log(`      ⚠️  SMS alert failed: ${alertResult.error}`);
          }
        }

        console.log('');

      } catch (error) {
        console.error(`   ❌ Error processing signal:`, error);
      }
    }
  }

  /**
   * Run a single scan cycle
   */
  async runScan(): Promise<void> {
    this.scanCount++;
    const startTime = Date.now();

    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 Scan #${this.scanCount} - ${new Date().toLocaleString()}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
      // Check market status
      const marketStatus = await this.tradier.getMarketStatus();
      console.log(`📅 Market Status: ${marketStatus.status} - ${marketStatus.description}\n`);

      // Get watchlist
      const watchlist = await this.supabase.getWatchlist();

      if (watchlist.length === 0) {
        console.log('⚠️  Watchlist is empty. Add tickers to scan in Supabase.');
        return;
      }

      console.log(`📋 Scanning ${watchlist.length} ticker(s): ${watchlist.map(t => t.ticker).join(', ')}\n`);

      // Scan each ticker
      const allSignals: UnusualSignal[] = [];

      for (const ticker of watchlist) {
        const signals = await this.scanTicker(ticker);
        allSignals.push(...signals);

        // Delay between tickers to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Process all detected signals
      await this.processSignals(allSignals);

      // Auto-enter paper trades for new signals
      if (allSignals.length > 0) {
        console.log(`\n💼 Auto-entering paper trades...`);
        const trades = await this.paperTrading.autoEnterSignals(allSignals);
        console.log(`   Entered ${trades.length} paper trade(s)\n`);
      }

      // Monitor existing open trades
      await this.paperTrading.monitorOpenTrades();

      // Show performance stats
      const stats = await this.paperTrading.getPerformanceStats();
      if (stats.totalTrades > 0) {
        console.log(`📈 Paper Trading Performance:`);
        console.log(`   Total Trades: ${stats.totalTrades} (${stats.openTrades} open, ${stats.closedTrades} closed)`);
        console.log(`   Win Rate: ${stats.winRate.toFixed(1)}% (${stats.winningTrades}W / ${stats.losingTrades}L)`);
        console.log(`   Total P/L: $${stats.totalPnL.toFixed(2)}`);
        console.log(`   Avg P/L: $${stats.avgPnL.toFixed(2)}`);
        console.log(`   Best: $${stats.bestTrade.toFixed(2)} | Worst: $${stats.worstTrade.toFixed(2)}\n`);
      }

      // Summary
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`\n✅ Scan complete in ${duration}s`);

      if (allSignals.length > 0) {
        console.log(`   Found ${allSignals.length} unusual signal(s)`);
      } else {
        console.log(`   No unusual activity detected`);
      }

    } catch (error) {
      console.error('❌ Error during scan:', error);
    }
  }

  /**
   * Start continuous scanning
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Scanner is already running');
      return;
    }

    this.isRunning = true;
    console.log(`🚀 Starting continuous scanner (interval: ${this.config.scanner.intervalMs / 1000}s)\n`);

    // Run first scan immediately
    await this.runScan();

    // Schedule recurring scans
    const interval = setInterval(async () => {
      if (!this.isRunning) {
        clearInterval(interval);
        return;
      }

      await this.runScan();
    }, this.config.scanner.intervalMs);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n\n🛑 Shutting down scanner...');
      this.isRunning = false;
      clearInterval(interval);
      process.exit(0);
    });
  }

  /**
   * Run a single scan and exit (for testing)
   */
  async runOnce(): Promise<void> {
    await this.runScan();
    console.log('\n👋 Single scan complete. Exiting...\n');
  }
}

// Main execution
async function main() {
  try {
    const scanner = new OptionsScanner();

    // Check if running in one-time mode
    const isOnce = process.argv.includes('--once');

    if (isOnce) {
      await scanner.runOnce();
    } else {
      await scanner.start();
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the scanner
main();
