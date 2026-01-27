# BagsWorld

A self-evolving pixel art game that visualizes real-time [Bags.fm](https://bags.fm) on-chain activity on Solana.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Solana](https://img.shields.io/badge/built%20on-Solana-9945FF)
![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6)

## Overview

BagsWorld transforms abstract DeFi data into a living, gamified visualization. Token launches become buildings, fee share recipients become citizens, and real on-chain activity drives the health of the world.

| On-Chain Event        | In-Game Effect            |
| --------------------- | ------------------------- |
| Token launched        | Building appears in world |
| Market cap grows      | Building levels up (1-5)  |
| Fee share recipient   | Citizen walking around    |
| Fee claiming activity | World health increases    |
| Creator fees earned   | Characters celebrate      |

## Features

- **Living World** - Health, weather, and population react to real Bags.fm fee activity
- **Token Buildings** - Each token becomes a building that evolves with market cap
- **AI Characters** - 16 AI-powered NPCs guide users through the ecosystem
- **Real-time Events** - Watch token launches, fee claims, and milestones as they happen
- **Direct Trading** - Click any building to trade the underlying token
- **5 Unique Zones** - HQ, Park, BagsCity, Ballers Valley, Founder's Corner
- **Zero Creator Fees** - Ghost personally funds the community (no ecosystem tax)
- **Day/Night Cycle** - Synced to EST timezone with dynamic weather
- **Pokemon-style Music** - 3 original pixel art soundtrack tracks

## Community Funding Model

BagsWorld charges **zero extra fees** to creators. Instead, Ghost (@DaddyGhost) personally contributes 5% of his $BagsWorld token revenue to fund community features.

| What           | Status   | Description                                      |
| -------------- | -------- | ------------------------------------------------ |
| Creator Fees   | **None** | Creators keep 100% of their configured fee share |
| Community Fund | Live     | Ghost's 5% contribution funds Casino prizes      |
| Development    | Ongoing  | New features, zones, and improvements            |

### How It Works

```
Ghost's $BagsWorld revenue --> 5% sent to Community Wallet --> Funds Casino & Features
```

All transactions are verifiable on-chain via [Solscan](https://solscan.io).

Follow [@DaddyGhost](https://x.com/DaddyGhost) on X for updates.

## World Health

Health is calculated from real Bags.fm data:

| Metric           | Weight |
| ---------------- | ------ |
| 24h Claim Volume | 60%    |
| Lifetime Fees    | 30%    |
| Active Tokens    | 10%    |

**Baseline:** 25% + 3% per building (max 40%) when no activity

| Health Range | Status   |
| ------------ | -------- |
| 80%+         | THRIVING |
| 60-80%       | HEALTHY  |
| 45-60%       | GROWING  |
| 25-45%       | QUIET    |
| 10-25%       | DORMANT  |
| <10%         | DYING    |

## World Zones

| Zone             | Theme           | Key Features                          |
| ---------------- | --------------- | ------------------------------------- |
| HQ               | Futuristic R&D  | Bags.fm headquarters, team characters |
| Park             | Peaceful green  | PokeCenter, Toly, Ash, Shaw           |
| BagsCity         | Urban neon      | Casino, Trading Terminal, Neo, CJ     |
| Ballers Valley   | Luxury mansions | Top $BagsWorld holder showcases       |
| Founder's Corner | Learning hub    | Professor Oak, token launch guidance  |

## Building Levels

| Level | Market Cap    | Style          |
| ----- | ------------- | -------------- |
| 1     | < $100K       | Small shop     |
| 2     | $100K - $500K | Growing office |
| 3     | $500K - $2M   | Corporate HQ   |
| 4     | $2M - $10M    | Modern tower   |
| 5     | $10M+         | Skyscraper     |

## AI Agents (Powered by ElizaOS)

All 16 agents run on [ElizaOS](https://github.com/elizaOS/eliza) - Shaw's open-source TypeScript framework for autonomous AI agents.

| Character     | Role                  | Specialty                                |
| ------------- | --------------------- | ---------------------------------------- |
| Toly          | Blockchain Expert     | Solana technical knowledge               |
| Ash           | Ecosystem Guide       | Platform mechanics (Pokemon style)       |
| Finn          | Bags.fm Founder & CEO | Platform features, creator economy       |
| Ghost         | The Dev (@DaddyGhost) | Community funding, on-chain verification |
| Neo           | Scout Agent           | Launch detection, blockchain scanning    |
| CJ            | Hood Rat              | Market commentary (GTA vibes)            |
| Shaw          | ElizaOS Creator       | Agent architecture, character files      |
| Bags Bot      | World Guide           | Commands, world features                 |
| Professor Oak | Launch Wizard         | Token launch guidance                    |
| Ramo          | CTO                   | Smart contracts, SDK                     |
| Sincara       | Frontend Engineer     | UI/UX, React                             |
| Stuu          | Operations            | Support, troubleshooting                 |
| Sam           | Growth                | Marketing, community growth              |
| Alaa          | Skunk Works           | R&D, experimental features               |
| Carlo         | Ambassador            | Community onboarding                     |
| BNN           | News Network          | Platform announcements                   |

## Tech Stack

| Layer       | Technology                |
| ----------- | ------------------------- |
| Framework   | Next.js 14 (App Router)   |
| Game Engine | Phaser 3                  |
| Blockchain  | Solana Web3.js            |
| Trading     | Bags.fm SDK               |
| AI Agents   | ElizaOS + Claude Sonnet 4 |
| Database    | Neon (PostgreSQL)         |
| State       | Zustand + TanStack Query  |
| Styling     | Tailwind CSS              |
| Language    | TypeScript                |

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Bags.fm API key

### Installation

```bash
# Clone repository
git clone https://github.com/AIEngineerX/BagsWorld.git
cd BagsWorld

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
```

### Environment Variables

| Variable                     | Required | Description                        |
| ---------------------------- | -------- | ---------------------------------- |
| `BAGS_API_KEY`               | Yes      | Bags.fm API key                    |
| `SOLANA_RPC_URL`             | Yes      | Helius RPC URL for transactions    |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | No       | Client-side RPC (defaults to Ankr) |
| `ANTHROPIC_API_KEY`          | No       | Enables Claude AI chat             |

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Build

```bash
npm run build
npm start
```

## Deployment

### Netlify (Recommended)

1. Connect GitHub repository to Netlify
2. Configure build settings:
   - Build command: `npm run build`
   - Publish directory: `.next`
3. Add environment variables in dashboard

Neon database auto-configures on Netlify for global token storage.

## Project Structure

```
src/
├── app/
│   ├── api/           # API routes
│   │   ├── world-state/
│   │   ├── character-chat/
│   │   ├── launch-token/
│   │   └── ecosystem-stats/
│   └── page.tsx       # Main page
├── components/        # React components
├── game/
│   └── scenes/        # Phaser scenes
├── hooks/             # Custom hooks
└── lib/               # Utilities and types
```

## API Reference

### Key Endpoints

| Endpoint               | Method | Description                 |
| ---------------------- | ------ | --------------------------- |
| `/api/world-state`     | POST   | Get enriched world state    |
| `/api/character-chat`  | POST   | Chat with AI characters     |
| `/api/launch-token`    | POST   | Create token launch         |
| `/api/ecosystem-stats` | GET    | Community fund wallet stats |

## Security

**Key Security Features:**

- Server-side API key protection
- Client-side wallet signing (keys never leave wallet)
- Input validation on all endpoints
- No XSS vulnerabilities (React JSX escaping)

See [docs/SECURITY_AUDIT.md](docs/SECURITY_AUDIT.md) for the full security audit report.

## Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

See [docs/TESTING.md](docs/TESTING.md) for the full testing guide.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -am 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Open a Pull Request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Links

- [Bags.fm](https://bags.fm) - Trading platform
- [Documentation](docs/) - Project documentation

---

Built for the Bags.fm ecosystem on Solana
