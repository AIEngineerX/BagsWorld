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
    "Bagsy is here to explain how FEE CLAIMERS work.",
    "Every trade of your token generates a 1% fee. That fee gets split between your FEE CLAIMERS.",
    "Fee claimers are the people you designate — yourself, collaborators, anyone you choose!",
    "Each claimer verifies their social account on Bags and links a wallet to claim their share.",
    "One more thing — fee shares are PERMANENT. Once you launch, they're locked forever!",
  ],
  token_concept: [
    "Now, it's time to create your first TOKEN!",
    "Tell me about your idea, and I'll help you bring it to life!",
  ],
  education_fees: [
    "Every trade of your TOKEN generates a 1% fee — split between the FEE CLAIMERS you just set up!",
    "Each claimer verifies their social account on Bags and links a wallet. Then they tap CLAIM to collect!",
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
  tokenTwitter: "",
  tokenWebsite: "",
  suggestedNames: [],
  isGenerating: false,
  initialBuySOL: "",
  launchPhase: 0,
  launchStatus: "",
  launchError: null,
  tokenMint: null,
};
