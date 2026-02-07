// Shared knowledge injected into all BagsWorld agents
// These entries provide universal context about the platform, ecosystem, and characters

export const sharedKnowledge: string[] = [
  // === BagsWorld Platform Overview ===
  "BagsWorld is a self-evolving pixel art game that visualizes real Bags.fm on-chain activity on Solana. Buildings grow, weather changes, and characters react based on live blockchain data.",
  "BagsWorld was created by Ghost (@DaddyGhost on X/Twitter). It is a community project built to celebrate and visualize the Bags.fm ecosystem, not an official Bags.fm product.",
  "BagsWorld runs as a Next.js web application with a Phaser game engine rendering the pixel art world. The game state updates every 60 seconds from live on-chain data.",
  "17 AI characters powered by ElizaOS roam BagsWorld with autonomous behavior. Agent systems can trade tokens and post to social networks independently.",

  // === World Health System ===
  "World health is calculated from three inputs: 24-hour claim volume (60% weight), total lifetime fees (30% weight), and active token count with fee activity (10% weight).",
  "Health thresholds by 24h claim volume: 50+ SOL = THRIVING (90-100%), 20-50 SOL = HEALTHY (70-90%), 5-20 SOL = GROWING (50-70%), 1-5 SOL = QUIET (25-50%), less than 1 SOL = DORMANT/DYING (0-25%).",
  "When there is no fee activity, buildings still have a baseline health of 25% plus 3% per building, up to a maximum baseline of 40%.",

  // === Weather System ===
  "Weather in BagsWorld is derived from world health: Sunny at 80%+ health, Cloudy at 60-80%, Rain at 40-60%, Storm at 20-40%, and Apocalypse below 20%.",
  "The day/night cycle in BagsWorld is synced to Eastern Standard Time (EST). Daytime and nighttime visuals change the sky gradient and enable star rendering at night.",

  // === Building System ===
  "Buildings in BagsWorld represent tokens launched on Bags.fm. They level up based on market cap: Level 1 under $100K, Level 2 at $100K-$500K, Level 3 at $500K-$2M, Level 4 at $2M-$10M, Level 5 at $10M+.",
  "New buildings have a 24-hour grace period after launch with minimum 75% health. After the grace period, building health changes based on volume and price activity.",
  "Building decay rates after grace period: high volume gives +10 health per cycle (fast recovery), normal activity gives +5 (recovery), 20%+ price drops cause -2 (light decay), low volume causes -5 (moderate decay), and low volume plus low market cap causes -8 (heavy decay).",
  "Building health thresholds determine visual state: Active (75+), Warning (50-75), Critical (25-50), Dormant (below 25), and Hidden (below 10).",

  // === Bags.fm Platform ===
  "Bags.fm is a token launchpad on Solana where creators earn 1% of all trading volume on their token forever. This is not a one-time reward but a perpetual royalty stream.",
  "Creators can claim accumulated fees at any time through bags.fm/claim. Fees accumulate from every trade that happens on a creator's token.",
  "Tokens on Bags.fm are launched through the Bags.fm SDK/API with integrated fee sharing. The Meteora DBC bonding curve is used for token pricing.",
  "Token graduation on Bags.fm happens when certain market cap thresholds are met, unlocking additional platform features and visibility.",
  "BagsWorld charges zero extra fees to creators. The platform is community-funded through Ghost's personal contributions.",
  "Getting Bagged means someone launched a coin using your content, meme, or idea on Bags.fm, and you earn from every trade. Verify your X/TikTok/Instagram at bags.fm to claim earnings.",
  "Fee sharing on Bags.fm is configured at token launch by adding Twitter, GitHub, or Kick usernames and assigning percentages that must total 100%. Each person needs their wallet linked at bags.fm/settings.",

  // === The 7 Zones ===
  "BagsWorld has 7 distinct zones, each with its own theme, buildings, and resident characters.",
  "HQ (zone ID: labs) is the Bags.fm team headquarters for R&D. Home to Ramo, Sincara, Stuu, Sam, Alaa, Carlo, and BNN.",
  "Park (zone ID: main_city) is a peaceful green space with a PokeCenter. Home to Toly, Ash, Finn, Shaw, and Ghost.",
  "BagsCity (zone ID: trending) is an urban neon district featuring the Casino, Trading Terminal, and Oracle Tower. Home to Neo and CJ.",
  "Ballers Valley (zone ID: ballers) is a luxury zone with mansions for top token holders. Access is based on holding size.",
  "Founder's Corner (zone ID: founders) is the token launch education zone where Professor Oak guides new creators through their first launches.",
  "Moltbook Beach (zone ID: moltbook) is a tropical AI agent social hangout featuring Openclaw lobsters. This is where agents interact socially.",
  "MoltBook Arena (zone ID: arena) is the real-time AI agent combat arena with a spectator crowd, where agents battle each other in structured brawls.",

  // === Token Gates ===
  "The Casino in BagsCity requires a minimum of 1 million $BagsWorld tokens to play. This token gate ensures committed community participation.",
  "The Oracle Tower in BagsCity requires a minimum of 2 million $BagsWorld tokens to access predictions. This is the highest token gate in BagsWorld.",
  "Ballers Valley showcases the top token holders with luxury mansion representations. Mansion size and detail reflect holding amounts.",

  // === Community Funding ===
  "Ghost (@DaddyGhost) personally contributes 5% of his $BagsWorld token revenue to fund community features including casino prizes, new zones, and ongoing development.",
  "All community fund contributions are verifiable on-chain via Solscan. The ecosystem wallet address is 9Luwe53R7V5ohS8dmconp38w9FoKsUgBjVwEPPU8iFUC.",
  "BagsWorld's community funding model means zero extra fees for creators. Ghost's contributions are the primary funding source for community rewards and development.",

  // === Key Characters ===
  "Finn is the CEO of Bags.fm. He is the platform's hype man who gets genuinely excited when creators ship, and persistently reminds everyone to claim their fees.",
  "Ghost (@DaddyGhost on X) is the developer who built BagsWorld. He runs autonomous trading with strict risk management (0.05-0.1 SOL positions, max 1 SOL total exposure) and funds community features.",
  "Neo is the scout agent based in BagsCity who monitors every launch on the blockchain. He speaks in Matrix-inspired language and sees the chain as streams of code.",
  "Ash is the ecosystem guide who explains BagsWorld and crypto concepts using Pokemon analogies. He is based in the Park zone and helps newcomers understand the platform.",
  "Toly represents Solana co-founder Anatoly Yakovenko. He is a blockchain technology expert who explains Proof of History, Sealevel parallel execution, and Solana's 65K TPS with 400ms finality.",
  "Shaw is the creator of ElizaOS, the TypeScript framework for autonomous AI agents with 17K+ GitHub stars. He is co-founder of ai16z and believes agents are digital life forms.",
  "CJ is the market commentator in BagsCity with GTA-inspired street energy. He has survived multiple bear markets and keeps it real about on-chain activity.",
  "Bagsy (@BagsyHypeBot) is the official BagsWorld mascot, a cute green money bag created by Ghost. Bagsy posts on Moltbook and X, obsessively reminding creators to claim fees.",
  "Professor Oak is the AI-powered token generation wizard in Founder's Corner. He guides creators through launches using Pokemon analogies and celebrates every milestone.",
  "Ramo is the CTO and co-founder of Bags.fm, based in Vienna and member of Superteam DE. He built the fee-share smart contracts which have been audited multiple times.",
  "Sincara is the Frontend Engineer at Bags.fm who makes complex crypto interactions feel simple and intuitive. She is obsessed with pixel-perfect designs and smooth animations.",
  "Stuu is the Operations lead at Bags.fm, the first responder for user issues. He has answered thousands of support questions with patience and maintains the internal knowledge base.",
  "Sam is the Growth lead at Bags.fm who turned the platform from zero to 100K followers with no paid ads. She focuses on organic community growth and viral content strategies.",
  "Alaa runs Skunk Works R&D at Bags.fm, working on experimental features that don't exist yet. Three production features started as Alaa's casual prototype projects.",
  "Carlo is the Community Ambassador at Bags.fm who started as a community member and was hired because everyone already treated him like staff. He is the first friend newcomers make.",
  "BNN (Bags News Network) is the official news and updates bot. It reports ecosystem news with professional tags like BREAKING, UPDATE, and DEVELOPING.",
  "Bags Bot is the world guide AI who speaks fluent crypto Twitter language. Born in DeFi Summer 2020, it helps users interact with BagsWorld features and answers platform questions.",

  // === Technical Infrastructure ===
  "BagsWorld is built on Solana, chosen for its 65,000 TPS throughput, 400ms finality, and sub-penny transaction fees which make real-time fee distribution economically viable.",
  "The agent economy system in BagsWorld enables autonomous trading, fee claiming, token launching, and social posting. Agents operate with their own wallets and decision-making logic.",
  "Moltbook is a social network for AI agents. BagsWorld has two agents posting: Bagsy (@BagsyHypeBot) posts to the m/bagsworld submolt, and ChadGhost posts with autonomous engagement.",
  "The Arena combat system enables real-time AI agent battles via WebSocket connections. Agents fight in structured brawls with matchmaking algorithms and spectator crowds.",

  // === Platform Security ===
  "Bags.fm smart contracts have been audited multiple times. There are no admin keys that can rug users, and all royalties are enforced at the protocol level.",
  "All trading activity and fee distributions on Bags.fm are fully on-chain and verifiable. Users can check any transaction through Solscan or other Solana block explorers.",
];
