/**
 * Test script to validate Tradier API connection and explore data
 * Run with: npm run dev or tsx src/test-tradier.ts
 */

import { TradierClient } from './clients/tradier';
import { SignalDetector } from './services/signalDetector';
import { loadConfig } from './utils/config';
import { formatCurrency, formatPercentage } from './utils/calculations';

async function main() {
  console.log('🚀 Testing Tradier API Connection...\n');

  // Load configuration
  const config = loadConfig();

  // Initialize Tradier client
  const tradier = new TradierClient(config.tradier.apiKey, config.tradier.apiUrl);

  // Initialize signal detector
  const detector = new SignalDetector(config.signal);

  try {
    // Test 1: Check API connection
    console.log('📡 Test 1: Checking API connection...');
    const isConnected = await tradier.testConnection();

    if (isConnected) {
      console.log('✅ API connection successful!\n');

      // Get market status
      const marketStatus = await tradier.getMarketStatus();
      console.log('Market Status:');
      console.log(`  Date: ${marketStatus.date}`);
      console.log(`  Status: ${marketStatus.status}`);
      console.log(`  Description: ${marketStatus.description}\n`);
    } else {
      console.log('❌ API connection failed. Please check your credentials.\n');
      return;
    }

    // Test 2: Get stock quote
    console.log('📊 Test 2: Fetching stock quote for NVDA...');
    const stockQuotes = await tradier.getQuotes('NVDA', false);
    const stockQuote = stockQuotes[0];

    if (stockQuote) {
      console.log('✅ Stock quote received:');
      console.log(`  Symbol: ${stockQuote.symbol}`);
      console.log(`  Price: ${formatCurrency(stockQuote.last)}`);
      console.log(`  Change: ${formatPercentage(stockQuote.change_percentage)}`);
      console.log(`  Volume: ${stockQuote.volume.toLocaleString()}\n`);
    }

    // Test 3: Get options chain
    console.log('📈 Test 3: Fetching options expirations for NVDA...');
    const expirations = await tradier.getExpirations('NVDA');

    if (expirations.date && expirations.date.length > 0) {
      console.log(`✅ Found ${expirations.date.length} expirations:`);
      console.log(`  Next 5: ${expirations.date.slice(0, 5).join(', ')}\n`);

      // Test 4: Get options chain for first expiration
      const firstExpiry = expirations.date[0];
      console.log(`📋 Test 4: Fetching options chain for ${firstExpiry}...`);

      const chain = await tradier.getOptionsChain('NVDA', firstExpiry, true);

      if (chain.options && chain.options.option) {
        const options = Array.isArray(chain.options.option)
          ? chain.options.option
          : [chain.options.option];

        console.log(`✅ Found ${options.length} options for ${firstExpiry}\n`);

        // Test 5: Analyze for unusual activity
        console.log('🔍 Test 5: Scanning for unusual activity...');
        console.log(`Detection criteria:`);
        console.log(`  Min Premium: ${formatCurrency(config.signal.minPremium)}`);
        console.log(`  Min Volume/OI Ratio: ${config.signal.minVolumeOiRatio}x`);
        console.log(`  Min Volume: ${config.signal.minAbsoluteVolume} contracts`);
        console.log(`  Max DTE: ${config.signal.maxDte} days\n`);

        const signals = detector.analyzeMultipleQuotes(options, stockQuote);

        if (signals.length > 0) {
          console.log(`🎯 Found ${signals.length} unusual signal(s):\n`);

          signals.forEach((signal, idx) => {
            console.log(`Signal ${idx + 1}:`);
            console.log(`  Symbol: ${signal.symbol}`);
            console.log(`  Type: ${signal.option_type.toUpperCase()}`);
            console.log(`  Strike: $${signal.strike}`);
            console.log(`  Expiry: ${signal.expiration_date} (${signal.dte} DTE)`);
            console.log(`  Volume: ${signal.volume.toLocaleString()} contracts`);
            console.log(`  Open Interest: ${signal.open_interest.toLocaleString()}`);
            console.log(`  Vol/OI Ratio: ${signal.volume_oi_ratio}x`);
            console.log(`  Premium: ${formatCurrency(signal.premium)}`);
            console.log(`  Last Price: $${signal.last_price}`);
            console.log(`  Moneyness: ${formatPercentage(signal.moneyness || 0)} (${signal.moneyness_category})`);
            console.log(`  Signal Strength: ${signal.signal_strength?.toUpperCase()}`);

            if (signal.delta) {
              console.log(`  Delta: ${signal.delta.toFixed(4)}`);
              console.log(`  IV: ${((signal.implied_volatility || 0) * 100).toFixed(2)}%`);
            }
            console.log('');
          });
        } else {
          console.log('ℹ️  No unusual activity detected with current criteria.');
          console.log('   Try lowering thresholds or testing with different ticker/expiration.\n');

          // Show sample of options for debugging
          console.log('📝 Sample of first 3 options from chain:');
          options.slice(0, 3).forEach((opt, idx) => {
            const premium = opt.last * opt.volume * (opt.contract_size || 100);
            const volOiRatio = opt.open_interest > 0 ? opt.volume / opt.open_interest : 0;

            console.log(`\n  Option ${idx + 1}: ${opt.symbol}`);
            console.log(`    Type: ${opt.option_type}, Strike: $${opt.strike}`);
            console.log(`    Volume: ${opt.volume}, OI: ${opt.open_interest}, Ratio: ${volOiRatio.toFixed(2)}x`);
            console.log(`    Last: $${opt.last}, Premium: ${formatCurrency(premium)}`);
          });
        }
      } else {
        console.log('⚠️  No options found in chain\n');
      }
    } else {
      console.log('⚠️  No expirations found for NVDA\n');
    }

    // Summary
    console.log('\n✨ All tests completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Set up Supabase project and run schema SQL');
    console.log('   2. Add Supabase credentials to .env file');
    console.log('   3. Test scanner with: npm run scan');

    if (config.tradier.apiUrl.includes('sandbox')) {
      console.log('\n⚠️  NOTE: You are using SANDBOX data (15-min delayed)');
      console.log('   Open a Tradier Brokerage account for realtime data');
    }

  } catch (error) {
    console.error('\n❌ Error during testing:', error);
    if (error instanceof Error) {
      console.error('   Message:', error.message);
    }
    process.exit(1);
  }
}

// Run the test
main();
