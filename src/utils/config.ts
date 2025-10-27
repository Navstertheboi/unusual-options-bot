import dotenv from 'dotenv';
import type { SignalConfig } from '../types';

// Load environment variables
dotenv.config();

export interface AppConfig {
  tradier: {
    apiKey: string;
    apiUrl: string;
  };
  supabase: {
    url: string;
    anonKey: string;
    serviceKey: string;
  };
  twilio: {
    accountSid: string;
    authToken: string;
    phoneNumber: string;
    recipientPhone: string;
  };
  signal: SignalConfig;
  scanner: {
    intervalMs: number;
  };
  env: string;
}

/**
 * Load and validate application configuration from environment variables
 */
export function loadConfig(): AppConfig {
  // Required environment variables
  const required = [
    'TRADIER_API_KEY',
    'TRADIER_API_URL',
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      'Please copy .env.example to .env and fill in your credentials.'
    );
  }

  return {
    tradier: {
      apiKey: process.env.TRADIER_API_KEY!,
      apiUrl: process.env.TRADIER_API_URL!,
    },
    supabase: {
      url: process.env.SUPABASE_URL || '',
      anonKey: process.env.SUPABASE_ANON_KEY || '',
      serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
    },
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
      recipientPhone: process.env.ALERT_RECIPIENT_PHONE || '',
    },
    signal: {
      minPremium: parseFloat(process.env.MIN_PREMIUM || '25000'),
      minVolumeOiRatio: parseFloat(process.env.MIN_VOLUME_OI_RATIO || '3.0'),
      minAbsoluteVolume: parseInt(process.env.MIN_ABSOLUTE_VOLUME || '100', 10),
      maxDte: parseInt(process.env.MAX_DTE || '45', 10),
      minOtmPercent: parseFloat(process.env.MIN_OTM_PERCENT || '10'),
    },
    scanner: {
      intervalMs: parseInt(process.env.SCAN_INTERVAL_MS || '60000', 10),
    },
    env: process.env.NODE_ENV || 'development',
  };
}

/**
 * Validate that required services are configured
 */
export function validateConfig(config: AppConfig): {
  tradier: boolean;
  supabase: boolean;
  twilio: boolean;
} {
  return {
    tradier: Boolean(config.tradier.apiKey && config.tradier.apiUrl),
    supabase: Boolean(config.supabase.url && config.supabase.serviceKey),
    twilio: Boolean(
      config.twilio.accountSid &&
      config.twilio.authToken &&
      config.twilio.phoneNumber &&
      config.twilio.recipientPhone
    ),
  };
}
