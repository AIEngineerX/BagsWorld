# Contributing to BagsWorld

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Architecture](#project-architecture)
- [Adding a New Zone](#adding-a-new-zone)
- [Adding a New Character](#adding-a-new-character)
- [ElizaOS Agent Development](#elizaos-agent-development)
- [Code Style](#code-style)
- [Pull Request Process](#pull-request-process)

---

## Development Setup

### Prerequisites

- Node.js 18+
- npm or yarn
- A code editor (VS Code recommended)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/AIEngineerX/BagsWorld.git
cd BagsWorld

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
```

### Required Environment Variables

At minimum, you need:

```env
BAGS_API_KEY=your_bags_api_key
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
```

For AI character chat:
```env
ANTHROPIC_API_KEY=your_anthropic_key
```

### Running the App

```bash
# Development server (port 3000)
npm run dev
```

### Running ElizaOS Agents (Optional)

The AI characters run as a separate microservice:

```bash
# In a new terminal
cd eliza-agents
npm install
npm run start:dev  # Runs on port 3001
```

The main app will automatically connect if `AGENTS_API_URL=http://localhost:3001` is set.

---

## Project Architecture

### Directory Structure

```
BagsWorld/
├── src/
│   ├── app/
│   │   ├── api/                    # Next.js API routes (65+)
│   │   │   ├── world-state/        # Main game state engine
│   │   │   ├── character-chat/     # AI chat endpoint
│   │   │   ├── casino/             # Raffle system
│   │   │   ├── oracle/             # Prediction market
│   │   │   └── ...
│   │   ├── page.tsx                # Main page
│   │   └── layout.tsx
│   │
│   ├── components/                 # React components
│   │   ├── modals/                 # Game modals (Trade, Casino, etc.)
│   │   ├── ui/                     # Shared UI components
│   │   └── ...
│   │
│   ├── game/
│   │   └── scenes/
│   │       ├── BootScene.ts        # Texture generation, asset loading
│   │       └── WorldScene.ts       # Main game loop, zone rendering
│   │
│   ├── characters/                 # Character metadata (for UI display)
│   │   ├── index.ts                # Character registry
│   │   ├── finn.character.ts
│   │   └── ...
│   │
│   ├── hooks/
│   │   ├── useWorldState.ts        # Main game state hook
│   │   └── ...
│   │
│   └── lib/
│       ├── world-calculator.ts     # Health, decay, entity creation
│       ├── bags-api.ts             # Bags.fm API client
│       ├── store.ts                # Zustand global store
│       └── types.ts                # TypeScript definitions
│
├── eliza-agents/                   # ElizaOS microservice (separate)
│   └── src/
│       ├── characters/
│       │   ├── definitions/        # Full character files for AI
│       │   └── index.ts
│       ├── services/
│       │   ├── AgentCoordinator.ts
│       │   ├── AutonomousService.ts
│       │   └── LaunchWizard.ts
│       ├── routes/                 # Express API routes
│       └── server.ts               # Entry point
│
└── public/                         # Static assets
```

### Key Files to Know

| File | Purpose |
|------|---------|
| `src/game/scenes/WorldScene.ts` | Main game logic, zone rendering, weather |
| `src/game/scenes/BootScene.ts` | Texture generation (buildings, props) |
| `src/lib/world-calculator.ts` | Transforms API data into game entities |
| `src/lib/types.ts` | All TypeScript interfaces |
| `src/app/api/world-state/route.ts` | Main API endpoint for game state |
| `eliza-agents/src/server.ts` | ElizaOS agent server |

### Data Flow

```
1. Token Registry (localStorage + Neon DB)
       │
       ▼
2. useWorldState Hook (polls every 30s)
       │
       ▼
3. /api/world-state (enriches with Bags SDK data)
       │
       ▼
4. world-calculator.ts (creates buildings, characters, events)
       │
       ▼
5. Zustand Store (global state)
       │
       ▼
6. WorldScene.ts (Phaser rendering)
```

---

## Adding a New Zone

Zones are the different areas of the game world. Each zone has unique buildings, decorations, and NPCs.

### Step 1: Add Zone Type

In `src/lib/types.ts`, add your zone to the `ZoneType` union:

```typescript
export type ZoneType =
  | "main_city"
  | "trending"
  | "ballers"
  | "founders"
  | "labs"
  | "your_new_zone";  // Add here
```

Also add to the `ZONES` constant:

```typescript
export const ZONES: Record<ZoneType, ZoneInfo> = {
  // ... existing zones
  your_new_zone: {
    id: "your_new_zone",
    name: "Your Zone Name",
    description: "What this zone is about",
    theme: "visual theme description",
  },
};
```

### Step 2: Generate Textures

In `src/game/scenes/BootScene.ts`, create a texture generator method:

```typescript
private generateYourZoneBuildings(): void {
  const g = this.make.graphics({ x: 0, y: 0 });

  // Example: Create a simple building
  g.fillStyle(0x3498db);  // Blue color
  g.fillRect(0, 0, 80, 120);

  // Add details (windows, doors, etc.)
  g.fillStyle(0xf1c40f);  // Yellow for windows
  g.fillRect(10, 20, 15, 15);
  g.fillRect(55, 20, 15, 15);

  g.generateTexture("your_zone_building_1", 80, 120);
  g.destroy();
}
```

Call this method in the `create()` function of BootScene.

### Step 3: Create Zone Setup

In `src/game/scenes/WorldScene.ts`:

1. Add cache variables at class level:

```typescript
private yourZoneElements: Phaser.GameObjects.GameObject[] = [];
private yourZoneCreated = false;
```

2. Add zone case in `switchToZone()`:

```typescript
case "your_new_zone":
  if (!this.yourZoneCreated) {
    this.setupYourZone();
    this.yourZoneCreated = true;
  } else {
    this.yourZoneElements.forEach(el => (el as any).setVisible(true));
  }
  break;
```

3. Implement the setup method:

```typescript
private setupYourZone(): void {
  const SCALE = 1.6;

  // Hide default park elements
  this.ground?.setVisible(false);
  this.decorations.forEach(d => d.setVisible(false));

  // Create ground
  const ground = this.add.rectangle(640, 540 * SCALE, 1280, 200, 0x228B22);
  ground.setDepth(0);
  this.yourZoneElements.push(ground);

  // Add buildings
  const building = this.add.sprite(400, 455 * SCALE, "your_zone_building_1");
  building.setOrigin(0.5, 1);
  building.setDepth(5);
  this.yourZoneElements.push(building);

  // Add decorations (trees, lamps, etc.)
  // ... more elements
}
```

### Zone Layer Guide

| Depth | Y Position | Layer | Contents |
|-------|------------|-------|----------|
| -2 | 0-430 | Sky | Day/night gradient (don't modify) |
| 0 | 540 * SCALE | Ground | Zone-specific terrain |
| 1 | 570 * SCALE | Path | Walking surface |
| 2-4 | Variable | Props | Trees, benches, decorations |
| 5+ | Variable | Buildings | Main structures |
| 10 | 555 * SCALE | Characters | NPCs walking |

### Zone Requirements

- Minimum 3 detailed buildings
- At least 20 decorative props (trees, lamps, benches)
- Textured ground (not flat solid colors)
- Day/night compatible colors (avoid pure white)
- Use pixel art style: hard edges, no anti-aliasing

---

## Adding a New Character

Characters exist in two places:
- `src/characters/` - UI metadata (name, color, icon, zone)
- `eliza-agents/src/characters/definitions/` - Full AI personality

### Step 1: Create UI Character Definition

In `src/characters/your-character.character.ts`:

```typescript
import { GameCharacter } from "@/lib/types";

export const yourCharacter: Partial<GameCharacter> = {
  id: "your_character",
  name: "Your Character",
  role: "What they do",
  zone: "main_city",  // Which zone they appear in
  color: "#3498db",   // Theme color for chat UI
  icon: "Y",          // Single letter icon
  bio: "A brief description of who they are.",
  personality: "How they talk and behave.",
  topics: [
    "topic1",
    "topic2",
    "topic3",
  ],
};
```

Register in `src/characters/index.ts`:

```typescript
import { yourCharacter } from "./your-character.character";

export const ALL_CHARACTERS = [
  // ... existing
  yourCharacter,
];
```

### Step 2: Create ElizaOS Character (for AI chat)

In `eliza-agents/src/characters/definitions/your-character.character.ts`:

```typescript
import { Character } from "../../types/elizaos.js";

export const yourCharacter: Character = {
  name: "Your Character",
  bio: [
    "First line of backstory.",
    "Second line with more detail.",
    "Third line about their expertise.",
  ],
  lore: [
    "Interesting fact about them.",
    "Another piece of lore.",
  ],
  style: {
    all: [
      "How they speak in general.",
      "Tone and manner.",
    ],
    chat: [
      "Specific chat behaviors.",
    ],
  },
  messageExamples: [
    [
      { user: "user", content: { text: "Hey, what's up?" } },
      { user: "Your Character", content: { text: "Example response in their voice." } },
    ],
  ],
  topics: [
    "topic1",
    "topic2",
    "topic3",
  ],
  adjectives: [
    "friendly",
    "knowledgeable",
    "helpful",
  ],
};
```

Register in `eliza-agents/src/characters/index.ts`.

### Step 3: Create Chat Component (Optional)

If you want a dedicated chat modal, create `src/components/YourCharacterChat.tsx` following the pattern of existing character chats like `FinnbagsChat.tsx`.

---

## ElizaOS Agent Development

The `eliza-agents/` folder is a standalone Express microservice that handles AI conversations.

### Running Agents Locally

```bash
cd eliza-agents
npm install
npm run start:dev
```

Server runs on `http://localhost:3001` with these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/agents` | GET | List all agents |
| `/api/agents/:id` | GET | Get agent info |
| `/api/agents/:id/chat` | POST | Chat with agent |
| `/api/dialogue` | POST | Multi-agent dialogue |

### Adding Services

Services in `eliza-agents/src/services/` handle autonomous behaviors:

- **AgentCoordinator** - Manages agent state and coordination
- **AutonomousService** - Scheduled tasks and monitoring
- **LaunchWizard** - Guided token launch flow

### Database

Agents use Neon PostgreSQL for persistence. Set `DATABASE_URL` to enable:
- Conversation history
- Session management
- Agent memory

---

## Code Style

### TypeScript

- Use strict TypeScript (no `any` types in critical paths)
- Define interfaces in `src/lib/types.ts`
- Use descriptive variable names

### Phaser/Game Code

- Cache created elements in arrays
- Use `setVisible()` instead of destroy/recreate
- Respect the depth layering system
- Use the SCALE constant (1.6) for positioning

### React Components

- Use functional components with hooks
- Colocate styles with Tailwind classes
- Handle loading and error states

### Commits

Use conventional commit format:
```
feat: Add new casino feature
fix: Resolve wallet connection issue
docs: Update README
refactor: Simplify world calculator
```

---

## Pull Request Process

1. **Fork** the repository
2. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/your-feature
   ```
3. **Make changes** following the code style
4. **Test locally** - ensure the game runs without errors
5. **Commit** with descriptive messages
6. **Push** to your fork
7. **Open a PR** against `main`

### PR Checklist

- [ ] Code follows existing patterns
- [ ] No console errors in browser
- [ ] Game loads and zones work
- [ ] Characters appear correctly
- [ ] New features documented

---

## Questions?

- Open an issue for bugs or feature requests
- Check existing issues before creating new ones
- Join the community on [Bags.fm](https://bags.fm)

Thanks for contributing!
