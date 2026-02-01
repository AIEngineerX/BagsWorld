# Zone-Based Character Grouping - Analysis & Implementation Plan

## Executive Summary

**Goal:** Ensure AI agents/characters are grouped by zone so they "live" only in specific areas of BagsWorld.

**Current State:** Zone-based character filtering **already exists** but is incomplete:

- Special characters have zone assignments in `SPECIAL_CHARACTERS` config
- Zone filtering logic exists in `WorldScene.ts`
- BUT: 2 zones (`ballers`, `founders`) have no assigned characters
- BUT: Regular fee earners all default to `main_city`

---

## Current Architecture Analysis

### Zone Configuration (`src/lib/types.ts`)

```
5 Zones Defined:
├── main_city (Park)      - Core hub, peaceful
├── trending (BagsCity)   - Urban, hot tokens
├── academy (Academy)     - Learning, Bags.fm team
├── ballers (Ballers Valley) - Luxury mansions, top holders
└── founders (Founder's Corner) - DexScreener education
```

### Character Zone Assignments (`src/lib/world-calculator.ts:343-451`)

| Zone                    | Characters Currently Assigned                    |
| ----------------------- | ------------------------------------------------ |
| **main_city (Park)**    | Toly, Ash, Dev (Ghost), Shaw                     |
| **trending (BagsCity)** | Neo (Scout), CJ                                  |
| **academy (Academy)**   | Finn, Ramo, Sincara, Stuu, Sam, Alaa, Carlo, BNN |
| **ballers**             | NONE                                             |
| **founders**            | NONE                                             |

### Type Limitation Issue

```typescript
// world-calculator.ts line 350-351
const SPECIAL_CHARACTERS: Record<string, {
  zone: "main_city" | "trending" | "academy";  // Missing: "ballers" | "founders"
  ...
}>
```

The zone type is hardcoded to only 3 zones, preventing assignment to `ballers` or `founders`.

### Filtering Logic (`src/lib/scenes/WorldScene.ts:4416-4419`)

```typescript
const zoneCharacters = characters.filter((c) => {
  if (!c.zone) return this.currentZone === "main_city"; // Default: Park
  return c.zone === this.currentZone;
});
```

This logic works correctly but only receives characters that were assigned zones.

---

## Problem Analysis

### Problem 1: Zone Type Mismatch

The `SPECIAL_CHARACTERS` config restricts zone to 3 values:

```typescript
zone: "main_city" | "trending" | "academy";
```

But `ZoneType` in `types.ts` has 5 values:

```typescript
type ZoneType = "main_city" | "trending" | "academy" | "ballers" | "founders";
```

**Impact:** Cannot assign characters to `ballers` or `founders` zones.

### Problem 2: Empty Zones

`ballers` and `founders` zones have no inhabitants - they're empty of NPC characters, making them feel lifeless.

### Problem 3: Regular Fee Earners Clustering

All non-special characters (procedural fee earners) default to `main_city`, causing:

- Park zone feels overcrowded
- Other zones feel empty
- No variety in zone populations

### Problem 4: No Zone-Character Mapping Visibility

There's no clear "zone roster" that shows which characters belong where, making it hard to:

- Plan new character additions
- Balance zone populations
- Understand the world design

---

## Clarifying Questions

Before implementation, I need decisions on:

### Q1: Ballers Valley Population

Should `ballers` zone have NPC characters? Options:

1. **No characters** - Just mansions (current)
2. **Mansion owners as characters** - Top 5 $BagsWorld holders become clickable NPCs
3. **Dedicated luxury characters** - Create new "butler", "valet", "concierge" NPCs
4. **Existing character visits** - One existing character (e.g., Finn as CEO) appears here

### Q2: Founder's Corner Population

Should `founders` zone have NPC characters? Options:

