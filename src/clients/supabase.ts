import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { UnusualSignal, PaperTrade, SMSAlert, StockWatchlist } from '../types';

export class SupabaseService {
  private client: SupabaseClient;

  constructor(url: string, serviceKey: string) {
    if (!url || !serviceKey) {
      throw new Error('Supabase URL and service key are required');
    }

    this.client = createClient(url, serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const { error } = await this.client.from('stock_watchlist').select('count').limit(1);
      return !error;
    } catch (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
  }

  // ============================================================================
  // UNUSUAL SIGNALS
  // ============================================================================

  /**
   * Insert a new unusual signal
   * Returns the inserted signal with ID
   */
  async insertSignal(signal: UnusualSignal): Promise<UnusualSignal | null> {
    try {
      const { data, error } = await this.client
        .from('unusual_signals')
        .insert([signal])
        .select()
        .single();

      if (error) {
        // Check if it's a duplicate
        if (error.code === '23505') {
          console.log(`Signal ${signal.symbol} already exists, skipping...`);
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error inserting signal:', error);
      throw error;
    }
  }

  /**
   * Insert multiple signals at once
   */
  async insertSignals(signals: UnusualSignal[]): Promise<UnusualSignal[]> {
    try {
      const { data, error } = await this.client
        .from('unusual_signals')
        .insert(signals)
        .select();

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error inserting signals:', error);
      throw error;
    }
  }

  /**
   * Get recent signals
   */
  async getRecentSignals(limit: number = 50): Promise<UnusualSignal[]> {
    try {
      const { data, error } = await this.client
        .from('unusual_signals')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching signals:', error);
      throw error;
    }
  }

  /**
   * Get signals for a specific ticker
   */
  async getSignalsByTicker(ticker: string, limit: number = 50): Promise<UnusualSignal[]> {
    try {
      const { data, error } = await this.client
        .from('unusual_signals')
        .select('*')
        .eq('ticker', ticker)
        .order('detected_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching signals by ticker:', error);
      throw error;
    }
  }

  /**
   * Check if signal already exists (avoid duplicates)
   */
  async signalExists(symbol: string, detectedAt: Date): Promise<boolean> {
    try {
      const { data, error } = await this.client
        .from('unusual_signals')
        .select('id')
        .eq('symbol', symbol)
        .gte('detected_at', new Date(detectedAt.getTime() - 60000).toISOString()) // Within 1 minute
        .lte('detected_at', new Date(detectedAt.getTime() + 60000).toISOString())
        .limit(1);

      if (error) throw error;

      return (data?.length || 0) > 0;
    } catch (error) {
      console.error('Error checking signal existence:', error);
      return false;
    }
  }

  // ============================================================================
  // PAPER TRADES
  // ============================================================================

  /**
   * Create a paper trade from a signal
   */
  async createPaperTrade(trade: Omit<PaperTrade, 'id' | 'created_at' | 'updated_at'>): Promise<PaperTrade | null> {
    try {
      const { data, error } = await this.client
        .from('paper_trades')
        .insert([trade])
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error creating paper trade:', error);
      throw error;
    }
  }

  /**
   * Update paper trade (for exit, P/L updates, etc.)
   */
  async updatePaperTrade(tradeId: string, updates: Partial<PaperTrade>): Promise<PaperTrade | null> {
    try {
      const { data, error } = await this.client
        .from('paper_trades')
        .update(updates)
        .eq('id', tradeId)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error updating paper trade:', error);
      throw error;
    }
  }

  /**
   * Get open paper trades
   */
  async getOpenTrades(): Promise<PaperTrade[]> {
    try {
      const { data, error } = await this.client
        .from('paper_trades')
        .select('*')
        .eq('status', 'open')
        .order('entry_time', { ascending: false });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching open trades:', error);
      throw error;
    }
  }

  /**
   * Get paper trade by signal ID
   */
  async getTradeBySignalId(signalId: string): Promise<PaperTrade | null> {
    try {
      const { data, error } = await this.client
        .from('paper_trades')
        .select('*')
        .eq('signal_id', signalId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows found
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching trade by signal ID:', error);
      return null;
    }
  }

  // ============================================================================
  // ALERTS
  // ============================================================================

  /**
   * Log SMS alert
   */
  async logAlert(alert: Omit<SMSAlert, 'id' | 'sent_at'>): Promise<SMSAlert | null> {
    try {
      const { data, error } = await this.client
        .from('alert_log')
        .insert([alert])
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error logging alert:', error);
      throw error;
    }
  }

  /**
   * Update alert status (e.g., when Twilio confirms delivery)
   */
  async updateAlertStatus(
    alertId: string,
    status: string,
    deliveredAt?: Date,
    errorCode?: string,
    errorMessage?: string
  ): Promise<void> {
    try {
      const updates: any = { twilio_status: status };
      if (deliveredAt) updates.delivered_at = deliveredAt.toISOString();
      if (errorCode) updates.twilio_error_code = errorCode;
      if (errorMessage) updates.twilio_error_message = errorMessage;

      const { error } = await this.client
        .from('alert_log')
        .update(updates)
        .eq('id', alertId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating alert status:', error);
      throw error;
    }
  }

  // ============================================================================
  // WATCHLIST
  // ============================================================================

  /**
   * Get enabled tickers from watchlist
   */
  async getWatchlist(): Promise<StockWatchlist[]> {
    try {
      const { data, error } = await this.client
        .from('stock_watchlist')
        .select('*')
        .eq('enabled', true)
        .order('ticker', { ascending: true });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching watchlist:', error);
      throw error;
    }
  }

  /**
   * Add ticker to watchlist
   */
  async addToWatchlist(ticker: StockWatchlist): Promise<StockWatchlist | null> {
    try {
      const { data, error } = await this.client
        .from('stock_watchlist')
        .insert([ticker])
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      throw error;
    }
  }

  /**
   * Update last scanned timestamp for a ticker
   */
  async updateLastScanned(ticker: string): Promise<void> {
    try {
      const { error } = await this.client
        .from('stock_watchlist')
        .update({ last_scanned_at: new Date().toISOString() })
        .eq('ticker', ticker);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating last scanned:', error);
    }
  }

  // ============================================================================
  // PERFORMANCE VIEWS
  // ============================================================================

  /**
   * Get performance summary
   */
  async getPerformanceSummary(): Promise<any> {
    try {
      const { data, error } = await this.client
        .from('performance_summary')
        .select('*')
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error fetching performance summary:', error);
      return null;
    }
  }

  /**
   * Get signals with trades (from view)
   */
  async getSignalsWithTrades(limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await this.client
        .from('signals_with_trades')
        .select('*')
        .limit(limit);

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error fetching signals with trades:', error);
      throw error;
    }
  }
}