import twilio from 'twilio';
import type { UnusualSignal, AlertMessage } from '../types';
import { formatCurrency, formatPercentage } from '../utils/calculations';

export class AlertService {
  private client: twilio.Twilio;
  private fromNumber: string;
  private toNumber: string;

  constructor(accountSid: string, authToken: string, fromNumber: string, toNumber: string) {
    if (!accountSid || !authToken) {
      throw new Error('Twilio Account SID and Auth Token are required');
    }

    if (!fromNumber || !toNumber) {
      throw new Error('Twilio phone numbers (from and to) are required');
    }

    this.client = twilio(accountSid, authToken);
    this.fromNumber = fromNumber;
    this.toNumber = toNumber;
  }

  /**
   * Format signal into human-readable SMS message
   */
  formatSignalMessage(signal: UnusualSignal): string {
    const {
      ticker,
      option_type,
      strike,
      expiration_date,
      dte,
      volume,
      open_interest,
      volume_oi_ratio,
      premium,
      underlying_price,
      signal_strength,
      moneyness,
    } = signal;

    // Emoji based on signal strength
    const strengthEmoji = {
      high: '🔥',
      medium: '⚡',
      low: '💡',
    }[signal_strength || 'low'];

    // Direction indicator
    const directionEmoji = option_type === 'call' ? '📈' : '📉';

    // Build message
    const lines = [
      `${strengthEmoji} UNUSUAL OPTIONS DETECTED ${directionEmoji}`,
      '',
      `${ticker} $${strike} ${option_type.toUpperCase()}`,
      `Exp: ${expiration_date} (${dte}d)`,
      '',
      `Vol: ${volume.toLocaleString()} (${volume_oi_ratio.toFixed(1)}x OI)`,
      `Premium: ${formatCurrency(premium)}`,
      `Stock: $${underlying_price.toFixed(2)}`,
    ];

    // Add moneyness if available
    if (moneyness !== null) {
      lines.push(`Moneyness: ${formatPercentage(moneyness, 1)}`);
    }

    // Add signal strength
    lines.push(`Strength: ${signal_strength?.toUpperCase() || 'N/A'}`);

    return lines.join('\n');
  }

  /**
   * Send SMS alert for unusual signal
   * Returns Twilio message SID if successful
   */
  async sendSignalAlert(signal: UnusualSignal): Promise<{
    success: boolean;
    messageSid?: string;
    error?: string;
  }> {
    try {
      const messageBody = this.formatSignalMessage(signal);

      const message = await this.client.messages.create({
        body: messageBody,
        from: this.fromNumber,
        to: this.toNumber,
      });

      console.log(`✅ SMS sent: ${message.sid}`);

      return {
        success: true,
        messageSid: message.sid,
      };
    } catch (error) {
      console.error('❌ Error sending SMS:', error);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send batch alerts for multiple signals
   * Sends one SMS per signal (be mindful of rate limits and costs!)
   */
  async sendBatchAlerts(signals: UnusualSignal[]): Promise<{
    sent: number;
    failed: number;
    results: Array<{ signal: UnusualSignal; success: boolean; messageSid?: string }>;
  }> {
    const results = [];
    let sent = 0;
    let failed = 0;

    for (const signal of signals) {
      const result = await this.sendSignalAlert(signal);

      results.push({
        signal,
        success: result.success,
        messageSid: result.messageSid,
      });

      if (result.success) {
        sent++;
      } else {
        failed++;
      }

      // Small delay between messages to avoid rate limits
      if (signals.length > 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return { sent, failed, results };
  }

  /**
   * Send daily summary SMS
   * Summarizes detected signals, paper trade performance, etc.
   */
  async sendDailySummary(summary: {
    signalsDetected: number;
    topSignals: UnusualSignal[];
    tradesOpen: number;
    totalPnL: number;
  }): Promise<{ success: boolean; messageSid?: string }> {
    try {
      const { signalsDetected, topSignals, tradesOpen, totalPnL } = summary;

      const lines = [
        '📊 DAILY OPTIONS SUMMARY',
        '',
        `Signals Detected: ${signalsDetected}`,
        `Open Trades: ${tradesOpen}`,
        `Total P/L: ${formatCurrency(totalPnL)}`,
      ];

      if (topSignals.length > 0) {
        lines.push('', 'Top Signals:');
        topSignals.slice(0, 3).forEach((sig, idx) => {
          lines.push(
            `${idx + 1}. ${sig.ticker} $${sig.strike} ${sig.option_type.toUpperCase()} - ${formatCurrency(sig.premium)}`
          );
        });
      }

      const message = await this.client.messages.create({
        body: lines.join('\n'),
        from: this.fromNumber,
        to: this.toNumber,
      });

      return {
        success: true,
        messageSid: message.sid,
      };
    } catch (error) {
      console.error('Error sending daily summary SMS:', error);
      return {
        success: false,
      };
    }
  }

  /**
   * Test SMS connection by sending a test message
   */
  async testConnection(): Promise<boolean> {
    try {
      const message = await this.client.messages.create({
        body: '🤖 Test message from Unusual Options Bot\n\nYour Twilio integration is working correctly!',
        from: this.fromNumber,
        to: this.toNumber,
      });

      console.log(`✅ Test SMS sent successfully: ${message.sid}`);
      return true;
    } catch (error) {
      console.error('❌ Twilio connection test failed:', error);
      return false;
    }
  }

  /**
   * Get message status from Twilio
   */
  async getMessageStatus(messageSid: string): Promise<{
    status: string;
    errorCode?: string;
    errorMessage?: string;
  } | null> {
    try {
      const message = await this.client.messages(messageSid).fetch();

      return {
        status: message.status,
        errorCode: message.errorCode?.toString(),
        errorMessage: message.errorMessage || undefined,
      };
    } catch (error) {
      console.error('Error fetching message status:', error);
      return null;
    }
  }
}