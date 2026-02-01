# MoltBook Arena Battle System - Implementation Plan

## Executive Summary

Transform the MoltBook Arena from instant-resolution fights to a **30-second animated battle experience**. The key challenge is achieving real-time battle visualization on serverless infrastructure (Netlify).

---

## 1. Current State vs Desired State

### Current (Broken)
```
Player 1 joins → queued
Player 2 joins → fight runs instantly (0.1 seconds)
                → result shown immediately
                → no animation visible
```

### Desired
```
Player 1 joins → waits in queue (sees "Waiting for opponent...")
Player 2 joins → match starts
                → 30-second animated battle plays
                → both players watch the fight
                → winner revealed at end
```

---

## 2. Architecture Options Analysis

### Option A: True Real-Time WebSockets
**How:** Dedicated WebSocket server pushes updates every 100ms.

| Pros | Cons |
|------|------|
| Lowest latency | Requires separate server ($5-20/mo) |
| True real-time | Cannot run on Netlify serverless |
| Synchronized for all viewers | Complex connection management |

**Verdict:** Best UX, but requires additional infrastructure.

---

### Option B: Server-Sent Events (SSE)
**How:** Long-running HTTP connection streams fight updates.

| Pros | Cons |
|------|------|
| Works with serverless (sort of) | Netlify timeout: 10 seconds (26s Pro) |
| Simpler than WebSockets | Not long enough for 30-second fights |

**Verdict:** Blocked by serverless timeout limits.

---

### Option C: Short Polling (Every 1-2 seconds)
**How:** Client polls `/api/arena/brawl?action=match_state` repeatedly.

| Pros | Cons |
|------|------|
| Works on any platform | High API request volume (15-30 calls) |
| Simple implementation | 1-2 second latency = choppy animation |

**Verdict:** Works but poor UX.

---

### Option D: Pre-Computed Replay (RECOMMENDED)
**How:**
1. Fight runs to completion instantly on server
2. Full `CombatEvent[]` log stored
3. Client receives replay data
4. Client animates fight locally over 30 seconds

| Pros | Cons |
|------|------|
| Works perfectly on serverless | Not truly "live" |
| Single API call returns everything | Must hide winner until animation ends |
| Deterministic - same for all viewers | |
| Spectators can watch replays later | |
| Lowest server load | |

**Verdict:** Best fit for Netlify. **This is the recommended approach.**

---

## 3. Recommended Architecture: Pre-Computed Replay

### Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  PLAYER 1                                                        │
│  1. POST /api/arena/brawl {action: "join", username: "Alice"}    │
│  2. Response: {queued: true, fighterId: 1}                       │
│  3. UI shows: "Waiting for opponent..."                          │
│  4. Poll every 3-5s: GET /api/arena/brawl?action=my_match&id=1   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ (Player 2 joins)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PLAYER 2                                                        │
│  1. POST /api/arena/brawl {action: "join", username: "Bob"}      │
│  2. Matchmaking triggered → Fight runs instantly (0.1s)          │
│  3. Response includes FULL REPLAY DATA:                          │
│     {                                                            │
│       matched: true,                                             │
│       matchId: 123,                                              │
│       replay: [                                                  │
│         {tick: 0, type: "match_start"},                          │
│         {tick: 15, type: "move", fighter: 1, x: 80},             │
│         {tick: 30, type: "damage", attacker: "Alice", dmg: 12},  │
│         ...                                                      │
│         {tick: 287, type: "ko", loser: "Bob"},                   │
│         {tick: 287, type: "match_end", winner: "Alice"}          │
│       ],                                                         │
│       totalTicks: 287,                                           │
│       fighter1: {username: "Alice", karma: 350, hp: 174},        │
│       fighter2: {username: "Bob", karma: 200, hp: 166}           │
│     }                                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  BOTH PLAYERS                                                    │
│  4. ArenaModal receives replay data                              │
│  5. ReplayPlayer component animates fight:                       │
│     - 100ms per tick = 28.7 seconds for 287 ticks                │
│     - Fighters move, attack, take damage                         │
│     - Health bars update                                         │
│     - Crowd cheers on hits                                       │
│  6. Winner revealed ONLY at end of animation                     │
└─────────────────────────────────────────────────────────────────┘
```

### Player 1 Gets Notified via Polling

While Player 1 waits, their client polls every 3-5 seconds:

```typescript
GET /api/arena/brawl?action=my_match&fighterId=1

// Response when still waiting:
{ queued: true, position: 1 }

// Response when matched:
{
  matched: true,
  matchId: 123,
  replay: [...],  // Full fight log
  totalTicks: 287,
  fighter1: {...},
  fighter2: {...},
  // Note: winner is NOT included yet - revealed at end
}
```

---

## 4. Fight Timing Calculation

**Target:** 30-second fight animation

| Variable | Value | Notes |
|----------|-------|-------|
| Server tick rate | 100ms | Already implemented |
| Client playback rate | 100ms per tick | Matches server |
| Typical fight length | 250-350 ticks | Based on karma/stats |
| Animation duration | 25-35 seconds | Perfect range |

**Formula:** `animationDuration = totalTicks * 100ms`

Example: 300 ticks × 100ms = 30,000ms = 30 seconds

---

## 5. Implementation Components

### 5.1 New API Endpoint: `my_match`

```typescript
// GET /api/arena/brawl?action=my_match&fighterId=123

