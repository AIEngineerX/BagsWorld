# BagsWorld 🌍

A self-evolving pixel art game world that lives and dies based on real [Bags.fm](https://bags.fm) on-chain activity on Solana. Think SimCity meets crypto - where every token is a building and every trader is a citizen!

![BagsWorld](https://img.shields.io/badge/Powered%20by-Bags.fm-green) ![Solana](https://img.shields.io/badge/Built%20on-Solana-purple)

## What is BagsWorld?

**BagsWorld is a living, gamified visualization of real-time Solana trading activity from Bags.fm.**

It transforms abstract DeFi data into something **visual, engaging, and fun** - making crypto more accessible to everyone.

### Core Concept

| Real World | BagsWorld |
|------------|-----------|
| Token launched | Building appears |
| Market cap grows | Building levels up (1-5) |
| Fee share recipient | Citizen walking around |
| High trading volume | Sunny weather |
| Low activity | Storms and rain |

### Why It Matters

- **Gamifies DeFi** - Makes crypto trading visual and engaging
- **Drives discovery** - Users explore the world and find new tokens
- **Builds community** - Shared world creates shared experience
- **Transparent** - All data comes from real on-chain activity

## Revenue Model

**BagsWorld takes a 3% ecosystem fee on all tokens launched through the platform.**

When someone launches a token through BagsWorld:
1. They set their creator fee (typically 1% of all trading volume)
2. BagsWorld automatically adds a 3% fee share to the ecosystem wallet
3. This fee is **permanent and locked** - earning from every trade, forever

### Fee Allocation

| Category | % | Purpose |
|----------|---|---------|
| Community Rewards | 50% | Rewards for top-performing communities |
| Weekly Airdrops | 25% | Distributed to active holders |
| Creator Bonuses | 15% | Incentives for top tokens |
| Development | 10% | Platform improvements |

### Why It Works

- **Aligned incentives** - BagsWorld only earns if launched tokens succeed
- **Recurring revenue** - Fees are permanent, creating sustainable income
- **Network effects** - More tokens = bigger world = more users = more launches
- **Fully transparent** - All fees verifiable on [Solscan](https://solscan.io)

## Features

- **Living World**: Weather and health change based on real trading volume
- **Token Buildings**: Each token becomes a building that evolves with market cap
- **Diverse Citizens**: Fee earners become pixel art characters with moods based on earnings
- **AI Guides**: Toly (Solana), Ash (ecosystem), and Finn (Bags.fm) help onboard users
- **Real-time Events**: Watch token launches, fee claims, and milestones
- **Direct Trading**: Click buildings to trade tokens without leaving the game
- **PokeCenter**: Starter building with Pokemon-inspired design

## Building Levels

| Level | Market Cap | Building Style |
|-------|------------|----------------|
| 1 | < $100K | Small startup shop |
| 2 | $100K - $500K | Growing office |
| 3 | $500K - $2M | Corporate HQ |
| 4 | $2M - $10M | Modern tower |
| 5 | $10M+ | BagsWorld skyscraper |

## Tech Stack

- **Next.js 14** - React framework with App Router
- **Phaser 3** - 2D game engine for pixel art world
- **Solana Web3.js** - Blockchain interaction
- **Bags.fm SDK** - Trading and token data
- **Claude AI** - Intelligent NPC conversations
- **Supabase** - Shared global state
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/AIEngineerX/BagsWorld.git
cd BagsWorld

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Edit .env.local with your API keys
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BAGS_API_KEY` | Yes | Your Bags.fm API key |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Yes | Solana RPC endpoint |
| `NEXT_PUBLIC_ECOSYSTEM_WALLET` | Yes | Treasury wallet for ecosystem fees |
| `ANTHROPIC_API_KEY` | No | Claude API for AI characters |
| `NEXT_PUBLIC_SUPABASE_URL` | No | Supabase for shared state |
| `NEXT_PUBLIC_SUPABASE_KEY` | No | Supabase anon key |

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to explore the world!

## World Mechanics

### Weather System
- ☀️ **Sunny** (80%+ health): High trading volume
- ⛅ **Cloudy** (60-80%): Normal activity
- 🌧️ **Rain** (40-60%): Below average
- ⛈️ **Storm** (20-40%): Low activity
- 💀 **Apocalypse** (<20%): Critical

### Character Moods
- 🥳 **Celebrating**: Major gains
- 😎 **Happy**: Good performance
- 😐 **Neutral**: Normal activity
- 😔 **Sad**: Losses

### AI Characters
- **Toly** - Solana co-founder, explains blockchain tech
- **Ash** - Pokemon-themed guide, explains ecosystem mechanics
- **Finn** - Bags.fm CEO, explains the platform

## Deployment

### Netlify (Recommended)

1. Connect GitHub repo to Netlify
2. Build command: `npm run build`
3. Publish directory: `.next`
4. Add environment variables in dashboard

## Global State Setup (Supabase)

For tokens launched by one user to be visible to ALL users, you need to set up Supabase:

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free project
2. Note your Project URL and anon key from Settings > API

### 2. Run the Schema Migration

1. Go to the SQL Editor in your Supabase dashboard
2. Copy the contents of `supabase/schema.sql`
3. Run the SQL to create the `tokens` table

### 3. Configure Environment Variables

Add these to your `.env.local` (and Netlify dashboard):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_KEY=your-anon-key
```

### 4. Verify Connection

Look at the footer in BagsWorld - you should see:
- `● GLOBAL: ON` - Database connected, tokens shared globally
- `○ GLOBAL: LOCAL` - Not configured, tokens only saved locally
- `✕ GLOBAL: ERR` - Database error

Without Supabase, buildings are **session-only** - each user sees only their own launched tokens.

## License

MIT

## Credits

Built with ❤️ for the Bags.fm ecosystem on Solana

Co-created with [Claude Code](https://claude.ai/code)