1. **No characters** - Just educational buildings (current)
2. **Teacher/Guide character** - Create "Professor" or "Mentor" NPC
3. **Existing character teaches** - Shaw (ElizaOS creator) or another dev character
4. **Multiple guides** - Different characters for each building topic

### Q3: Fee Earner Distribution

How should regular (procedural) fee earners be distributed? Options:

1. **All in Park** - Keep current behavior (main_city only)
2. **Hash-based distribution** - Deterministic split across main_city + trending
3. **Activity-based** - High earners go to trending, low earners to park
4. **User choice** - Token launcher picks zone when creating token

### Q4: Character Exclusivity

Should characters be exclusive to one zone? Options:

1. **Strict exclusivity** - Character ONLY appears in their assigned zone
2. **Primary zone + visits** - Character has home zone but occasionally appears elsewhere
3. **Multi-zone presence** - Some characters (like BagsWorld HQ building) appear in all zones

### Q5: Zone Population Targets

What's the ideal character count per zone? Options:

1. **Equal distribution** - Same number per zone
2. **Theme-based** - Park: 5, BagsCity: 4, Academy: 8, Ballers: 3, Founders: 2
3. **Dynamic** - Based on zone activity/popularity

---

## Technical Implementation Options

### Option A: Minimal Fix (Type Alignment Only)

**Scope:** Fix the type mismatch, no new content

**Changes:**

1. Update `SPECIAL_CHARACTERS` zone type to include all 5 zones
2. No new characters added

**Files Modified:**

- `src/lib/world-calculator.ts` (1 line type change)

**Pros:** Minimal risk, enables future additions
**Cons:** Doesn't solve empty zones problem

---

### Option B: Zone Type Fix + Empty Zone Characters

**Scope:** Fix types + add characters to empty zones

**Changes:**

1. Fix zone type to include all 5 zones
2. Create character definitions for new zone inhabitants
3. Add to SPECIAL_CHARACTERS config
4. Create chat components for new characters
5. Generate sprites in BootScene

**New Characters Needed:**

- `ballers`: 1-3 characters (butler/valet/concierge OR mansion owners)
- `founders`: 1-2 characters (mentor/teacher)

**Files Modified:**

- `src/lib/types.ts` - Add new character flags
- `src/lib/world-calculator.ts` - Add zone type + new character configs
- `src/characters/` - New character definition files
- `src/components/` - New chat components
- `src/game/scenes/BootScene.ts` - New sprite generation
- `src/game/scenes/WorldScene.ts` - Click handlers for new characters

**Estimated Scope:** ~400-600 lines new code

**Pros:** Complete solution, zones feel alive
**Cons:** Requires creative decisions on new characters

---

### Option C: Full Zone-Character System Refactor

**Scope:** Comprehensive overhaul with configuration-driven zones

**Changes:**

1. Create a centralized `ZONE_CONFIG` that defines:
   - Zone metadata
   - Resident characters list
   - Population limits
   - Character spawn rules
2. Fee earner distribution logic
3. Zone-specific NPC behavior
4. Optional: Character "visiting" system

**New Architecture:**

```typescript
// New: src/lib/zone-config.ts
export const ZONE_CONFIG: Record<ZoneType, ZoneDefinition> = {
  main_city: {
    name: "Park",
    residents: ["toly", "ash", "dev", "shaw"],
    maxPopulation: 8,
    acceptsFeeEarners: true,
    feeEarnerPriority: "low_earners",
  },
  trending: {
    name: "BagsCity",
    residents: ["scout", "cj"],
    maxPopulation: 6,
    acceptsFeeEarners: true,
    feeEarnerPriority: "high_earners",
  },
  // ... etc
};
```

**Files Modified:**

- New file: `src/lib/zone-config.ts`
- `src/lib/types.ts` - Zone definition types
- `src/lib/world-calculator.ts` - Refactor to use zone config
- All scene files - Reference zone config

**Estimated Scope:** ~800-1000 lines changed

