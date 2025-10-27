# 🎨 Lovable Dashboard Prompt

Copy and paste this entire prompt into Lovable to create your options trading dashboard:

---

# Unusual Options Activity Dashboard

Create a modern options trading dashboard inspired by Robinhood's clean, minimalist UI design. This dashboard displays real-time unusual options activity data from a Supabase database.

## 🎨 DESIGN SYSTEM

### Color Palette (Navster Automations Brand)
- **Primary Background**: Deep Navy Blue `#0A1628` (dark, professional)
- **Secondary Background**: Slightly lighter navy `#0F1F3A` for cards/sections
- **Accent/Hover**: Light blue `#3B82F6` for interactive elements
- **Text Primary**: White `#FFFFFF`
- **Text Secondary**: Light gray `#94A3B8`
- **Success/Profit**: Bright Green `#10B981`
- **Loss/Negative**: Red `#EF4444`
- **Warning**: Amber `#F59E0B`
- **Borders**: Subtle navy `#1E293B`

### Typography
- **Headings**: Inter, SF Pro Display, or system-ui (bold, clean)
- **Body**: Inter or system-ui (regular)
- **Monospace** (for prices/numbers): JetBrains Mono or SF Mono

### Design Principles (Robinhood-inspired)
- **Minimalist**: Clean, uncluttered interface with lots of breathing room
- **Card-based**: Use rounded cards with subtle shadows
- **Mobile-first**: Fully responsive, works beautifully on phones
- **Smooth animations**: Gentle transitions, no jarring movements
- **Data-dense but readable**: Show lots of info without overwhelming
- **Progressive disclosure**: Start simple, reveal details on click

---

## 📊 DATABASE SCHEMA (Already in Supabase)

### Table: `unusual_signals`
Stores detected unusual options activity (30 signals already exist!)

**Key Fields:**
- `id` (uuid) - Primary key
- `ticker` (text) - Stock symbol (e.g., "NVDA", "PLTR")
- `symbol` (text) - Full option symbol (e.g., "NVDA251031C00197500")
- `description` (text) - Human readable (e.g., "NVDA Oct 31 2025 $197.50 Call")
- `option_type` (text) - "call" or "put"
- `strike` (numeric) - Strike price
- `expiration_date` (date) - Option expiration
- `dte` (integer) - Days to expiration
- `volume` (integer) - Option volume traded
- `open_interest` (integer) - Open interest
- `volume_oi_ratio` (numeric) - **KEY METRIC** - Volume/OI ratio (unusual if >3x)
- `premium` (numeric) - Trade premium in dollars
- `last_price` (numeric) - Last traded price
- `bid` (numeric), `ask` (numeric)
- `underlying_price` (numeric) - Stock price at detection
- `underlying_change_pct` (numeric) - Stock % change
- `signal_strength` (text) - "high", "medium", "low"
- `moneyness` (numeric) - % OTM/ITM
- `moneyness_category` (text) - "deep_otm", "otm", "atm", "itm", "deep_itm"
- `detected_at` (timestamp) - When signal was found
- **Greeks**: `delta`, `gamma`, `theta`, `vega`, `rho`, `implied_volatility`

### Table: `paper_trades`
Simulated trades tracking P/L

**Key Fields:**
- `id` (uuid) - Primary key
- `signal_id` (uuid) - Links to unusual_signals
- `direction` (text) - "long" or "short"
- `quantity` (integer) - Number of contracts
- `entry_price` (numeric) - Entry price
- `exit_price` (numeric) - Exit price (null if open)
- `pnl` (numeric) - Profit/loss in dollars
- `pnl_pct` (numeric) - Profit/loss percentage
- `status` (text) - "open", "closed", "expired"
- `entry_time` (timestamp)
- `exit_time` (timestamp)

### View: `performance_summary`
Aggregated performance statistics

**Fields:**
- `total_trades` (integer)
- `winning_trades` (integer)
- `losing_trades` (integer)
- `win_rate_pct` (numeric)
- `total_pnl` (numeric)
- `avg_pnl` (numeric)
- `max_pnl` (numeric) - Best trade
- `min_pnl` (numeric) - Worst trade

