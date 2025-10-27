/**
 * View dashboard data in terminal
 * Shows signals, trades, and performance
 */

import { SupabaseService } from './clients/supabase';
import { loadConfig } from './utils/config';
import { formatCurrency, formatPercentage } from './utils/calculations';

async function main() {
  console.log('📊 Unusual Options Dashboard\n');
  console.log('='.repeat(80));
  console.log('\n');

  // Load config
  const config = loadConfig();

  // Initialize Supabase
  const supabase = new SupabaseService(
    config.supabase.url,
    config.supabase.serviceKey
  );

  try {
    // 1. Recent Signals
    console.log('🎯 RECENT SIGNALS (Last 10)\n');
    const signals = await supabase.getRecentSignals(10);

    if (signals.length === 0) {
      console.log('No signals found. Run the scanner first!\n');
    } else {
      signals.forEach((sig, idx) => {
        console.log(`${idx + 1}. ${sig.ticker} $${sig.strike} ${sig.option_type.toUpperCase()}`);
        console.log(`   Exp: ${sig.expiration_date} (${sig.dte} DTE)`);
        console.log(`   Vol/OI: ${sig.volume_oi_ratio}x, Premium: ${formatCurrency(sig.premium)}`);
        console.log(`   Strength: ${sig.signal_strength?.toUpperCase()}, Detected: ${new Date(sig.detected_at!).toLocaleString()}`);
        console.log('');
      });
    }

    console.log('='.repeat(80));
    console.log('\n');

    // 2. Performance Summary
    console.log('📈 PAPER TRADING PERFORMANCE\n');
    const perf = await supabase.getPerformanceSummary();

    if (perf && perf.total_trades > 0) {
      console.log(`Total Trades: ${perf.total_trades}`);
      console.log(`  Open: ${perf.total_trades - (perf.winning_trades + perf.losing_trades)}`);
      console.log(`  Closed: ${perf.winning_trades + perf.losing_trades}`);
      console.log('');
      console.log(`Win Rate: ${perf.win_rate_pct}% (${perf.winning_trades}W / ${perf.losing_trades}L / ${perf.breakeven_trades}BE)`);
      console.log('');
      console.log(`Total P/L: ${formatCurrency(perf.total_pnl)}`);
      console.log(`Avg P/L: ${formatCurrency(perf.avg_pnl)}`);
      console.log(`Best Trade: ${formatCurrency(perf.max_pnl)}`);
      console.log(`Worst Trade: ${formatCurrency(perf.min_pnl)}`);
    } else {
      console.log('No trades yet. Paper trades will be created on next scan.\n');
    }

    console.log('\n');
    console.log('='.repeat(80));
    console.log('\n');

    // 3. Signal Distribution
    console.log('📊 SIGNAL BREAKDOWN\n');

    // Group by ticker
    const tickers = [...new Set(signals.map(s => s.ticker))];
    const callSignals = signals.filter(s => s.option_type === 'call').length;
    const putSignals = signals.filter(s => s.option_type === 'put').length;
    const highStrength = signals.filter(s => s.signal_strength === 'high').length;
    const mediumStrength = signals.filter(s => s.signal_strength === 'medium').length;
    const lowStrength = signals.filter(s => s.signal_strength === 'low').length;

    console.log(`Tickers Monitored: ${tickers.join(', ')}`);
    console.log(`Total Signals: ${signals.length}`);
    console.log('');
    console.log(`Calls: ${callSignals} | Puts: ${putSignals}`);
    console.log('');
    console.log(`Strength Distribution:`);
    console.log(`  🔥 High: ${highStrength}`);
    console.log(`  ⚡ Medium: ${mediumStrength}`);
    console.log(`  💡 Low: ${lowStrength}`);

    console.log('\n');
    console.log('='.repeat(80));
    console.log('\n');

    // 4. Watchlist
    console.log('📋 WATCHLIST\n');
    const watchlist = await supabase.getWatchlist();

    watchlist.forEach(ticker => {
      const lastScanned = ticker.last_scanned_at
        ? new Date(ticker.last_scanned_at).toLocaleString()
        : 'Never';

      console.log(`${ticker.ticker} - ${ticker.company_name || 'N/A'}`);
      console.log(`  Sector: ${ticker.sector || 'N/A'}`);
      console.log(`  Last Scanned: ${lastScanned}`);
      console.log(`  Enabled: ${ticker.enabled ? '✅' : '❌'}`);
      console.log('');
    });

    console.log('='.repeat(80));
    console.log('\n');

    // Quick stats
    console.log('💡 QUICK ACTIONS\n');
    console.log('  Run scanner: npm run scan');
    console.log('  Continuous mode: npm run dev');
    console.log('  View in Supabase: https://supabase.com/dashboard/project/mpjswlvzbnrofbyqazyp/editor');
    console.log('\n');

  } catch (error) {
    console.error('❌ Error fetching dashboard data:', error);
    process.exit(1);
  }
}

main();