**Pros:** Scalable, maintainable, clear zone ownership
**Cons:** Larger refactor, more testing needed

---

## Recommended Approach

**Recommendation: Option B (Zone Type Fix + Empty Zone Characters)**

Rationale:

1. Fixes immediate type issue
2. Brings empty zones to life
3. Manageable scope
4. Doesn't over-engineer

### Proposed Implementation Steps

**Phase 1: Type Alignment (15 min)**

1. Update `SPECIAL_CHARACTERS` zone type to `ZoneType`
2. Verify no TypeScript errors

**Phase 2: Ballers Valley Character (if approved)**

1. Design character(s) - butler? concierge? whale mascot?
2. Create character definition file
3. Add to SPECIAL_CHARACTERS
4. Create chat component
5. Generate sprite

**Phase 3: Founder's Corner Character (if approved)**

1. Design character - mentor? professor? guide?
2. Create character definition file
3. Add to SPECIAL_CHARACTERS
4. Create chat component
5. Generate sprite

**Phase 4: Fee Earner Distribution (optional)**

1. Modify `transformFeeEarnerToCharacter` to assign zones
2. Use hash-based or activity-based distribution

---

## Data Flow Diagram

```
Current Flow:
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│ FeeEarner Data  │ ──► │ transformFeeEarner   │ ──► │ GameCharacter   │
│ (from API)      │     │ ToCharacter()        │     │ with zone prop  │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │ SPECIAL_CHARACTERS   │
                    │ config lookup        │
                    │ zone: "main_city" |  │
                    │       "trending" |   │  ◄── TYPE LIMITATION
                    │       "academy"      │
                    └──────────────────────┘

Proposed Flow:
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│ FeeEarner Data  │ ──► │ transformFeeEarner   │ ──► │ GameCharacter   │
│ (from API)      │     │ ToCharacter()        │     │ with zone prop  │
└─────────────────┘     └──────────────────────┘     └─────────────────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │ SPECIAL_CHARACTERS   │
                    │ config lookup        │
                    │ zone: ZoneType       │  ◄── FIXED
                    │ (all 5 zones)        │
                    └──────────────────────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │ WorldScene filtering │
                    │ zoneCharacters =     │
                    │ filter(zone match)   │
                    └──────────────────────┘
```

---

## Risks & Mitigations

| Risk                        | Impact | Mitigation                                              |
| --------------------------- | ------ | ------------------------------------------------------- |
| Empty zones feel lifeless   | Medium | Add at least 1 character per zone                       |
| New characters need sprites | Low    | Follow existing sprite generation patterns in BootScene |
| Chat components needed      | Low    | Copy existing chat component structure                  |
| Type changes break builds   | Low    | Run `npm run build` after type changes                  |
| Zone overcrowding           | Medium | Set per-zone population limits                          |

---

## Open Questions for User

1. **Ballers Valley Characters:** What characters should live here?
   - Option A: No NPCs (mansions only)
   - Option B: "Butler" or "Concierge" NPC
   - Option C: Top holder wallets become clickable NPCs
   - Option D: Other (specify)

2. **Founder's Corner Characters:** What characters should teach here?
   - Option A: No NPCs (buildings only)
   - Option B: New "Professor/Mentor" character
   - Option C: Existing character (Shaw? Ramo?) teaches here
   - Option D: Other (specify)

3. **Fee Earner Distribution:** Should regular fee earners be spread across zones?
   - Option A: Keep all in Park (current)
   - Option B: Split between Park and BagsCity
   - Option C: Distribute based on earnings
   - Option D: Other (specify)

4. **Implementation Priority:** Which should we tackle first?
   - Option A: Just fix the type issue (minimal)
   - Option B: Types + one new zone character
   - Option C: Full implementation of all zones

---

## Next Steps

Awaiting your decisions on:

1. Character choices for empty zones
2. Fee earner distribution preference
3. Implementation priority/scope

Once clarified, I can proceed with implementation.
