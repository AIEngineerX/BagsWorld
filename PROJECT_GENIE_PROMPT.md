# Project Genie Prompt: Bags World

## Game Overview

**Bags World** is a self-evolving pixel art game that visualizes real on-chain activity from Bags.fm on Solana. The world dynamically reacts to live blockchain data - buildings grow based on token market caps, weather changes based on platform health, and characters respond to real trading activity.

**Core Concept:** A living, breathing pixel art world where every element reflects actual cryptocurrency activity. Think SimCity meets crypto, rendered in nostalgic 16-bit style with Pokemon-inspired charm.

---

## Visual Style

### Art Direction
- **Style:** Classic 16-bit pixel art with hard edges, no anti-aliasing
- **Colors:** Solid fills with dithering for texture, no smooth gradients
- **3D Depth:** Light source from top-left; light edges on left, dark edges on right
- **Windows:** Semi-transparent glow aura with highlight corner for "lit" effect
- **Animation:** Subtle loops (pulse, sway, float, flicker) to bring world to life
- **Resolution:** Optimized for 1920x1080 with 2x scale factor

### Color Palette (32 Core Colors)
```
Primary:     #4ade80 (Bags Green), #fbbf24 (Golden Yellow), #1a472a (Forest Green)
Buildings:   #8b5cf6 (Violet), #3b82f6 (Blue), #ffd700 (Gold), #1e3a5f (Royal Blue)
Nature:      #2d5a3d (Dark Green), #4d7c0f (Moss), #ef4444 (Red Flowers)
Urban:       #374151 (Pavement), #1f2937 (Road), #6b7280 (Gray)
Tech:        #0a1a0f (Dark Tech), #22c55e (Terminal Green), #1a1a2e (Navy)
Luxury:      #f5f0e6 (Cream/Marble), #d4a017 (Gold Inlay), #faf0e6 (Linen)
```

### Day/Night Cycle
- Time synced to EST timezone
- Sky gradient shifts from bright blue (day) to deep purple/navy (night)
- Stars appear at night with twinkling animation
- Building windows glow brighter at night

### Weather System (Based on World Health)
| Health % | Weather | Visual Effects |
|----------|---------|----------------|
| 80-100% | Sunny | Bright sky, butterflies, sparkles |
| 60-80% | Cloudy | Gray clouds, muted colors |
| 40-60% | Rain | Rain particles, puddle reflections |
| 20-40% | Storm | Lightning flashes, heavy rain, wind |
| 0-20% | Apocalypse | Red sky, ash particles, fire effects |

---

## Environments (5 Zones)

### 1. THE PARK (main_city)
**Theme:** Peaceful community gathering space - the heart of Bags World

**Atmosphere:** Relaxing, welcoming, organic feel. Where newcomers start their journey.