### Table: `stock_watchlist`
Tickers being monitored

**Fields:**
- `ticker` (text)
- `company_name` (text)
- `sector` (text)
- `enabled` (boolean)
- `last_scanned_at` (timestamp)

---

## 🏠 PAGE 1: HOME / SIGNAL FEED (Build This First)

### Layout (Robinhood-style)

**Top Section** - Hero Stats (Full width, gradient background)
```
┌─────────────────────────────────────────────────────┐
│  🎯 Unusual Options Activity                        │
│  Real-time signals from NVDA, PLTR, RBLX, SOFI     │
│                                                     │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐  │
│  │   30   │  │ $15.2M │  │  8.5x  │  │  75%   │  │
│  │Signals │  │Premium │  │Avg Vol │  │Win Rate│  │
│  │ Today  │  │ Total  │  │OI Ratio│  │        │  │
│  └────────┘  └────────┘  └────────┘  └────────┘  │
└─────────────────────────────────────────────────────┘
```

**Filter Bar** (Sticky below hero)
```
┌─────────────────────────────────────────────────────┐
│ [🔍 Search]  [Ticker ▼]  [Call/Put ▼]  [Strength ▼]│
│ [Date Range]  [Sort: Latest ▼]         [Export CSV]│
└─────────────────────────────────────────────────────┘
```

**Signal Feed** (Card-based, infinite scroll)
Each signal as a card:
```
┌──────────────────────────────────────────────────┐
│ NVDA $210 PUT                          🔥 HIGH   │
│ Oct 31, 2025 • 4 days left                      │
│                                                  │
│ $827,750 premium    18.4x Vol/OI    -12.8% OTM │
│ Stock: $186.26 (+2.26%)                         │
│                                                  │
│ [📊 Details]              [💰 P/L: +$245 (+15%)]│
└──────────────────────────────────────────────────┘
```

**Color coding:**
- 🔥 HIGH strength = Red/orange badge
- ⚡ MEDIUM = Yellow badge
- 💡 LOW = Gray badge
- CALL = Green text
- PUT = Red text
- Profit = Green background on P/L
- Loss = Red background on P/L

### Key Features:
1. **Real-time updates**: Use Supabase subscriptions to show new signals instantly
2. **Smooth animations**: Cards fade in when new signal detected
3. **Click card**: Navigate to signal detail page
4. **Empty state**: "Scanning for signals..." with animated loader
5. **Mobile**: Stack cards vertically, swipe to see details

### Queries Needed:
```typescript
// Get recent signals
const { data: signals } = await supabase
  .from('unusual_signals')
  .select('*')
  .order('detected_at', { ascending: false })
  .limit(50);

// Get today's stats
const today = new Date().toISOString().split('T')[0];
const { data: todaySignals } = await supabase
  .from('unusual_signals')
  .select('*')
  .gte('detected_at', today);

// Real-time subscription
const subscription = supabase
  .channel('new_signals')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'unusual_signals' },
    (payload) => {
      // Add new signal to top of feed with animation
      console.log('New signal!', payload.new);
    }
  )
  .subscribe();
```

---

## 📄 PAGE 2: SIGNAL DETAIL

When user clicks a signal card, show full details.