case "my_match": {
  const fighterId = parseInt(searchParams.get("fighterId") || "0");

  // Check if fighter was recently matched
  const match = await getRecentMatchByFighter(fighterId);

  if (!match) {
    // Still waiting
    const position = await getQueuePosition(fighterId);
    return NextResponse.json({ queued: true, position });
  }

  // Match found - return full replay
  return NextResponse.json({
    matched: true,
    matchId: match.id,
    replay: match.fight_log,
    totalTicks: match.total_ticks,
    fighter1: { id: match.fighter1_id, username: "...", karma: ... },
    fighter2: { id: match.fighter2_id, username: "...", karma: ... },
    // Winner revealed client-side after animation
  });
}
```

### 5.2 New Database Functions

```typescript
// src/lib/arena-db.ts

// Get a fighter's most recent match (completed in last 5 minutes)
export async function getRecentMatchByFighter(fighterId: number): Promise<ArenaMatch | null>

// Get fighter's position in queue (1-indexed)
export async function getQueuePosition(fighterId: number): Promise<number>
```

### 5.3 New React Component: ReplayPlayer

```typescript
// src/components/ArenaReplayPlayer.tsx

interface ReplayPlayerProps {
  replay: CombatEvent[];
  totalTicks: number;
  fighter1: FighterInfo;
  fighter2: FighterInfo;
  onComplete: () => void;
}

export function ArenaReplayPlayer(props: ReplayPlayerProps) {
  const [currentTick, setCurrentTick] = useState(0);
  const [fighter1State, setFighter1State] = useState({...});
  const [fighter2State, setFighter2State] = useState({...});

  // Advance tick every 100ms
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTick(t => t + 1);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Process events for current tick
  useEffect(() => {
    const events = replay.filter(e => e.tick === currentTick);
    events.forEach(processEvent);
  }, [currentTick]);

  return (
    <div className="arena-replay">
      <HealthBars fighter1={fighter1State} fighter2={fighter2State} />
      <FighterSprites ... />
      <DamageNumbers ... />
      {currentTick >= totalTicks && <WinnerAnnouncement />}
    </div>
  );
}
```

### 5.4 ArenaModal State Machine

```typescript
type ArenaState =
  | "idle"        // Not joined
  | "joining"     // API call in progress
  | "queued"      // Waiting for opponent (polling)
  | "matched"     // Opponent found, loading replay
  | "fighting"    // Replay animation playing
  | "finished";   // Fight complete, showing result

const [arenaState, setArenaState] = useState<ArenaState>("idle");
```

---

## 6. Files to Modify

| File | Changes |
|------|---------|
| `src/app/api/arena/brawl/route.ts` | Add `my_match` action, modify `join` to return replay |
| `src/lib/arena-db.ts` | Add `getRecentMatchByFighter()`, `getQueuePosition()` |
| `src/lib/arena-matchmaking.ts` | Ensure fight_log is saved to database |
| `src/components/ArenaModal.tsx` | Add state machine, polling, replay integration |
| `src/components/ArenaReplayPlayer.tsx` | NEW - replay animation component |
| `src/lib/arena-types.ts` | Export CombatEvent type for client use |

---

## 7. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Player closes browser while queued | Misses fight notification | Store match result, show on return |
| Slow device can't animate smoothly | Choppy playback | Offer 2x speed, skip button |
| Large fight logs slow API | Poor performance | Cap at 500 ticks, compress events |
| Database connection drops | Can't save fight log | Already have in-memory fallback |
| Polling hammers server | High load | 5-second interval, max 2 min wait |

---

## 8. Implementation Phases

### Phase 1: Backend (1-2 hours)
- [ ] Add `my_match` API endpoint
- [ ] Add `getRecentMatchByFighter()` to arena-db
- [ ] Add `getQueuePosition()` to arena-db
- [ ] Ensure fight_log is saved on match completion
- [ ] Test with curl

### Phase 2: ReplayPlayer Component (2-3 hours)
- [ ] Create ArenaReplayPlayer.tsx
- [ ] Implement tick-by-tick state machine
- [ ] Fighter position interpolation
- [ ] Health bar animations
- [ ] Damage number popups
- [ ] Winner announcement

### Phase 3: ArenaModal Integration (1-2 hours)
- [ ] Add arena state machine
- [ ] Implement queue polling
- [ ] Transition to replay on match
- [ ] Handle all edge cases

### Phase 4: Polish (1-2 hours)
- [ ] Mobile responsiveness
- [ ] Loading/error states
- [ ] Sound effects (optional)
- [ ] Skip/speed controls

---

## 9. Questions for Clarification

1. **Spectator mode?** Should users be able to watch ongoing/past fights they didn't participate in?

2. **Rematch option?** After a fight ends, offer "Fight Again" button?

3. **Queue timeout?** How long should Player 1 wait before being removed from queue? (Currently 5 minutes)

4. **Phaser vs React?** Should the replay render in:
   - React components (simpler, matches current modal)
   - Phaser game scene (better visuals, more complex)

5. **Sound effects?** Add punch sounds, crowd cheers, victory fanfare?

---

## 10. Approval Checklist

Before implementation, please confirm:

- [ ] Pre-computed replay approach is acceptable (not truly "live")
- [ ] 30-second fight duration is correct target
- [ ] React-based replay (vs Phaser) is preferred
- [ ] Polling every 5 seconds for waiting player is acceptable
- [ ] Winner hidden until animation ends is desired behavior
