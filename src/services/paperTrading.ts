import type { UnusualSignal, PaperTrade } from '../types';
import { TradierClient } from '../clients/tradier';
import { SupabaseService } from '../clients/supabase';
import { calculateMidPrice, calculatePnL } from '../utils/calculations';

export interface PaperTradeConfig {
  autoEnter: boolean; // Automatically enter trades on signals
  exitStrategy: 'time_limit' | 'manual'; // How to exit trades
  timeLimitHours: number; // Auto-exit after X hours
  defaultQuantity: number; // Number of contracts per trade
}

export class PaperTradingService {
  private tradier: TradierClient;
  private supabase: SupabaseService;
  private config: PaperTradeConfig;

  constructor(
    tradier: TradierClient,
    supabase: SupabaseService,
    config: Partial<PaperTradeConfig> = {}
  ) {
    this.tradier = tradier;
    this.supabase = supabase;
    this.config = {
      autoEnter: true,
      exitStrategy: 'time_limit',
      timeLimitHours: 24,
      defaultQuantity: 1,
      ...config,
    };
  }

  /**
   * Enter a paper trade from a signal
   * Uses mid-price (bid + ask) / 2 for realistic entry
   */
  async enterTrade(signal: UnusualSignal): Promise<PaperTrade | null> {
    try {
      // Check if trade already exists for this signal
      if (signal.id) {
        const existingTrade = await this.supabase.getTradeBySignalId(signal.id);
        if (existingTrade) {
          console.log(`   📊 Trade already exists for signal ${signal.symbol}`);
          return existingTrade;
        }
      }

      // Calculate entry price (use mid-price for realism)
      let entryPrice: number;
      if (signal.bid && signal.ask) {
        entryPrice = calculateMidPrice(signal.bid, signal.ask);
      } else {
        entryPrice = signal.last_price;
      }

      // Create paper trade
      const trade: Omit<PaperTrade, 'id' | 'created_at' | 'updated_at'> = {
        signal_id: signal.id!,
        direction: 'long', // Always go long on unusual activity
        quantity: this.config.defaultQuantity,
        entry_price: entryPrice,
        entry_underlying_price: signal.underlying_price,
        exit_price: null,
        exit_time: null,
        exit_underlying_price: null,
        exit_reason: null,
        pnl: null,
        pnl_pct: null,
        max_pnl: null,
        max_pnl_pct: null,
        min_pnl: null,
        min_pnl_pct: null,
        status: 'open',
        notes: `Auto-entered from ${signal.signal_strength} strength signal`,
      };

      const insertedTrade = await this.supabase.createPaperTrade(trade);

      if (insertedTrade) {
        console.log(`   💰 Entered paper trade: ${signal.symbol} @ $${entryPrice.toFixed(2)}`);
      }

      return insertedTrade;
    } catch (error) {
      console.error(`Error entering paper trade:`, error);
      return null;
    }
  }

  /**
   * Update an open paper trade with current price
   * Calculates current P/L and updates max/min
   */
  async updateTrade(trade: PaperTrade, currentPrice: number, underlyingPrice: number): Promise<void> {
    try {
      // Calculate current P/L
      const { pnl, pnlPct } = calculatePnL(
        trade.entry_price,
        currentPrice,
        trade.quantity,
        100
      );

      // Update max/min P/L
      const maxPnl = Math.max(trade.max_pnl || pnl, pnl);
      const minPnl = Math.min(trade.min_pnl || pnl, pnl);
      const maxPnlPct = Math.max(trade.max_pnl_pct || pnlPct, pnlPct);
      const minPnlPct = Math.min(trade.min_pnl_pct || pnlPct, pnlPct);

      await this.supabase.updatePaperTrade(trade.id!, {
        max_pnl: maxPnl,
        min_pnl: minPnl,
        max_pnl_pct: maxPnlPct,
        min_pnl_pct: minPnlPct,
      });

      // Log snapshot
      // await this.logSnapshot(trade.id!, currentPrice, underlyingPrice, pnl, pnlPct);

    } catch (error) {
      console.error(`Error updating trade ${trade.id}:`, error);
    }
  }

  /**
   * Exit a paper trade
   */
  async exitTrade(
    trade: PaperTrade,
    exitPrice: number,
    underlyingPrice: number,
    reason: 'manual' | 'time_limit' | 'expired' | 'stop_loss' | 'take_profit'
  ): Promise<PaperTrade | null> {
    try {
      // Calculate final P/L
      const { pnl, pnlPct } = calculatePnL(
        trade.entry_price,
        exitPrice,
        trade.quantity,
        100
      );

      // Update trade
      const updatedTrade = await this.supabase.updatePaperTrade(trade.id!, {
        exit_price: exitPrice,
        exit_time: new Date().toISOString(),
        exit_underlying_price: underlyingPrice,
        exit_reason: reason,
        pnl,
        pnl_pct: pnlPct,
        status: 'closed',
      });

      if (updatedTrade) {
        const profitEmoji = pnl >= 0 ? '✅' : '❌';
        console.log(
          `   ${profitEmoji} Closed trade: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`
        );
      }

      return updatedTrade;
    } catch (error) {
      console.error(`Error exiting trade ${trade.id}:`, error);
      return null;
    }
  }

