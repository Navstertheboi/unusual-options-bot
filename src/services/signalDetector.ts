import type { TradierQuote, UnusualSignal, SignalConfig } from '../types';
import {
  calculateDTE,
  calculatePremium,
  calculateBidAskSpread,
  calculateMoneyness,
  categorizeMoneyness,
  calculateSignalStrength,
  meetsUnusualCriteria,
} from '../utils/calculations';

export class SignalDetector {
  private config: SignalConfig;

  constructor(config: SignalConfig) {
    this.config = config;
  }

  /**
   * Analyze a quote to determine if it's an unusual signal
   * Returns UnusualSignal if it meets criteria, null otherwise
   */
  analyzeQuote(
    optionQuote: TradierQuote,
    underlyingQuote: TradierQuote
  ): UnusualSignal | null {
    // Validate this is an option quote
    if (optionQuote.type !== 'option' || !optionQuote.option_type) {
      return null;
    }

    // Validate underlying is a stock/ETF
    if (!['stock', 'etf'].includes(underlyingQuote.type)) {
      return null;
    }

    // Extract required fields
    const {
      symbol,
      description,
      option_type,
      strike,
      expiration_date,
      volume,
      open_interest,
      last,
      bid,
      ask,
      bidsize,
      asksize,
      contract_size = 100,
      greeks,
      trade_date,
      exch,
      underlying,
    } = optionQuote;

    // Validate required fields exist
    if (
      !expiration_date ||
      !strike ||
      volume === undefined ||
      open_interest === undefined ||
      !underlying
    ) {
      return null;
    }

    // Calculate metrics
    const dte = calculateDTE(expiration_date);
    const premium = calculatePremium(last, volume, contract_size);
    const volumeOiRatio = open_interest > 0 ? volume / open_interest : 0;
    const bidAskSpread = bid && ask ? calculateBidAskSpread(bid, ask) : null;
    const moneyness = calculateMoneyness(strike, underlyingQuote.last, option_type);
    const moneynessCategory = categorizeMoneyness(moneyness);
    const signalStrength = calculateSignalStrength(volumeOiRatio, premium, dte, moneyness);

    // Check if meets unusual criteria
    const criteriaCheck = meetsUnusualCriteria(volume, open_interest, premium, dte, this.config);

    if (!criteriaCheck.meets) {
      // console.log(`Signal rejected: ${criteriaCheck.reason}`);
      return null;
    }

    // Additional filter: prefer OTM options if configured
    if (this.config.minOtmPercent > 0 && Math.abs(moneyness) < this.config.minOtmPercent) {
      // Allow ATM and ITM but mark as lower priority
      // Don't reject completely - user might want to see them
    }

    // Build unusual signal object
    const signal: UnusualSignal = {
      symbol,
      ticker: underlying,
      description: description || null,
      option_type,
      strike,
      expiration_date,
      dte,
      contract_size,
      volume,
      open_interest,
      volume_oi_ratio: Math.round(volumeOiRatio * 100) / 100,
      premium: Math.round(premium * 100) / 100,
      last_price: last,
      bid: bid || null,
      ask: ask || null,
      bid_size: bidsize || null,
      ask_size: asksize || null,
      bid_ask_spread_pct: bidAskSpread,
      underlying_price: underlyingQuote.last,
      underlying_change: underlyingQuote.change || null,
      underlying_change_pct: underlyingQuote.change_percentage || null,
      delta: greeks?.delta || null,
      gamma: greeks?.gamma || null,
      theta: greeks?.theta || null,
      vega: greeks?.vega || null,
      rho: greeks?.rho || null,
      phi: greeks?.phi || null,
      implied_volatility: greeks?.mid_iv || greeks?.smv_vol || null,
      greeks_updated_at: greeks?.updated_at || null,
      moneyness: Math.round(moneyness * 100) / 100,
      moneyness_category: moneynessCategory,
      signal_strength: signalStrength,
      trade_date: trade_date || null,
      exchange: exch || null,
    };

    return signal;
  }

  /**
   * Batch analyze multiple option quotes against their underlying
   */
  analyzeMultipleQuotes(
    optionQuotes: TradierQuote[],
    underlyingQuote: TradierQuote
  ): UnusualSignal[] {
    const signals: UnusualSignal[] = [];

    for (const optionQuote of optionQuotes) {
      const signal = this.analyzeQuote(optionQuote, underlyingQuote);
      if (signal) {
        signals.push(signal);
      }
    }

    return signals;
  }

  /**
   * Update detection configuration
   */
  updateConfig(newConfig: Partial<SignalConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   */
  getConfig(): SignalConfig {
    return { ...this.config };
  }
}
