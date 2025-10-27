// Type definitions for Unusual Options Bot

// Tradier API Types
export interface TradierQuote {
  symbol: string;
  description: string;
  exch: string;
  type: 'stock' | 'option' | 'etf' | 'index';
  last: number;
  change: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  close: number | null;
  bid: number;
  ask: number;
  underlying?: string;
  strike?: number;
  change_percentage: number;
  average_volume: number;
  last_volume: number;
  trade_date: number;
  prevclose: number;
  week_52_high: number;
  week_52_low: number;
  bidsize: number;
  bidexch: string;
  bid_date: number;
  asksize: number;
  askexch: string;
  ask_date: number;
  open_interest?: number;
  contract_size?: number;
  expiration_date?: string;
  expiration_type?: string;
  option_type?: 'call' | 'put';
  root_symbol?: string;
  greeks?: TradierGreeks;
}

export interface TradierGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  phi: number;
  bid_iv: number;
  mid_iv: number;
  ask_iv: number;
  smv_vol: number;
  updated_at: string;
}

export interface TradierQuotesResponse {
  quotes: {
    quote: TradierQuote | TradierQuote[];
  };
}

export interface TradierOptionsChain {
  options: {
    option: TradierOption[];
  };
}

export interface TradierOption {
  symbol: string;
  description: string;
  exch: string;
  type: string;
  last: number;
  change: number;
  volume: number;
  open: number;
  high: number;
  low: number;
  close: number | null;
  bid: number;
  ask: number;
  underlying: string;
  strike: number;
  greeks: TradierGreeks;
  change_percentage: number;
  average_volume: number;
  last_volume: number;
  trade_date: number;
  prevclose: number;
  week_52_high: number;
  week_52_low: number;
  bidsize: number;
  bidexch: string;
  bid_date: number;
  asksize: number;
  askexch: string;
  ask_date: number;
  open_interest: number;
  contract_size: number;
  expiration_date: string;
  expiration_type: string;
  option_type: 'call' | 'put';
  root_symbol: string;
}

// Database Types (matching Supabase schema)
export interface UnusualSignal {
  id?: string;
  symbol: string;
  ticker: string;
  description: string | null;
  option_type: 'call' | 'put';
  strike: number;
  expiration_date: string;
  dte: number;
  contract_size: number;
  volume: number;
  open_interest: number;
  volume_oi_ratio: number;
  premium: number;
  last_price: number;
  bid: number | null;
  ask: number | null;
  bid_size: number | null;
  ask_size: number | null;
  bid_ask_spread_pct: number | null;
  underlying_price: number;
  underlying_change: number | null;
  underlying_change_pct: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  rho: number | null;
  phi: number | null;
  implied_volatility: number | null;
  greeks_updated_at: string | null;
  moneyness: number | null;
  moneyness_category: 'deep_itm' | 'itm' | 'atm' | 'otm' | 'deep_otm' | null;
  signal_strength: 'high' | 'medium' | 'low' | null;
  detected_at?: string;
  trade_date: number | null;
  exchange: string | null;
}

export interface PaperTrade {
  id?: string;
  signal_id: string;
  direction: 'long' | 'short';
  quantity: number;
  entry_price: number;
  entry_time?: string;
  entry_underlying_price: number | null;
  exit_price: number | null;
  exit_time: string | null;
  exit_underlying_price: number | null;
  exit_reason: 'manual' | 'time_limit' | 'expired' | 'stop_loss' | 'take_profit' | null;
  pnl: number | null;
  pnl_pct: number | null;
  max_pnl: number | null;
  max_pnl_pct: number | null;
  min_pnl: number | null;
  min_pnl_pct: number | null;
  status: 'open' | 'closed' | 'expired';
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StockWatchlist {
  id?: string;
  ticker: string;
  company_name: string | null;
  market_cap: number | null;
  sector: string | null;
  industry: string | null;
  enabled: boolean;
  min_premium: number;
  min_volume_oi_ratio: number;
  added_at?: string;
  last_scanned_at: string | null;
  notes: string | null;
}

// Signal Detection Configuration
export interface SignalConfig {
  minPremium: number;
  minVolumeOiRatio: number;
  minAbsoluteVolume: number;
  maxDte: number;
  minOtmPercent: number;
}

// Alert Types
export interface AlertMessage {
  signal: UnusualSignal;
  formattedMessage: string;
}

export interface SMSAlert {
  id?: string;
  signal_id: string;
  recipient_phone: string;
  message_body: string;
  twilio_sid: string | null;
  twilio_status: string | null;
  twilio_error_code: string | null;
  twilio_error_message: string | null;
  sent_at?: string;
  delivered_at: string | null;
  alert_type: 'signal_detected' | 'trade_update' | 'daily_summary';
}

// Utility Types
export type MoneynessCategory = 'deep_itm' | 'itm' | 'atm' | 'otm' | 'deep_otm';
export type SignalStrength = 'high' | 'medium' | 'low';
