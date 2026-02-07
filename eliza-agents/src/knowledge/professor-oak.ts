// Professor Oak - Token Launch Wizard knowledge
// Token creation process, name generation, logo/banner design, art styles, launch wizard flow

export const professorOakKnowledge: string[] = [
  // === Token Creation Process ===
  "Launching a token on Bags.fm involves six steps: 1) Choose a name and ticker, 2) Write a description, 3) Set fee sharing percentages, 4) Upload a logo and banner, 5) Configure initial buy amount, 6) Sign the launch transaction.",
  "Token names should be 3-32 characters, memorable, and easy to spell. The best names tell a story or evoke an emotion. Think of how Pikachu is instantly recognizable - your token name should have that same instant impact.",
  "Ticker symbols (like $BTC or $SOL) should be 2-10 characters, all uppercase, and unique enough to avoid confusion with existing tokens. Check that your desired ticker is not already in use before committing.",
  "Token descriptions appear on the Bags.fm page and DexScreener listing. Keep them under 280 characters, clearly communicate the token's purpose or meme, and include keywords that help with discoverability.",

  // === Fee Sharing Configuration ===
  "Fee sharing determines who earns from trading volume. Creators add social usernames (Twitter, GitHub, or Kick) and assign percentages. The total must equal exactly 100%. Each recipient must link their wallet at bags.fm/settings.",
  "Fee shares are locked at launch and cannot be changed afterward. This immutability protects fee recipients from having their share reduced. Advise creators to think carefully about splits before launching.",
  "The most common fee share setup is 100% to a single creator. For collaborations, common splits are 50/50 or 60/40 between two creators. Teams of three typically use 40/30/30 or similar distributions.",

  // === AI Name Generation ===
  "The AI name generator produces 5 creative name and ticker suggestions from a concept description. It uses Claude to analyze the concept and generate names that are catchy, memeable, and aligned with the token's theme.",
  "Name generation works best with vivid concept descriptions. Instead of 'a dog token,' try 'a golden retriever who is also a Wall Street trader.' Specific, visual concepts produce more creative and unique name suggestions.",
  "Generated names go through validation: checking length limits, filtering inappropriate content, ensuring ticker uniqueness, and verifying the name captures the essence of the provided concept.",

  // === Logo and Banner Design ===
  "Token logos must be 512x512 pixels, square format. This size works across all platforms including Bags.fm, DexScreener, wallet displays, and social media embeds without quality loss.",
  "Token banners for DexScreener Enhanced listing must be 1500x500 pixels (3:1 aspect ratio). Previously the standard was 600x200, but the current DexScreener requirement is 1500x500 for optimal display.",
  "The AI image generator supports 5 art styles: Pixel Art (16-bit retro aesthetic), Cartoon (bold, playful mascot style), Kawaii (cute chibi style), Minimalist (clean, modern shapes), and Abstract (geometric art patterns).",
  "When REPLICATE_API_TOKEN is configured, logos and banners are generated using SDXL for high-quality AI art. Without the token, the system falls back to procedural SVG pixel art which is free and instant.",

  // === Launch Wizard Flow ===
  "The launch wizard guides creators through each step sequentially, validating inputs before moving forward. This prevents common mistakes like missing fee shares, wrong image dimensions, or empty descriptions.",
  "The 'USE & LAUNCH' button pre-fills the LaunchModal with all generated assets (name, ticker, logo, banner). Creators can review and modify any element before the final launch transaction.",
  "Initial buy amount is optional but strategic. A creator buy at launch shows commitment to their own token. The amount should balance showing confidence without creating an oversized position that might concern buyers.",
  "After launch, Professor Oak celebrates the milestone and provides next-step guidance: share the token link, engage with the community, claim fees regularly, and consider a DexScreener Enhanced listing for visibility.",

  // === Creator Guidance ===
  "The number one mistake new creators make is launching without a community. The most successful tokens have an engaged group of supporters ready to participate from day one. Build community before launching.",
  "Image quality dramatically affects token perception. Blurry logos, wrong aspect ratios, or generic clip art signal low effort. Invest time in quality visuals - they are the first thing potential buyers see.",
  "Post-launch is where the real work begins. Launching is like releasing a starter Pokemon into the wild. It needs daily attention, community building, and consistent engagement to evolve into something significant.",
  "Professor Oak never gives financial advice. Guidance is limited to the technical process of launching, creative direction for branding, and best practices for community building. Investment decisions are always the creator's own.",
];
