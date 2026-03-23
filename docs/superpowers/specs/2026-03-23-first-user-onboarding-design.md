# First-User Guided Onboarding — Design Spec

**Date:** 2026-03-23
**Status:** Approved

## Problem

New users face 50+ visible UI elements on desktop, a passive quest tracker that guides nothing, and an ENTER WORLD button that unexpectedly opens an avatar creator before they can explore. The result: confusion, information overload, and no clear path to value.

## Solution

Three changes working together:

### 1. Auto-Enter on First Visit

After the Oak Wizard closes (or is skipped), auto-spawn the player in Park with a random default sprite. No avatar modal on first visit — zero friction to gameplay.

- First visit: dispatch `bagsworld-enter-world` with a random `spriteVariant` (0-4) immediately after wizard closes
- "Customize Character" icon added to ImmersiveHUD, next to zone name pill
- Clicking it opens the existing EnterWorldButton avatar creator modal
- Returning users who have exited the world still see the ENTER WORLD button as before
- Track first-entry state via `localStorage` key `bagsworld_first_entry_done`

### 2. Spotlight Tutorial (replaces Quest Tracker)

A full-screen overlay that dims the world and spotlights the current target. Replaces the passive QuestTracker component entirely.

**Visual design:**
- Dark overlay at `rgba(0,0,0,0.75)` covering the entire game canvas
- Circular spotlight cutout (CSS `radial-gradient` or `clip-path`) centered on the target
- Pulsing green arrow above the spotlight target
- Speech bubble anchored to bottom-center of the screen with:
  - Step counter: "STEP 1 of 4"
  - Instruction text (mobile-aware)
  - Hint text: "Press ESC to skip tutorial" (desktop) / "Tap SKIP to exit" (mobile)

**4 Steps:**

| Step | Target | Desktop Text | Mobile Text | Completion Trigger |
|------|--------|-------------|-------------|-------------------|
| 1 | None (free movement) | "Use WASD to walk around" | "Use the joystick to walk around" | Player moves 50+ pixels from spawn |
| 2 | Ash NPC | "Walk to Ash and press E to talk" | "Walk to Ash and tap the interact button" | Player triggers NPC interaction with Ash |
| 3 | Nearest building | "Click a building to see its token data" | "Tap a building to see its token data" | Player clicks/taps any building |
| 4 | None (celebration) | "You're ready! Explore zones with the arrows, talk to characters, and launch your own token." | Same | Auto-dismisses after 5 seconds |

**Behavior:**
- ESC key (desktop) or SKIP button (mobile) exits the entire tutorial at any step
- Tutorial state stored in `localStorage` key `bagsworld_tutorial_done` — never shows again
- Joystick and mobile interact button remain functional under the overlay
- Spotlight position updates if the target NPC moves (read from Phaser sprite position)
- If the target isn't visible (off-screen), show a directional indicator arrow at the screen edge

**Events from Phaser (WorldScene must emit):**
- `bagsworld-player-moved` with `{ distance: number }` — fired when cumulative movement exceeds threshold
- `bagsworld-npc-interacted` with `{ characterId: string }` — fired on NPC interaction (already exists as character click events)
- `bagsworld-building-clicked` with `{ mint: string }` — fired on building click (already exists)
- `bagsworld-player-position` with `{ x: number, y: number }` — fired each frame when tutorial is active, for spotlight positioning

### 3. Progressive UI Disclosure

During the spotlight tutorial, hide non-essential UI to reduce overwhelm. Full UI fades in after tutorial completes.

**During tutorial (hidden):**
- Sidebar (BUILDINGS, MARKET, AGENT CHATTER)
- Zone navigation buttons
- Header action buttons (CLAIM, LAUNCH, MUSIC, DASHBOARD links)
- MiniMap
- ScoutAlerts

**During tutorial (visible):**
- ImmersiveHUD (zone name, health, arrows, exit)
- Game canvas
- Spotlight overlay + speech bubble
- SKIP button

**After tutorial completes or is skipped:**
- All hidden elements fade in over 500ms via CSS transition
- Sidebar slides in from right
- Header buttons appear

**State management:**
- `tutorialActive` boolean in page.tsx state (or Zustand store)
- Components check this flag to conditionally render or apply `opacity-0` / `translate-x-full`
- Flag clears on tutorial completion or skip

## Component Architecture

### New: `SpotlightTutorial.tsx`

Replaces `QuestTracker.tsx`. A React overlay component that:
- Receives `tutorialStep` and `targetPosition` as props
- Renders the dark overlay with spotlight cutout
- Renders the speech bubble with step-appropriate text
- Detects mobile via `window.matchMedia` or user-agent
- Listens for completion events from Phaser via window events
- Calls `onComplete()` or `onSkip()` callbacks to parent

### Modified: `ImmersiveHUD.tsx`

- Add a "Customize Character" button (small avatar icon) to the top bar
- Clicking dispatches the existing avatar creator modal open event
- Position: left side of the HUD pill, or as a small icon button near EXIT

### Modified: `page.tsx`

- After wizard closes on first visit: auto-dispatch `bagsworld-enter-world` with random sprite
- Add `tutorialActive` state
- Pass `tutorialActive` to sidebar/header for progressive disclosure
- Render `<SpotlightTutorial>` instead of `<QuestTracker>` when `tutorialActive`

### Modified: `EnterWorldButton.tsx`

- On first visit (no `bagsworld_first_entry_done` in localStorage), skip the avatar modal
- Auto-enter is handled by page.tsx, so this component just needs to not interfere

### Modified: `WorldScene.ts`

- Emit `bagsworld-player-moved` with cumulative distance during tutorial
- Emit `bagsworld-player-position` each frame when tutorial overlay requests it (via a flag)
- Existing NPC click and building click events already serve as completion triggers

### Removed: `QuestTracker.tsx`

- Delete the file and remove from page.tsx imports
- The 8-step quest system is fully replaced by the 4-step spotlight tutorial

## Mobile Considerations

- Tutorial detects mobile and adjusts instruction text (joystick vs WASD, tap vs click/press E)
- Virtual joystick and interact button must remain functional under the spotlight overlay
- Spotlight overlay uses `pointer-events: none` except for the SKIP button area
- Speech bubble positioned to not overlap the joystick (bottom-center, above joystick zone)
- SKIP button has 44px minimum touch target

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/SpotlightTutorial.tsx` | New spotlight tutorial overlay |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/ImmersiveHUD.tsx` | Add customize character button |
| `src/app/page.tsx` | Auto-enter logic, tutorial state, progressive disclosure, replace QuestTracker |
| `src/components/EnterWorldButton.tsx` | Skip modal on first visit |
| `src/game/scenes/WorldScene.ts` | Emit player-moved event with distance during tutorial |

## Files to Delete

| File | Reason |
|------|--------|
| `src/components/QuestTracker.tsx` | Replaced by SpotlightTutorial |

## What Stays the Same

- Oak Intro Wizard (unchanged)
- ENTER WORLD button for returning users who exited the world
- Avatar creator modal (unchanged, accessed from ImmersiveHUD instead of entry flow)
- All existing zones, NPCs, buildings
- All character chat components
- Sidebar content (just hidden during tutorial, not changed)
