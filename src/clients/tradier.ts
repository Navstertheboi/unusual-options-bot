import axios, { AxiosInstance } from 'axios';
import type { TradierQuote, TradierQuotesResponse, TradierOptionsChain } from '../types';

export class TradierClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string, apiUrl: string = 'https://sandbox.tradier.com/v1') {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: apiUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      timeout: 10000,
    });
  }

  /**
   * Get quotes for one or more symbols (stocks or options)
   * @param symbols - Single symbol or array of symbols
   * @param greeks - Include Greeks data (default: true)
   */
  async getQuotes(
    symbols: string | string[],
    greeks: boolean = true
  ): Promise<TradierQuote[]> {
    try {
      const symbolsParam = Array.isArray(symbols) ? symbols.join(',') : symbols;

      const response = await this.client.get<TradierQuotesResponse>('/markets/quotes', {
        params: {
          symbols: symbolsParam,
          greeks: greeks,
        },
      });

      // Handle both single quote and array of quotes
      const quotes = response.data.quotes.quote;
      return Array.isArray(quotes) ? quotes : [quotes];
    } catch (error) {
      console.error('Error fetching quotes from Tradier:', error);
      throw new Error(`Failed to fetch quotes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get options chain for a specific underlying symbol and expiration
   * @param symbol - Underlying symbol (e.g., 'NVDA')
   * @param expiration - Expiration date in YYYY-MM-DD format
   * @param greeks - Include Greeks data (default: true)
   */
  async getOptionsChain(
    symbol: string,
    expiration: string,
    greeks: boolean = true
  ): Promise<TradierOptionsChain> {
    try {
      const response = await this.client.get<TradierOptionsChain>('/markets/options/chains', {
        params: {
          symbol,
          expiration,
          greeks,
        },
      });

      return response.data;
    } catch (error) {
      console.error(`Error fetching options chain for ${symbol}:`, error);
      throw new Error(`Failed to fetch options chain: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get available expiration dates for an underlying symbol
   * @param symbol - Underlying symbol
   * @param includeAllRoots - Include all option roots
   * @param strikes - Filter by specific strikes
   */
  async getExpirations(
    symbol: string,
    includeAllRoots: boolean = false,
    strikes: boolean = false
  ): Promise<{ date: string[] }> {
    try {
      const response = await this.client.get('/markets/options/expirations', {
        params: {
          symbol,
          includeAllRoots,
          strikes,
        },
      });

      return response.data.expirations;
    } catch (error) {
      console.error(`Error fetching expirations for ${symbol}:`, error);
      throw new Error(`Failed to fetch expirations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get strikes for a specific expiration
   * @param symbol - Underlying symbol
   * @param expiration - Expiration date
   */
  async getStrikes(symbol: string, expiration: string): Promise<{ strike: number[] }> {
    try {
      const response = await this.client.get('/markets/options/strikes', {
        params: {
          symbol,
          expiration,
        },
      });

      return response.data.strikes;
    } catch (error) {
      console.error(`Error fetching strikes for ${symbol}:`, error);
      throw new Error(`Failed to fetch strikes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get option symbols for a specific underlying
   * Useful for scanning all options on a ticker
   * @param symbol - Underlying symbol
   */
  async getOptionSymbols(symbol: string): Promise<string[]> {
    try {
      const response = await this.client.get('/markets/options/lookup', {
        params: { underlying: symbol },
      });

      return response.data.symbols || [];
    } catch (error) {
      console.error(`Error fetching option symbols for ${symbol}:`, error);
      throw new Error(`Failed to fetch option symbols: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get market calendar (trading days, market hours, etc.)
   * @param month - Month (1-12)
   * @param year - Year (YYYY)
   */
  async getCalendar(month?: number, year?: number): Promise<any> {
    try {
      const response = await this.client.get('/markets/calendar', {
        params: { month, year },
      });

      return response.data.calendar;
    } catch (error) {
      console.error('Error fetching market calendar:', error);
      throw new Error(`Failed to fetch calendar: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get market status (open/closed)
   */
  async getMarketStatus(): Promise<{ date: string; status: string; description: string }> {
    try {
      const response = await this.client.get('/markets/clock');
      return response.data.clock;
    } catch (error) {
      console.error('Error fetching market status:', error);
      throw new Error(`Failed to fetch market status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if API key is valid and connection works
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.getMarketStatus();
      return true;
    } catch (error) {
      console.error('Tradier API connection test failed:', error);
      return false;
    }
  }
}
