# Mobile Joystick Fix — Design Spec

**Date:** 2026-03-24
**Status:** Design — pending user review

## Summary

Replace the fixed-position virtual joystick with a floating joystick that spawns at the player's touch point. Split the screen into move and interact zones to eliminate tap conflicts between movement and building/NPC interaction.

## Problems Solved

1. **Joystick positioning (B):** Fixed at x=80, y=height-90 — overlaps Bot button, character menu, doesn't respect safe area insets. Too small (54px radius) for modern phones.
2. **Interaction conflicts (C):** Joystick captures all left-side touches, preventing taps on buildings/NPCs. No separation between "move" and "interact" intent.

## Design

### Touch Zone Split

The game canvas is divided into two zones based on where the initial touch lands:

```
┌────────────────────────────┐
│                            │
│      INTERACT ZONE         │
│   (taps go to game —       │
│    buildings, NPCs, etc.)  │
│                            │
├────────────┬───────────────┤  ← 55% from top
│            │               │
│  MOVE ZONE │  INTERACT     │
│  (bottom   │  ZONE         │
│   left 40%)│  (bottom      │
│            │   right 60%)  │
│  Drag here │               │
│  = joystick│  "!" button   │
│            │  lives here   │
└────────────┴───────────────┘
     40%           60%
```

- **Move zone:** Bottom 45% of screen, left 40% of width
- **Interact zone:** Everything else
- Touch in move zone → floating joystick spawns at touch point
- Touch in interact zone → normal tap/click behavior (buildings, NPCs, UI)

### Floating Joystick Behavior

1. **Idle:** No joystick visible (clean screen)
2. **Touch down in move zone:** Joystick base appears centered on touch point, thumb tracks finger
3. **Drag:** Thumb follows finger, clamped to base radius. Character moves in that direction.
4. **Sprint:** Push thumb past 60% of base radius (same threshold as current)
5. **Release:** Joystick disappears, character stops

### Size Increase

| Property | Current | New | Reason |
|----------|---------|-----|--------|
| Base radius | 54px | 70px | Bigger target for modern 6.1"+ phones |
| Thumb radius | 22px | 28px | Proportional to base |
| Hit zone bonus | +20px | +0px (not needed) | Floating joystick IS the hit zone |
| Sprint threshold | 0.6 | 0.6 | Keep same feel |

### Interact Button Repositioning

Current: bottom-right at `cam.width - 70, cam.height - 90` — overlaps sidebar on small screens.

New: right-center area at `cam.width - 70, cam.height * 0.6` — above the bottom interact zone, away from sidebar. Size stays 30px radius with 40px hit area.

### Safe Area Handling

The move zone boundary respects `env(safe-area-inset-bottom)` on iOS. The joystick base is clamped to stay above the home indicator area. On Android, no change needed (no gesture bar conflicts at these positions).

### Conflict Resolution

| Scenario | Current | New |
|----------|---------|-----|
| Tap building on left side | Joystick activates, tap eaten | If above move zone → normal tap |
| Tap NPC near joystick | Joystick activates | Move zone only in bottom-left → NPC taps work above |
| Quick tap after small drag | wasDragGesture eats it (12px) | Move zone drags = movement only, interact zone taps = always clean |
| Bot button press | Under joystick | Bot button above move zone boundary, taps go through |
| Character menu "?" press | Thumb blocks it | Menu above move zone, no conflict |

### What Doesn't Change

- Keyboard controls (WASD/arrows) — desktop unaffected
- Sprint mechanics (same 60% threshold)
- Camera follow behavior
- NPC proximity detection and greeting system
- Building click events
- Mobile interact button pulse animation
- Pointer ID tracking (multi-touch still works)

## Files to Modify

| File | Changes |
|------|---------|
| `src/game/scenes/WorldScene.ts` | Replace `createVirtualJoystick()` with floating joystick. Add zone detection to pointer handlers. Reposition interact button. Remove fixed joystick positioning. |

No new files needed. No new dependencies.

## Edge Cases

1. **Touch starts in move zone, drags into interact zone:** Joystick stays active until release. Movement continues. No building taps triggered during active joystick drag.
2. **Multi-touch:** Joystick pointer ID tracked separately. Second finger tap in interact zone triggers normal interaction even while joystick is active.
3. **Portrait vs landscape:** Zone percentages (45%/40%) work for both orientations. Joystick spawns at touch point regardless.
4. **Very small screens (iPhone SE, 375px):** Move zone is 150px wide × 170px tall — still usable. Base radius 70px fits within this area.
5. **Joystick near edge:** If touch point is within 70px of screen edge, clamp base center inward so the full circle is visible.

## Success Criteria

- Player can move with floating joystick in bottom-left area
- Player can tap buildings/NPCs in upper portion and right side without triggering movement
- Joystick feels responsive (appears instantly at touch point)
- No overlap with Bot button, character menu, or sidebar
- Sprint still works at 60% threshold
- Interact "!" button visible and tappable without conflicting with sidebar
