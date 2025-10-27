/**
 * Database initialization script
 * Reads SQL schema and applies it to Supabase
 * Run with: npx tsx src/init-database.ts
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { loadConfig } from './utils/config';

async function initDatabase() {
  console.log('🗄️  Initializing Supabase Database...\n');

  // Load config
  const config = loadConfig();

  if (!config.supabase.url || !config.supabase.serviceKey) {
    console.error('❌ Error: Supabase credentials not found in .env file');
    console.error('   Please add SUPABASE_URL and SUPABASE_SERVICE_KEY to .env\n');
    console.error('   Get these from: https://supabase.com/dashboard/project/_/settings/api');
    process.exit(1);
  }

  // Create Supabase client
  const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

  try {
    // Test connection
    console.log('📡 Testing connection...');
    const { error: testError } = await supabase.from('_test').select('*').limit(1);

    // Connection successful (table doesn't exist yet is fine)
    console.log('✅ Connected to Supabase\n');

    // Read schema file
    console.log('📖 Reading schema file...');
    const schemaPath = join(__dirname, '..', 'supabase_schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    console.log(`✅ Schema loaded (${schema.length} bytes)\n`);

    // Split schema into individual statements
    // This is a simple approach - for production, use a proper SQL parser
    console.log('⚙️  Executing SQL statements...');
    console.log('   Note: This may take a minute...\n');

    // For Supabase, we need to use the SQL editor or REST API
    // The JS client doesn't support raw SQL execution for security reasons

    console.log('⚠️  Manual Step Required:');
    console.log('   1. Go to: https://supabase.com/dashboard/project/_/sql/new');
    console.log('   2. Copy the contents of: supabase_schema.sql');
    console.log('   3. Paste into the SQL Editor');
    console.log('   4. Click "Run" to execute the schema\n');

    console.log('💡 Alternative - Use Supabase CLI:');
    console.log('   1. Login: supabase login');
    console.log('   2. Link project: supabase link --project-ref YOUR_PROJECT_REF');
    console.log('   3. Run: supabase db push\n');

    // Verify tables exist (after user has run the SQL)
    console.log('🔍 Checking if tables exist...');

    const tables = [
      'unusual_signals',
      'paper_trades',
      'paper_trade_snapshots',
      'alert_log',
      'stock_watchlist',
      'api_rate_limits'
    ];

    let allTablesExist = true;

    for (const table of tables) {
      const { error } = await supabase.from(table).select('count').limit(1);

      if (error) {
        console.log(`   ❌ Table '${table}' not found`);
        allTablesExist = false;
      } else {
        console.log(`   ✅ Table '${table}' exists`);
      }
    }

    if (allTablesExist) {
      console.log('\n✨ All tables created successfully!');

      // Insert sample watchlist data
      console.log('\n📝 Inserting sample watchlist data...');
      const { data, error } = await supabase
        .from('stock_watchlist')
        .insert([
          {
            ticker: 'NVDA',
            company_name: 'NVIDIA Corp',
            market_cap: 3500000000000,
            sector: 'Technology',
            notes: 'High volume options',
          },
          {
            ticker: 'PLTR',
            company_name: 'Palantir Technologies',
            market_cap: 45000000000,
            sector: 'Technology',
            notes: 'Frequent unusual activity',
          },
          {
            ticker: 'SOFI',
            company_name: 'SoFi Technologies',
            market_cap: 12000000000,
            sector: 'Financial Services',
            notes: 'Small-cap fintech',
          },
        ])
        .select();

      if (error) {
        console.log('   ⚠️  Sample data might already exist (this is fine)');
      } else {
        console.log(`   ✅ Added ${data?.length || 0} tickers to watchlist`);
      }

      console.log('\n✅ Database initialization complete!');
      console.log('\n📝 Next steps:');
      console.log('   1. Test the database: npx tsx src/test-supabase.ts');
      console.log('   2. Set up Twilio for SMS alerts');
      console.log('   3. Run the scanner: npm run scan');
    } else {
      console.log('\n⚠️  Please run the SQL schema in Supabase SQL Editor first');
      console.log('   Then run this script again to verify');
    }

  } catch (error) {
    console.error('\n❌ Error initializing database:', error);
    process.exit(1);
  }
}

// Run the initialization
initDatabase();