### Layout (Robinhood detail page style)
```
┌────────────────────────────────────────────┐
│ ← Back                                     │
│                                            │
│ NVDA $210 PUT          🔥 HIGH STRENGTH   │
│ October 31, 2025 • Expires in 4 days      │
│                                            │
│ ┌─────────────────────────────────────┐  │
│ │  $186.26                            │  │
│ │  Stock Price (+2.26% today)         │  │
│ │  [Mini price chart if available]    │  │
│ └─────────────────────────────────────┘  │
│                                            │
│ OPTION DETAILS                             │
│ ├─ Premium: $827,750                      │
│ ├─ Volume: 350 contracts                  │
│ ├─ Open Interest: 19                      │
│ ├─ Vol/OI Ratio: 18.4x (EXTREMELY HIGH)  │
│ ├─ Last Price: $23.65                     │
│ ├─ Bid/Ask: $23.50 / $23.80              │
│ ├─ Moneyness: -12.8% (Deep ITM)          │
│                                            │
│ GREEKS                                     │
│ ├─ Delta: -0.9830 [Bar chart]            │
│ ├─ Gamma: 0.0023  [Bar chart]            │
│ ├─ Theta: -0.45   [Bar chart]            │
│ ├─ Vega: 0.12     [Bar chart]            │
│ ├─ IV: 46.5%      [Bar chart]            │
│                                            │
│ PAPER TRADE                                │
│ └─ Status: Open                           │
│    Entry: $23.65 @ 5:15 PM                │
│    Current P/L: +$245 (+15.2%)           │
│    [Close Trade] button                   │
│                                            │
│ METADATA                                   │
│ └─ Detected: Oct 26, 2025 5:15 PM        │
│    Exchange: CBOE                         │
│    Signal ID: abc-123-xyz                 │
└────────────────────────────────────────────┘
```

### Features:
- Greeks visualized as horizontal bars (Robinhood style)
- Copy button for option symbol
- "Add alert" button for price changes
- Share button (copy link)
- Export to CSV

---

## 📊 PAGE 3: PERFORMANCE DASHBOARD

Show paper trading results.

### Layout
```
┌─────────────────────────────────────────────┐
│ PORTFOLIO PERFORMANCE                       │
│                                             │
│ ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│ │ $2,450   │  │   75%    │  │   18     │ │
│ │Total P/L │  │Win Rate  │  │  Trades  │ │
│ └──────────┘  └──────────┘  └──────────┘ │
│                                             │
│ P/L OVER TIME (Line chart)                 │
│ ┌─────────────────────────────────────┐   │
│ │         /\    /\                    │   │
│ │        /  \  /  \  /\               │   │
│ │  ─────/────\/────\/──\───────       │   │
│ │                        \  /         │   │
│ │                         \/          │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ OPEN POSITIONS (5)                         │
│ [List of open trades with current P/L]    │
│                                             │
│ RECENT TRADES                              │
│ [Table showing closed trades]              │
└─────────────────────────────────────────────┘
```

### Queries:
```typescript
// Get performance summary
const { data: perf } = await supabase
  .from('performance_summary')
  .select('*')
  .single();

// Get open trades
const { data: openTrades } = await supabase
  .from('paper_trades')
  .select('*, unusual_signals(*)')
  .eq('status', 'open')
  .order('entry_time', { ascending: false });

// Get closed trades
const { data: closedTrades } = await supabase
  .from('paper_trades')
  .select('*, unusual_signals(*)')
  .eq('status', 'closed')
  .order('exit_time', { ascending: false })
  .limit(20);
```

---

## 📋 PAGE 4: WATCHLIST

Manage tickers being monitored.

### Layout (Simple table)
```
┌─────────────────────────────────────────────┐
│ WATCHLIST                    [+ Add Ticker] │
│                                             │
│ ┌───────────────────────────────────────┐  │
│ │ NVDA  │ Technology    │ ✅ │ 2m ago  │  │
│ │ PLTR  │ Technology    │ ✅ │ 1m ago  │  │
│ │ RBLX  │ Gaming        │ ✅ │ 3m ago  │  │
│ │ SOFI  │ Fintech       │ ✅ │ 2m ago  │  │
│ └───────────────────────────────────────┘  │
│                                             │
│ Each row shows:                            │
│ - Ticker symbol                            │
│ - Sector                                   │
│ - Enabled toggle                           │
│ - Last scanned time                        │
│ - [Delete] button                          │
└─────────────────────────────────────────────┘
```

### Features:
- Add new ticker modal
- Toggle enable/disable scanning
- Delete ticker (with confirmation)
- Show stats per ticker (signals found today)

---

## 🎯 NAVIGATION