  /**
   * Monitor open trades and update their P/L
   * Should be called periodically (e.g., every 15 min during market hours)
   */
  async monitorOpenTrades(): Promise<void> {
    try {
      console.log('\n💼 Monitoring open paper trades...');

      const openTrades = await this.supabase.getOpenTrades();

      if (openTrades.length === 0) {
        console.log('   No open trades to monitor\n');
        return;
      }

      console.log(`   Found ${openTrades.length} open trade(s)\n`);

      for (const trade of openTrades) {
        try {
          // Get signal details
          const signals = await this.supabase.getSignalsByTicker('', 1000);
          const signal = signals.find(s => s.id === trade.signal_id);

          if (!signal) {
            console.log(`   ⚠️  Signal not found for trade ${trade.id}`);
            continue;
          }

          // Get current quote for the option
          const quotes = await this.tradier.getQuotes(signal.symbol, false);

          if (!quotes || quotes.length === 0) {
            console.log(`   ⚠️  No quote data for ${signal.symbol}`);
            continue;
          }

          const quote = quotes[0];
          const currentPrice = quote.bid && quote.ask
            ? calculateMidPrice(quote.bid, quote.ask)
            : quote.last;

          // Get underlying quote
          const underlyingQuotes = await this.tradier.getQuotes(signal.ticker, false);
          const underlyingPrice = underlyingQuotes[0]?.last || 0;

          // Calculate current P/L
          const { pnl, pnlPct } = calculatePnL(
            trade.entry_price,
            currentPrice,
            trade.quantity,
            100
          );

          console.log(`   📊 ${signal.symbol}`);
          console.log(`      Entry: $${trade.entry_price.toFixed(2)} → Current: $${currentPrice.toFixed(2)}`);
          console.log(`      P/L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`);

          // Update trade
          await this.updateTrade(trade, currentPrice, underlyingPrice);

          // Check if should auto-exit based on time limit
          if (this.config.exitStrategy === 'time_limit') {
            const entryTime = new Date(trade.entry_time).getTime();
            const now = Date.now();
            const hoursOpen = (now - entryTime) / (1000 * 60 * 60);

            if (hoursOpen >= this.config.timeLimitHours) {
              console.log(`      ⏱️  Time limit reached (${this.config.timeLimitHours}h), closing trade...`);
              await this.exitTrade(trade, currentPrice, underlyingPrice, 'time_limit');
            }
          }

          // Check expiration
          const daysToExpiry = Math.floor(
            (new Date(signal.expiration_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );

          if (daysToExpiry <= 0) {
            console.log(`      ⏰ Option expired, closing trade...`);
            await this.exitTrade(trade, currentPrice, underlyingPrice, 'expired');
          }

          console.log('');

          // Small delay to avoid rate limits
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error(`   ❌ Error monitoring trade ${trade.id}:`, error);
        }
      }

      console.log('✅ Trade monitoring complete\n');

    } catch (error) {
      console.error('Error monitoring trades:', error);
    }
  }

  /**
   * Get performance statistics for paper trades
   */
  async getPerformanceStats(): Promise<{
    totalTrades: number;
    openTrades: number;
    closedTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalPnL: number;
    avgPnL: number;
    bestTrade: number;
    worstTrade: number;
  }> {
    try {
      const summary = await this.supabase.getPerformanceSummary();

      return {
        totalTrades: summary?.total_trades || 0,
        openTrades: (summary?.total_trades || 0) - (summary?.winning_trades || 0) - (summary?.losing_trades || 0),
        closedTrades: (summary?.winning_trades || 0) + (summary?.losing_trades || 0),
        winningTrades: summary?.winning_trades || 0,
        losingTrades: summary?.losing_trades || 0,
        winRate: summary?.win_rate_pct || 0,
        totalPnL: summary?.total_pnl || 0,
        avgPnL: summary?.avg_pnl || 0,
        bestTrade: summary?.max_pnl || 0,
        worstTrade: summary?.min_pnl || 0,
      };
    } catch (error) {
      console.error('Error getting performance stats:', error);
      return {
        totalTrades: 0,
        openTrades: 0,
        closedTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        totalPnL: 0,
        avgPnL: 0,
        bestTrade: 0,
        worstTrade: 0,
      };
    }
  }

  /**
   * Auto-enter trades for all new signals
   */
  async autoEnterSignals(signals: UnusualSignal[]): Promise<PaperTrade[]> {
    if (!this.config.autoEnter) {
      return [];
    }

    const trades: PaperTrade[] = [];

    for (const signal of signals) {
      if (!signal.id) continue;

      const trade = await this.enterTrade(signal);
      if (trade) {
        trades.push(trade);
      }
    }

    return trades;
  }
}
