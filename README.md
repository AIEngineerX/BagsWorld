# BagsWorld 🌍

A self-evolving pixel art game world that lives and dies based on real [Bags.fm](https://bags.fm) on-chain activity. Think Tamagotchi meets SimCity meets crypto!

![BagsWorld](https://img.shields.io/badge/Powered%20by-Bags.fm-green)

## Features

- **Living World**: The world health and weather change based on 24h Bags trading volume
- **Token Buildings**: Each token becomes a building that grows/shrinks based on market cap
- **Diverse Characters**: Fee earners become pixel art characters with different moods
- **Real-time Events**: Watch token launches, fee claims, and price movements
- **AI Chat**: Interactive AI personalities that comment on world events
- **Click to Explore**: Click characters to view their social profiles, click buildings to view tokens on Bags.fm

## Building Levels

| Level | Market Cap | Style |
|-------|------------|-------|
| 1 | < $100K | Small gray startup shop |
| 2 | $100K - $500K | Blue growing office |
| 3 | $500K - $2M | Purple corporate building |
| 4 | $2M - $10M | Blue tower |
| 5 | $10M+ | Green Bags skyscraper |

## Tech Stack

- **Next.js 14** - React framework with App Router
- **Phaser 3** - 2D game engine
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management
- **TanStack Query** - Data fetching

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
| `BAGS_API_URL` | Yes | Bags.fm API URL (default: https://public-api-v2.bags.fm/api/v1) |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Yes | Solana RPC endpoint |
| `NEXT_PUBLIC_SOLANA_NETWORK` | Yes | Solana network (mainnet-beta) |
| `ANTHROPIC_API_KEY` | No | Claude API key for AI chat (optional) |

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the world!

### Production Build

```bash
npm run build
npm start
```

## Deploying to Netlify

1. Connect your GitHub repo to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `.next`
4. Add environment variables in Netlify dashboard:
   - `BAGS_API_KEY`
   - `BAGS_API_URL`
   - `NEXT_PUBLIC_SOLANA_RPC_URL`
   - `NEXT_PUBLIC_SOLANA_NETWORK`
   - `ANTHROPIC_API_KEY` (optional)

## World Mechanics

### Weather System
- ☀️ **Sunny** (Health 80%+): High trading volume
- ⛅ **Cloudy** (Health 60-80%): Normal activity
- 🌧️ **Rain** (Health 40-60%): Below average volume
- ⛈️ **Storm** (Health 20-40%): Low activity
- 💀 **Apocalypse** (Health <20%): Very low activity

### Character Moods
- 🥳 **Celebrating**: Major gains (100%+ change)
- 😎 **Happy**: Good performance (20%+ change or $1K+ earnings)
- 🧑‍💻 **Neutral**: Normal activity
- 😔 **Sad**: Losses (-20% or worse)

## License

MIT

## Credits

Built with ❤️ using [Bags.fm](https://bags.fm) API
