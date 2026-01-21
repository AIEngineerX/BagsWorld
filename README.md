# BagsWorld

A self-evolving pixel art game world that visualizes real [Bags.fm](https://bags.fm) on-chain activity on Solana. Launch tokens, watch buildings grow, and earn creator fees!

![BagsWorld](https://img.shields.io/badge/Powered%20by-Bags.fm-green) ![Solana](https://img.shields.io/badge/Built%20on-Solana-purple)

## What is BagsWorld?

**BagsWorld is a living, gamified visualization of your token launches on Bags.fm.**

It transforms abstract DeFi data into something **visual, engaging, and fun** - making crypto more accessible to everyone.

### Core Concept

| Real World | BagsWorld |
|------------|-----------|
| Token launched | Building appears |
| Market cap grows | Building levels up (1-5) |
| Fee share recipient | Citizen walking around |
| High fee claiming activity | World health increases |
| Creator fees earned | Characters celebrate |

### Why It Matters

- **Gamifies DeFi** - Makes crypto trading visual and engaging
- **Drives discovery** - Users explore the world and find new tokens
- **Builds community** - Shared world creates shared experience
- **Transparent** - All data comes from real on-chain activity

## Creator Rewards System

**BagsWorld takes a 1% ecosystem fee that funds creator rewards.**

When someone launches a token through BagsWorld:
1. They set their creator fee shares (fee recipients earn from all trading volume)
2. BagsWorld adds a 1% fee share to the ecosystem wallet
3. Top creators get rewarded from the pool

### How It Works

```
Ecosystem fees collected → Pool reaches 10 SOL OR 5 days pass → Top 3 creators paid
```

Distribution split:
- **1st place**: 50% of pool
- **2nd place**: 30% of pool
- **3rd place**: 20% of pool

Backup timer: If threshold isn't reached within 5 days, distribution happens anyway (minimum 10 SOL required).

## Features

- **Living World**: Health changes based on real Bags.fm fee activity (claims, lifetime fees)
- **Token Buildings**: Each token becomes a building that evolves with market cap
- **Diverse Citizens**: Fee earners become pixel art characters with moods
- **AI Guides**: Toly, Ash, Finn, The Dev, and Neo help users navigate
- **Real-time Events**: Watch token launches, fee claims, and milestones
- **Direct Trading**: Click buildings to trade tokens
- **Two Zones**: Park (main area) and City (trending tokens)
- **Day/Night Cycle**: Synced to EST timezone

## World Health

World health is calculated from **real Bags.fm data**:
- **24h Claim Volume** (60% weight) - SOL claimed by creators
- **Lifetime Fees** (30% weight) - Total fees across all tokens
- **Active Tokens** (10% weight) - Number of tokens with activity
- **Baseline Health**: 25% + 3% per building (max 40%) when no activity

| Health | Status | Meaning |
|--------|--------|---------|
| 80%+ | THRIVING | High fee activity |
| 60%+ | HEALTHY | Good activity |
| 45%+ | GROWING | Some activity |
| 25%+ | QUIET | Baseline - working but no activity |
| 10%+ | DORMANT | Low activity |
| <10% | DYING | Critical |

## Building Levels

| Level | Market Cap | Building Style |
|-------|------------|----------------|
| 1 | < $100K | Small startup shop |
| 2 | $100K - $500K | Growing office |
| 3 | $500K - $2M | Corporate HQ |
| 4 | $2M - $10M | Modern tower |
| 5 | $10M+ | BagsWorld skyscraper |

## AI Characters

- **Toly** - Solana co-founder, explains blockchain tech
- **Ash** - Pokemon-themed guide, explains ecosystem mechanics
- **Finn** - Bags.fm CEO, explains the platform
- **The Dev** - Trading agent, helps with market analysis
- **Neo** - Scout agent, watches for new launches

## Tech Stack

- **Next.js 14** - React framework with App Router
- **Phaser 3** - 2D game engine for pixel art world
- **Solana Web3.js** - Blockchain interaction
- **Bags.fm SDK** - Trading and token data
- **Claude AI** - Intelligent NPC conversations
- **Neon Database** - Shared global state (auto-configured on Netlify)
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
| `SOLANA_RPC_URL` | Yes | Helius RPC URL for transactions |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | No | Client-side RPC (defaults to Ankr) |
| `ANTHROPIC_API_KEY` | No | Claude API for AI characters |

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to explore the world!

## Deployment

### Netlify (Recommended)

1. Connect GitHub repo to Netlify
2. Build command: `npm run build`
3. Publish directory: `.next`
4. Add environment variables in dashboard

Neon database auto-configures on Netlify for global token storage.

## License

MIT

## Credits

Built for the Bags.fm ecosystem on Solana

Co-created with [Claude Code](https://claude.ai/code)
