# BagsWorld

**A living pixel art world powered by real Solana on-chain activity**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Solana](https://img.shields.io/badge/Solana-9945FF?logo=solana&logoColor=white)](https://solana.com)
[![Next.js](https://img.shields.io/badge/Next.js_14-black?logo=next.js)](https://nextjs.org)
[![ElizaOS](https://img.shields.io/badge/ElizaOS-AI_Agents-FF6B6B)](https://github.com/elizaOS/eliza)
[![Phaser](https://img.shields.io/badge/Phaser_3-Game_Engine-8B5CF6)](https://phaser.io)

---

## What is BagsWorld?

BagsWorld transforms abstract DeFi data into a living, breathing pixel art game. Every token launched on [Bags.fm](https://bags.fm) becomes a building. Every fee claim makes the world healthier. Every whale move triggers weather changes.

```
┌─────────────────────────────────────────────────────────────────┐
│                     REAL ON-CHAIN DATA                          │
│  Token Launches • Fee Claims • Trading Volume • Market Caps     │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BAGSWORLD ENGINE                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ World State │  │   ElizaOS   │  │      Phaser 3           │  │
│  │ Calculator  │  │  16 Agents  │  │   Pixel Art Renderer    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LIVING GAME WORLD                          │
│  Buildings grow/decay • Weather shifts • NPCs react • Day/Night │
└─────────────────────────────────────────────────────────────────┘
```

## Core Mechanics

| On-Chain Event | In-Game Effect |
|----------------|----------------|
| Token launched on Bags.fm | Building appears in world |
| Market cap grows | Building levels up (1→5) |
| No trading activity | Building decays and crumbles |
| Fee claims spike | World health increases, sun comes out |
| Whale moves 10+ SOL | Storm clouds roll in |
| Price pumps 20%+ | Characters celebrate |

### World Health Formula

```
Health = (0.6 × 24h_claim_volume) + (0.3 × lifetime_fees) + (0.1 × active_tokens)
```

- **80%+** THRIVING - Sunny skies, citizens celebrating
- **60-80%** HEALTHY - Clear weather, normal activity
- **40-60%** GROWING - Cloudy, some concern
- **20-40%** QUIET - Rain, citizens worried
- **<20%** DYING - Storms, buildings crumbling

## Features

### 5 Unique Zones

| Zone | Theme | Highlights |
|------|-------|------------|
| **HQ** | Futuristic R&D | Bags.fm team HQ, meet Ramo, Sincara, Stuu |
| **Park** | Peaceful green | PokeCenter, Toly, Ash, Shaw |
| **BagsCity** | Neon urban | Casino, Trading Terminal, Neo, CJ |
| **Ballers Valley** | Luxury mansions | Top holder showcases |
| **Founder's Corner** | Learning hub | Professor Oak's token launch guidance |

### 16 AI Characters (ElizaOS)

Every character runs on [ElizaOS](https://github.com/elizaOS/eliza) with persistent memory and distinct personalities:

| Character | Role | Zone |
|-----------|------|------|
| **Finn** | Bags.fm CEO | Park |
| **Toly** | Solana Co-founder | Park |
| **Shaw** | ElizaOS Creator | Park |
| **Ghost** | Community Funder | Park |
| **Neo** | Launch Scout | BagsCity |
| **CJ** | Market Commentary | BagsCity |
| **Professor Oak** | Launch Wizard | Founder's Corner |
| **Ramo** | CTO | HQ |
| **Sincara** | Frontend Engineer | HQ |
| **Stuu** | Operations | HQ |
| **Sam** | Growth | HQ |
| **Alaa** | Skunk Works | HQ |
| **Carlo** | Ambassador | HQ |
| **BNN** | News Network | HQ |
| **Ash** | Ecosystem Guide | Park |
| **Bags Bot** | World Guide | All |

### Game Features

- **Building Decay System** - Buildings lose health without trading activity (60-second cycles)
- **Trading Dojo** - Spar against 5 AI opponents with belt progression
- **Oracle Tower** - Prediction market for token price movements
- **Casino** - Community-funded raffles and prizes
- **Sniper Tower** - Real-time launch detection across all Bags.fm
- **Day/Night Cycle** - Synced to EST with dynamic lighting
- **Original Soundtrack** - 7 Pokemon-style tracks synthesized in-browser

### Blockchain Integration

- **Bags.fm SDK** - Real-time token data, launches, fee claims
- **Jupiter** - In-game token swaps
- **DexScreener** - Market data and price feeds
- **Phantom Wallet** - Connect and trade directly
- **Bitquery** - Platform-wide activity monitoring

## Quick Start

```bash
# Clone
git clone https://github.com/AIEngineerX/BagsWorld.git
cd BagsWorld

# Install
npm install

# Configure (copy and edit with your keys)
cp .env.example .env.local

# Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Running ElizaOS Agents

The AI characters run as a separate microservice:

```bash
# In a separate terminal
cd eliza-agents
npm install
npm run start:dev
```

This starts the agent server on port 3001. The main app connects automatically via `AGENTS_API_URL`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BAGS_API_KEY` | Yes | Bags.fm API key |
| `SOLANA_RPC_URL` | Yes | Helius RPC for transactions |
| `ANTHROPIC_API_KEY` | For AI | Claude API for character chat |
| `DATABASE_URL` | For persistence | Neon PostgreSQL connection |
| `BITQUERY_API_KEY` | Optional | Platform-wide Bags.fm feed |

See [.env.example](.env.example) for full configuration.

## Architecture

```
BagsWorld/
├── src/
│   ├── app/
│   │   ├── api/              # 65+ API routes
│   │   │   ├── world-state/  # Main game state engine
│   │   │   ├── character-chat/
│   │   │   ├── casino/
│   │   │   ├── oracle/
│   │   │   └── ...
│   │   └── page.tsx
│   ├── components/           # React UI components
│   ├── game/
│   │   └── scenes/
│   │       ├── BootScene.ts  # Asset generation
│   │       └── WorldScene.ts # Main game logic
│   ├── characters/           # Character metadata for UI
│   ├── hooks/                # React hooks
│   └── lib/
│       ├── world-calculator.ts  # Health & decay logic
│       ├── bags-api.ts          # Bags.fm client
│       └── types.ts             # TypeScript definitions
│
├── eliza-agents/             # ElizaOS microservice
│   └── src/
│       ├── characters/       # Full character definitions
│       ├── services/         # Agent coordination
│       ├── routes/           # Agent API endpoints
│       └── server.ts         # Express server
│
└── public/                   # Static assets
```

### Data Flow

1. **Token Registry** - Users register tokens (localStorage + Neon DB)
2. **useWorldState Hook** - Polls API every 30 seconds
3. **World State API** - Enriches tokens with Bags SDK data
4. **World Calculator** - Transforms data into game entities
5. **Phaser WorldScene** - Renders the pixel art world
6. **ElizaOS Agents** - Handle character conversations

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 14 (App Router) |
| Game Engine | Phaser 3.80 |
| AI Agents | ElizaOS + Claude/GPT |
| Blockchain | Solana Web3.js, Bags.fm SDK |
| Database | Neon PostgreSQL |
| State | Zustand + TanStack Query |
| Styling | Tailwind CSS |

## Community Funding

BagsWorld charges **zero fees** to creators. Ghost ([@DaddyGhost](https://x.com/DaddyGhost)) personally contributes 5% of $BagsWorld revenue to fund:

- Casino prizes and raffles
- New zones and features
- Development and maintenance

All contributions verifiable on-chain via [Solscan](https://solscan.io/account/9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC).

## Deployment

### Netlify (Recommended)

1. Connect GitHub repo to Netlify
2. Build command: `npm run build`
3. Publish directory: `.next`
4. Add environment variables in dashboard

Neon database auto-configures via Netlify integration.

### ElizaOS Agents

Deploy the `eliza-agents/` folder separately (Railway, Render, or any Node.js host). Set `AGENTS_API_URL` in the main app to point to your deployed agent server.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions and guidelines.

## License

MIT License - see [LICENSE](LICENSE)

---

**Built for the [Bags.fm](https://bags.fm) ecosystem on Solana**
