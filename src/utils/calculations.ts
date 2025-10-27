import { differenceInDays, parseISO } from 'date-fns';
import type { MoneynessCategory, SignalStrength } from '../types';

/**
 * Calculate days to expiration
 */
export function calculateDTE(expirationDate: string): number {
  const expiry = parseISO(expirationDate);
  const now = new Date();
  return differenceInDays(expiry, now);
}

/**
 * Calculate trade premium in dollars
 * Premium = Last Price * Volume * Contract Size
 */
export function calculatePremium(lastPrice: number, volume: number, contractSize: number = 100): number {
  return lastPrice * volume * contractSize;
}

/**
 * Calculate bid-ask spread percentage
 */
export function calculateBidAskSpread(bid: number, ask: number): number {
  if (bid <= 0 || ask <= 0) return 0;
  const mid = (bid + ask) / 2;
  return ((ask - bid) / mid) * 100;
}

/**
 * Calculate moneyness percentage
 * For calls: (Strike - Underlying) / Underlying * 100
 * For puts: (Underlying - Strike) / Underlying * 100
 * Positive = OTM, Negative = ITM
 */
export function calculateMoneyness(
  strike: number,
  underlyingPrice: number,
  optionType: 'call' | 'put'
): number {
  if (optionType === 'call') {
    return ((strike - underlyingPrice) / underlyingPrice) * 100;
  } else {
    return ((underlyingPrice - strike) / underlyingPrice) * 100;
  }
}

/**
 * Categorize moneyness
 */
export function categorizeMoneyness(moneynessPercent: number): MoneynessCategory {
  const abs = Math.abs(moneynessPercent);

  if (moneynessPercent < -10) return 'deep_itm';
  if (moneynessPercent < -2) return 'itm';
  if (abs <= 2) return 'atm';
  if (moneynessPercent <= 10) return 'otm';
  return 'deep_otm';
}

/**
 * Calculate signal strength based on multiple factors
 * High conviction: Volume >5x OI, >$100k premium, <30 DTE, >10% OTM
 * Medium conviction: Volume 3-5x OI, $25-100k premium, 30-45 DTE
 * Low conviction: Just meets minimum criteria
 */
export function calculateSignalStrength(
  volumeOiRatio: number,
  premium: number,
  dte: number,
  moneynessPercent: number
): SignalStrength {
  const absMoneyness = Math.abs(moneynessPercent);

  // High conviction
  if (
    volumeOiRatio >= 5.0 &&
    premium >= 100000 &&
    dte <= 30 &&
    absMoneyness >= 10
  ) {
    return 'high';
  }

  // Medium conviction
  if (
    volumeOiRatio >= 3.0 &&
    premium >= 25000 &&
    dte <= 45
  ) {
    return 'medium';
  }

  // Low conviction
  return 'low';
}

/**
 * Calculate mid price (average of bid and ask)
 */
export function calculateMidPrice(bid: number, ask: number): number {
  if (bid <= 0 || ask <= 0) return 0;
  return (bid + ask) / 2;
}

/**
 * Calculate P/L for a paper trade
 */
export function calculatePnL(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  contractSize: number = 100
): { pnl: number; pnlPct: number } {
  const pnl = (exitPrice - entryPrice) * quantity * contractSize;
  const pnlPct = ((exitPrice - entryPrice) / entryPrice) * 100;

  return {
    pnl: Math.round(pnl * 100) / 100, // Round to 2 decimals
    pnlPct: Math.round(pnlPct * 100) / 100,
  };
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

/**
 * Parse OCC option symbol
 * Format: TICKER + YY + MM + DD + C/P + STRIKE (5 digits, 3 decimals)
 * Example: NVDA250919C00175000 = NVDA Sep 19 2025 $175 Call
 */
export function parseOccSymbol(symbol: string): {
  ticker: string;
  year: number;
  month: number;
  day: number;
  optionType: 'call' | 'put';
  strike: number;
} | null {
  // OCC symbol format: [TICKER][YYMMDD][C/P][00000000]
  // Example: NVDA250919C00175000
  const match = symbol.match(/^([A-Z]+)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);

  if (!match) return null;

  const [, ticker, yy, mm, dd, type, strikeStr] = match;

  return {
    ticker,
    year: 2000 + parseInt(yy, 10),
    month: parseInt(mm, 10),
    day: parseInt(dd, 10),
    optionType: type === 'C' ? 'call' : 'put',
    strike: parseInt(strikeStr, 10) / 1000, // Strike is stored as integer * 1000
  };
}

/**
 * Validate if signal meets unusual criteria
 */
export function meetsUnusualCriteria(
  volume: number,
  openInterest: number,
  premium: number,
  dte: number,
  config: {
    minPremium: number;
    minVolumeOiRatio: number;
    minAbsoluteVolume: number;
    maxDte: number;
  }
): { meets: boolean; reason?: string } {
  // Check minimum absolute volume
  if (volume < config.minAbsoluteVolume) {
    return {
      meets: false,
      reason: `Volume ${volume} below minimum ${config.minAbsoluteVolume}`,
    };
  }

  // Check open interest exists (avoid division by zero)
  if (openInterest <= 0) {
    return {
      meets: false,
      reason: 'Open interest is zero',
    };
  }

  // Check volume/OI ratio
  const volumeOiRatio = volume / openInterest;
  if (volumeOiRatio < config.minVolumeOiRatio) {
    return {
      meets: false,
      reason: `Volume/OI ratio ${volumeOiRatio.toFixed(2)} below minimum ${config.minVolumeOiRatio}`,
    };
  }

  // Check premium
  if (premium < config.minPremium) {
    return {
      meets: false,
      reason: `Premium ${formatCurrency(premium)} below minimum ${formatCurrency(config.minPremium)}`,
    };
  }

  // Check DTE
  if (dte > config.maxDte || dte < 0) {
    return {
      meets: false,
      reason: `DTE ${dte} outside valid range (0-${config.maxDte})`,
    };
  }

  return { meets: true };
}
