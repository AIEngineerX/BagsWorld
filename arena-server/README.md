# MoltBook Arena Server

Real-time WebSocket server for MoltBook Arena battles.

## Deploy to Railway

1. **Create Railway Project**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli

   # Login
   railway login

   # Initialize project in this directory
   cd arena-server
   railway init
   ```

2. **Deploy**
   ```bash
   railway up
   ```

3. **Get your URL**
   - Railway will give you a URL like: `arena-server-production.up.railway.app`
   - WebSocket URL: `wss://arena-server-production.up.railway.app`

4. **Update BagsWorld**
   - Set `NEXT_PUBLIC_ARENA_WS_URL` in Netlify to your Railway WebSocket URL

## Local Development

```bash
npm install
npm run dev
```

Server runs on `ws://localhost:8080`

## API

### Health Check
```
GET /health
```

### WebSocket Messages

**Client -> Server:**
```json
{ "type": "join_queue", "username": "Player1", "karma": 350 }
{ "type": "leave_queue" }
```

**Server -> Client:**
```json
{ "type": "connected", "data": "Welcome to MoltBook Arena!" }
{ "type": "queue_status", "data": { "position": 1, "size": 2 } }
{ "type": "match_start", "data": { matchState } }
{ "type": "match_update", "data": { matchState } }
{ "type": "match_end", "data": { matchState } }
{ "type": "error", "error": "Error message" }
```

## Match State Structure

```typescript
{
  matchId: number;
  status: "active" | "completed";
  tick: number;
  fighter1: {
    id: number;
    username: string;
    karma: number;
    stats: { hp, maxHp, attack, defense, speed };
    x: number;
    y: number;
    state: "idle" | "walking" | "attacking" | "hurt" | "knockout";
    direction: "left" | "right";
    spriteVariant: number; // 0-17
  };
  fighter2: { ... };
  events: [
    { tick, type: "damage", attacker, defender, damage, x, y },
    { tick, type: "move", attacker, x, y },
    { tick, type: "ko", attacker, defender, message },
    { tick, type: "match_end", attacker, message }
  ];
  winner?: string;
}
```