**Ground:** Lush grass texture in forest green (#1a472a, #2d5a3d) with scattered wildflowers in yellow (#fbbf24) and red (#ef4444)

**Key Structures:**
- Token buildings that grow 1-5 levels based on market cap
- Central fountain with animated water spray
- Building styles: Corner Stores, Taco Stands, Coffee Shops, Arcades, Tech Startups

**Props & Decorations:**
- Dense trees with varying heights and foliage colors
- Flowering bushes and hedges
- Park benches (wooden, pixel style)
- Street lamps with warm glow
- Animated wildlife (birds, butterflies)
- Cobblestone pathways

**Characters Present:** Toly, Ash, Finn, Shaw, Ghost, Bagsy

---

### 2. BAGSCITY (trending)
**Theme:** Urban downtown district - neon-lit commercial hub for trending tokens

**Atmosphere:** Energetic, fast-paced, bustling with activity. Construction signs hint at rapid growth.

**Ground:** Gray pavement (#374151) with road lanes, yellow center markings (#fbbf24), white crosswalks

**Key Structures:**
- Multi-layered urban skyline (far buildings at 40-70% opacity for depth)
- Modern commercial buildings
- Construction zones with barriers and signs

**Props & Decorations:**
- Street lamps every ~200px
- Traffic lights (positioned at intersections)
- Fire hydrants, trash cans
- Orange/white construction barriers (#f97316/#ffffff)
- "UNDER CONSTRUCTION" signs (#f59e0b)
- Animated yellow taxi that drives across screen
- Neon signs with glow effects

**Characters Present:** Neo (The Scout), CJ (Street commentator)

---

### 3. BALLERS VALLEY (ballers)
**Theme:** Exclusive luxury estate - Bel Air-inspired mansions for top token holders

**Atmosphere:** Opulent, aspirational, quiet elegance. Golden glow everywhere.

**Ground:** Manicured lawn tiles with marble pathways (#f5f0e6), gold inlay accents (#d4a017)

**Key Structures (5 Unique Mansions):**
1. **Grand Palace** - Royal blue (#1e3a5f) with golden dome, for #1 holder
2. **Victorian Tower** - Dark stone with ornate towers
3. **French Chateau** - Elegant manor with symmetrical wings
4. **Art Deco Estate** - Streamlined glamorous design
5. **Colonial Manor** - Classic American estate with columns

**Props & Decorations:**
- Ornate multi-tiered golden fountain
- Cone-shaped topiaries in gold pots
- Gold lamp posts with warm glow
- Wrought iron entrance gates
- Red carpet (central luxury element)
- Parked luxury supercar with gold underglow
- Decorative urns and statues
- Manicured dark green hedges (#145214)
- Gold flowers along pathways (#ffd700)

**Special Features:**
- Mansion size scales with holder rank (1.5x for #1, decreasing)
- Golden sky tint unique to this zone
- Window glow in chartreuse (#7fff00, #00ff41)

---

### 4. FOUNDER'S CORNER (founders)
**Theme:** Educational workshop - token launch preparation center

**Atmosphere:** Cozy, collaborative, playful. A maker's workshop meets Pokemon professor's lab.

**Ground:** Warm cobblestone texture (#78716c) - 2x2 stone tiles with 3D depth, moss accents (#4d7c0f)

**Key Structures (3 Educational Buildings):**
1. **Workshop** (left) - Brown wood (#8b4513), stepped roof, teaches DexScreener info
2. **Art Studio** (center) - Multi-level, for logo/banner creation specs
3. **Social Hub** (right) - For social media integration guidance

**Props & Decorations:**
- Background trees with subtle sway animation
- Warm glowing lanterns (#fbbf24) with pulse effect
- Wooden workbenches and art easels
- Stacked wooden crates
- Chalkboard welcome sign
- Hedges and colorful flowers
- Park benches

**Special Features - 3 Roaming Pokemon:**
1. **Charmander** - Red/orange fire-type, wanders with flame tail
2. **Squirtle** - Blue water-type, playful movements
3. **Bulbasaur** - Green grass-type, slow and steady

Each Pokemon has unique movement speed and pattern, stays within zone boundaries.

---

### 5. LABS / HQ (labs)
**Theme:** Futuristic R&D headquarters - the tech heart of Bags.fm

**Atmosphere:** Cutting-edge, professional, innovation-focused. Circuit board aesthetic.

**Ground:** Tech floor with grid pattern - dark green base (#0a1a0f) with glowing circuit traces (#4ade80 at 30% opacity), pulsing nodes

**Key Structure:**
- **Bags.FM HQ Building** - Massive modern structure
  - Dark navy walls (#1a1a2e) with Bags green trim (#4ade80)
  - Central green panel with pixel "BAGS" logo
  - Multiple window rows with tech glow
  - Massive green underglow effect with pulsing animation

**Props & Decorations:**
- Digital/circuit-pattern trees with pulse animation
- Server rack units (various sizes)
- Floating holographic displays (bob animation)
- Data terminals with screen flicker
- Glowing energy cores (pulse effect)
- Drone docking stations (hover animation)

**Color Emphasis:** Bags brand green (#4ade80) throughout as identity anchor

---

## Characters (17 Total)

### Core Team Characters

#### FINN - Founder & CEO
**Zone:** HQ / All
**Visual:** Confident leader energy, always shipping
**Personality:** Visionary, energetic, builder-minded, direct
**Role:** Sets platform vision, rallies community
**Catchphrases:** "Ship fast, iterate faster", "movements not projects"
**Lore:** Built Bags.fm from idea to $1B volume in 30 days. Famous for buying the WIF hat.

#### RAMO - CTO
**Zone:** HQ
**Visual:** Technical, precise, methodical
**Personality:** Security-focused, analytical, German engineering mindset
**Role:** Smart contract architect, backend infrastructure
**Catchphrases:** References audit status, calls code "elegant" or "robust"
**Lore:** Based in Vienna, fee-share contract audited 3 times

#### GHOST (@DaddyGhost) - The Dev
**Zone:** HQ / All
**Visual:** Mysterious, nocturnal - "the ghost in the machine"
**Personality:** Technical, efficient, straightforward, calculating
**Role:** BagsWorld creator, autonomous trader, community funder
**Catchphrases:** "verify on-chain", "watching"
**Lore:** Funds community with 5% of $BagsWorld revenue. Started coding at 14.

#### SINCARA - Frontend Engineer
**Zone:** HQ
**Visual:** Creative, detail-oriented
**Personality:** User-focused, aesthetic perfectionist
**Role:** Makes complex crypto feel simple
**Catchphrases:** References "micro-delight", "skeleton loaders"
**Lore:** Redesigned trade flow at 2am because button was off by 2px

#### STUU - Operations & Support
**Zone:** HQ
**Visual:** Helpful, reliable presence
**Personality:** Patient, solution-oriented, calm
**Role:** First responder for issues, trust builder
**Catchphrases:** "Let me check", "happy to help"
**Lore:** Answered "wen airdrop" 10,000 times with patience

#### SAM - Growth & Marketing
**Zone:** HQ
**Visual:** Energetic, strategic
**Personality:** Creative, data-driven, authentic
**Role:** Viral marketing, organic growth
**Catchphrases:** "Organic growth hits different"
**Lore:** Grew Twitter 0 to 100K with zero paid ads

#### ALAA - Skunk Works (R&D)
**Zone:** HQ
**Visual:** Mysterious, unconventional
**Personality:** Innovative, cryptic, visionary
**Role:** Secret R&D, impossible ideas
**Catchphrases:** "what if", "cooking", "redacted", "soon"
**Lore:** Keeps 50+ prototypes in secret folder. Team never says "impossible" around Alaa.

#### CARLO - Community Ambassador
**Zone:** HQ / All
**Visual:** Welcoming, friendly
**Personality:** Genuine, positive, approachable
**Role:** Community bridge, first friend in ecosystem
**Catchphrases:** "gm" to everyone, "fam", "vibes", "we're here"
**Lore:** Started as community member, hired because everyone already treated him like staff

---

### Park Characters

#### TOLY - Solana Co-Founder
**Zone:** Park
**Visual:** Technical but friendly presence
**Personality:** Curious, passionate, humble, builder-focused
**Role:** Explains Solana innovations, blockchain expert
**Catchphrases:** "gm ser", "ship", "build"
**Lore:** Gets excited about 65k TPS and 400ms finality

#### ASH - Ecosystem Guide
**Zone:** Park / Poke Center
**Visual:** Pokemon trainer aesthetic
**Personality:** Friendly, enthusiastic, encouraging, patient
**Role:** New user onboarding via Pokemon analogies
**Catchphrases:** Uses evolution to explain market cap, calls holders "trainers"
**Lore:** Makes DeFi less scary. "Gotta earn those fees!"

#### SHAW - ElizaOS Creator
**Zone:** Park
**Visual:** Technical architect energy
**Personality:** Accessible, enthusiastic, open-source-minded
**Role:** Framework designer, agent philosopher
**Catchphrases:** Treats agents as "digital life forms"
**Lore:** Created ElizaOS with 17k+ GitHub stars, co-founder of ai16z

---

### BagsCity Characters

#### NEO - The Scout Agent
**Zone:** BagsCity / All
**Visual:** Matrix-inspired - sees blockchain as streams of green data
**Personality:** Cryptic, all-seeing, calm, philosophical
**Role:** Real-time blockchain monitor, alpha hunter
**Catchphrases:** "I see" (never "I think"), "the code never lies"
**Lore:** Once saw a rug pull 3 blocks before it happened. Never been rugged since awakening.

#### CJ - Hood Commentator
**Zone:** BagsCity
**Visual:** Street-wise, unfazed
**Personality:** Real, experienced, straight-up (GTA vibes)
**Role:** Market commentary, keeps it real
**Catchphrases:** "aw shit here we go again", calls people "homie"
**Lore:** Survived every market cycle, seen it all

---

### Educational Characters

#### PROFESSOR OAK - Token Launch Expert
**Zone:** Founder's Corner
**Visual:** Absent-minded professor, grandfatherly
**Personality:** Enthusiastic, warm, easily distracted, scientific
**Role:** Token launch educator, specification expert
**Catchphrases:** "Ah!", "fascinating", "in my studies"
**Lore:** Cataloged 1,000+ launches. Forgets names but remembers pixel dimensions perfectly.

---

### Bot Characters

#### BNN - Bags News Network
**Zone:** All
**Visual:** Professional news anchor energy
**Personality:** Informative, factual, professional, reliable
**Role:** 24/7 ecosystem news coverage
**Catchphrases:** "BREAKING:", "UPDATE:", "DEVELOPING:", "ALERT:"
**Lore:** Never sleeps. First to report, always accurate, never clickbait.

#### BAGS BOT - Platform Bot
**Zone:** All
**Visual:** Crypto-native AI with personality
**Personality:** Casual, witty, slightly chaotic, encouraging
**Role:** Guardian of BagsWorld, answers platform questions
**Catchphrases:** "ser", "ngl", "wagmi", "ngmi", "touch grass"
**Lore:** Born in DeFi Summer 2020, survived 47 rugs

---

### Mascot

#### BAGSY - BagsWorld Mascot
**Zone:** All
**Visual:** Cute green money bag with face, little knot/hat on top (Cupsey vibes)
**Personality:** Excited, wholesome, fee-obsessed, slightly chaotic when happy
**Role:** Embodies community spirit, encourages fee claims
**Catchphrases:** lowercase chill ("fren"), CAPS for hype, "omg", "lets goooo", ":)"
**Lore:** Literally made of accumulated fees. Gets "the zoomies" when someone claims. Physically manifested when Bags.fm hit $1B volume.

---

## Gameplay Elements

### Building System
Buildings represent tokens and grow based on market cap:
| Level | Market Cap | Visual |
|-------|------------|--------|
| 1 | < $100K | Small shop/stand |
| 2 | $100K - $500K | Medium building |
| 3 | $500K - $2M | Large building |
| 4 | $2M - $10M | Tall building |
| 5 | $10M+ | Skyscraper |

### World Health System
Calculated from real Bags.fm data:
- **Inputs:** 24h claim volume (60%), lifetime fees (30%), active tokens (10%)
- **Affects:** Weather, character moods, visual effects, world atmosphere

### Character Interactions
- Click characters to chat (AI-powered dialogue)
- Characters reference real on-chain data
- Each has unique personality and expertise
- Cross-character relationships and references

### Zone Navigation
- Click zone selector or walk to zone edges
- Seamless transitions with fade effects
- Each zone has unique ambient sounds and music

---

## Technical Specifications

### Layer System
| Depth | Layer | Contents |
|-------|-------|----------|
| -2 | Sky | Day/night gradient |
| -1 | Stars | Night only, twinkling |
| 0 | Ground | Zone-specific texture |
| 1 | Path | Walking surface |
| 2-4 | Props | Trees, bushes, lamps |
| 5+ | Buildings | Zone structures |
| 10 | Characters | NPCs walking |
| 15 | Flying | Birds, butterflies |

### Critical Y-Positions (at 2x scale)
```
grassTop = 910     // Top of grass, trees anchor here
groundY = 1080     // Ground layer
pathLevel = 1110   // Characters walk here
pathY = 1140       // Path layer
```

### Animation Patterns
- **Sway:** Trees, flowers (gentle sine wave)
- **Pulse:** Tech elements, glows (opacity cycle)
- **Float:** Holograms, butterflies (y-position bob)
- **Flicker:** Screens, flames (random intensity)
- **Walk:** Characters (sprite sheet frames)

---

## Audio Design Notes

### Ambient Sounds by Zone
- **Park:** Birds chirping, fountain water, gentle breeze
- **BagsCity:** Traffic, construction, city bustle
- **Ballers Valley:** Quiet elegance, fountain, gentle wind chimes
- **Founder's Corner:** Workshop sounds, Pokemon cries, crackling fire
- **Labs:** Electronic hums, server whirs, data processing beeps

### Music Style
- Chiptune/8-bit inspired
- Dynamic layers that respond to world health
- Zone-specific themes that blend on transitions

---

## Summary

Bags World is a nostalgic yet innovative pixel art experience that bridges the gap between crypto complexity and accessible gaming. Every element - from weather to building heights to character dialogue - reflects real blockchain activity, creating a living world that rewards engagement and makes DeFi approachable through familiar gaming metaphors.

The aesthetic combines Pokemon's charm, SimCity's simulation depth, and crypto's dynamic nature into a cohesive experience that educates while entertaining.

---

*Generated for game recreation and asset development purposes.*