**Top Navigation Bar** (Robinhood-style, minimal)
```
┌─────────────────────────────────────────────────────┐
│ [Logo] Unusual Options    [Home][Performance][...]  │
└─────────────────────────────────────────────────────┘
```

**Mobile**: Hamburger menu or bottom tab bar

**Pages:**
1. 🏠 Home (Signal Feed)
2. 📊 Performance
3. 📋 Watchlist
4. ⚙️ Settings (future)

---

## 🎨 UI COMPONENTS TO USE

### Shadcn/UI Components
- **Card**: For signal cards, stat cards
- **Badge**: For signal strength, call/put labels
- **Table**: For performance history
- **Dialog**: For modals (add ticker, signal details)
- **Tabs**: For switching between calls/puts
- **Select**: For filters
- **Input**: For search
- **Button**: Primary actions
- **Skeleton**: Loading states

### Charts (Recharts)
- **Line Chart**: P/L over time
- **Bar Chart**: Greeks visualization
- **Pie Chart**: Call/Put distribution
- **Area Chart**: Premium volume over time

---

## 🚀 TECHNICAL REQUIREMENTS

### Supabase Setup
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://mpjswlvzbnrofbyqazyp.supabase.co',
  'YOUR_ANON_KEY' // User will provide
)
```

### Real-time Subscriptions
```typescript
// Listen for new signals
useEffect(() => {
  const channel = supabase
    .channel('signals')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'unusual_signals' },
      (payload) => {
        // Show toast notification
        toast.success('New signal detected!');
        // Add to feed
        setSignals([payload.new, ...signals]);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, []);
```

### Responsive Breakpoints
- Mobile: < 768px (single column)
- Tablet: 768px - 1024px (2 columns)
- Desktop: > 1024px (3+ columns)

### Performance
- Lazy load images
- Virtual scrolling for long lists
- Debounce search/filters
- Cache Supabase queries

---

## 📱 MOBILE EXPERIENCE

### Priority Features (Mobile-first)
1. **Swipe gestures**: Swipe card to reveal actions
2. **Pull to refresh**: Reload signal feed
3. **Bottom sheet**: Signal details slide up from bottom
4. **Haptic feedback**: On interactions
5. **Dark mode optimized**: Deep navy looks great on OLED

### Mobile Layout
- Stack cards vertically
- Full-width cards with padding
- Fixed bottom navigation
- Collapsible filters

---

## ⚡ FUTURE-PROOF ARCHITECTURE

### Easy to upgrade later:
1. **API agnostic**: All data through Supabase, backend can change
2. **Component library**: Shadcn/UI easily customizable
3. **State management**: Use React Query for caching
4. **Extensible**: Easy to add new pages/features
5. **Modular**: Each page is independent

### Settings page (for later):
- API credentials management
- Alert preferences
- Theme customization
- Export/import data
- Connect Twilio for SMS

---

## 🎯 INITIAL PROMPT FOR LOVABLE

**Start with this first message to Lovable:**

"Create a modern options trading dashboard with a deep navy blue theme (#0A1628) inspired by Robinhood's minimalist design.

Connect to my existing Supabase database that has 30 unusual options signals already stored in the 'unusual_signals' table.

Build the home page first with:
1. Hero section showing 4 stat cards (total signals, total premium, avg vol/OI ratio, win rate)
2. Filter bar for ticker, call/put, signal strength
3. Signal feed showing cards for each unusual option
4. Each card displays: ticker, strike, type, expiration, premium, vol/OI ratio, signal strength badge
5. Real-time updates using Supabase subscriptions

Use Shadcn/UI components, Recharts for charts, and make it fully mobile responsive.

Colors:
- Background: #0A1628
- Cards: #0F1F3A
- Accent: #3B82F6
- Success: #10B981
- Loss: #EF4444
- Text: #FFFFFF"

---

**Then iterate by adding:**
- Signal detail page
- Performance dashboard
- Watchlist management
- Filters and sorting
- Charts and visualizations

Let Lovable generate the structure, then refine the design!
