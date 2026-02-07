// Sincara - Frontend Engineer knowledge
// Frontend development, UI/UX design, pixel art aesthetics, game interface design, React/Next.js

export const sincaraKnowledge: string[] = [
  // === Frontend Development ===
  "The Bags.fm frontend is built with Next.js and React, using server-side rendering for initial page loads and client-side hydration for interactive features. This hybrid approach delivers fast first-paint times with rich interactivity.",
  "Wallet connection on Bags.fm uses the Solana wallet adapter library, which provides a unified interface for Phantom, Solflare, Backpack, and other wallets. The adapter handles connection state, signing, and transaction submission.",
  "Optimistic UI updates are critical for Web3 applications. When a user initiates a claim or trade, the UI updates immediately to show the expected result while the transaction confirms on-chain in the background.",
  "Skeleton loaders replace traditional loading spinners throughout Bags.fm. They show the shape of incoming content before data loads, reducing perceived wait time and preventing jarring layout shifts.",

  // === UI/UX Design ===
  "The best Web3 UX makes blockchain invisible. Users should feel like they are using a normal app that happens to be powered by Solana. Every transaction prompt, wallet interaction, and confirmation should feel natural and expected.",
  "Cognitive load reduction is the primary design goal. Every screen should have one clear primary action. When users need to think about what to click next, the design has failed.",
  "Error states in crypto applications need special attention. Transaction failures, wallet disconnections, and RPC errors should show clear, actionable messages rather than technical blockchain errors that confuse users.",
  "Mobile-first design is non-negotiable. Over 60% of Bags.fm users access the platform on mobile devices. Every interaction must work with touch input, small screens, and variable network conditions.",

  // === Pixel Art Aesthetics ===
  "BagsWorld's pixel art style uses hard edges only with no anti-aliasing. All colors are solid fills or dithering patterns, never smooth gradients. This maintains the authentic retro game aesthetic.",
  "Pixel art buildings in BagsWorld use a 3D depth technique: lighter colors on the left edges simulate light sources, darker colors on the right edges create shadow depth. Window glows use semi-transparent auras with highlight corners.",
  "The BagsWorld layer system uses specific depth values: sky at -2, stars at -1, ground at 0, path at 1, props at 2-4, buildings at 5+, characters at 10, and flying elements at 15. This ensures proper visual ordering.",
  "Color palettes for BagsWorld zones are carefully chosen for day/night compatibility. Each zone has a base palette that shifts warmer during day and cooler at night, maintaining readability in both modes.",

  // === Game Interface Design ===
  "The BagsWorld UI overlays the Phaser game canvas with React components for modals, panels, and controls. This hybrid approach lets the pixel art world handle spatial rendering while React handles structured UI elements.",
  "Touch targets in BagsWorld are sized for mobile interaction: clickable characters and buildings have invisible hit areas larger than their visual sprites, making tapping on small pixel art elements reliable on phone screens.",
  "Zone navigation uses horizontal scrolling with snap points. Each zone fills the viewport width, and swiping moves between zones with momentum physics that feel natural on both touch and trackpad inputs.",

  // === React/Next.js Patterns ===
  "State management in BagsWorld combines Zustand for global game state (selected character, current zone, world health) with TanStack Query for server data (API responses with 55-second stale time and 60-second refresh).",
  "Component composition in BagsWorld follows the container/presenter pattern. Container components manage data fetching and state, while presenter components handle pure rendering. This separation makes testing and maintenance easier.",
  "Performance optimization for the game includes memoizing expensive re-renders with React.memo, virtualizing long lists of tokens and buildings, and debouncing frequent state updates from the Phaser game loop.",
  "Accessibility is built into every Bags.fm component. Screen readers can navigate all interactive elements, color contrast meets WCAG AA standards, and keyboard navigation works for every feature. Web3 should be accessible to everyone.",
];
