import { WizardScreen, WizardState } from "./types";

export const DIALOGUE = {
  welcome: [
    "Hello there! Welcome to the world of BAGS!",
    "My name is PROFESSOR OAK. People call me the Token Prof!",
    "This world is built on TOKENS — every token becomes a BUILDING that grows with its community!",
    "The more people trade, the taller your building rises. Top tokens become skyscrapers!",
    "But first, tell me a little about yourself...",
  ],
  rival_intro: [
    "Before we go further, meet BAGSY!",
    "Bagsy is here to explain how you EARN from your token.",
    "You earn 1% from every trade of your token — forever! That's your royalties.",
    "You choose who gets to claim those earnings. Keep 100%, or split with collaborators!",
    "Each claimer verifies their social account on Bags and links a wallet to claim.",
    "One more thing — fee shares are PERMANENT. Once you launch, they're locked forever!",
  ],
  token_concept: [
    "Now, it's time to create your first TOKEN!",
    "Tell me about your idea, and I'll help you bring it to life!",
  ],
  education_fees: [
    "You earn 1% royalties from every trade of your TOKEN — the more it trades, the more you earn!",
    "To claim, verify your social account on Bags and tap the claim button. Earnings go straight to your wallet!",
    "Gotta claim 'em all!",
  ],
  education_world: [
    "Your TOKEN will appear as a BUILDING in BagsWorld!",
    "Level 1 starts as a small shop. Level 5? A full skyscraper towering over the city!",
    "Now, let's get you equipped for your adventure...",
  ],
  launching: [
    "Registering your token...",
    "Setting up fee sharing...",
    "Your BUILDING is going live!",
  ],
  sendoff: [
    "Congratulations! Your TOKEN is live on-chain!",
    "Your building is now rising in BagsWorld...",
    "A whole new world of BAGS awaits! Let's go!",
  ],
} as const;

export const ART_STYLES = [
  {
    id: "pixel-art" as const,
    label: "Pixel Art",
    emoji: "\uD83C\uDFAE",
    description: "16-bit retro aesthetic",
  },
  {
    id: "cartoon" as const,
    label: "Cartoon",
    emoji: "\uD83C\uDFA8",
    description: "Bold, playful mascot",
  },
  {
    id: "cute" as const,
    label: "Kawaii",
    emoji: "\uD83C\uDF38",
    description: "Cute chibi style",
  },
  {
    id: "minimalist" as const,
    label: "Minimalist",
    emoji: "\u25FB\uFE0F",
    description: "Clean, modern shapes",
  },
  {
    id: "abstract" as const,
    label: "Abstract",
    emoji: "\uD83D\uDD2E",
    description: "Geometric art",
  },
];

export const SCREEN_ORDER: WizardScreen[] = [
  "title",
  "professor_entry",
  "welcome_dialogue",
  "creator_name",
  "rival_intro",
  "rival_name",
  "token_concept",
  "token_style",
  "token_names",
  "token_image",
  "education_fees",
  "education_world",
  "wallet_connect",
  "launch_review",
  "launching",
  "sendoff",
];

export const INITIAL_STATE: WizardState = {
  currentScreen: "title",
  creatorName: "",
  feeShares: [],
  tokenConcept: "",
  tokenStyle: "",
  tokenName: "",
  tokenSymbol: "",
  tokenDescription: "",
  tokenImageUrl: null,
  tokenBannerUrl: null,
  suggestedNames: [],
  isGenerating: false,
  initialBuySOL: "",
  launchPhase: 0,
  launchStatus: "",
  launchError: null,
  tokenMint: null,
};
