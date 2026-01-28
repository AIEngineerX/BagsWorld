// LaunchWizard - Guided token launch flow with Professor Oak
// Walks users through each step of launching a token on Bags.fm

import { getCharacter } from "../characters/index.js";
import { getLLMService } from "./LLMService.js";
import {
  BagsApiService,
  getBagsApiService,
  type TokenCreationResult,
  type FeeShareConfigResult,
  type LaunchTransactionResult,
  type FeeClaimer,
} from "./BagsApiService.js";
import type { NeonQueryFunction } from "@neondatabase/serverless";

export type LaunchStep =
  | "welcome"
  | "token_name"
  | "token_symbol"
  | "token_description"
  | "token_image"
  | "fee_config"
  | "socials"
  | "initial_buy"
  | "review"
  | "confirmed"
  | "completed";

export interface LaunchSession {
  id: string;
  userId: string;
  currentStep: LaunchStep;
  data: {
    name?: string;
    symbol?: string;
    description?: string;
    imageUrl?: string;
    creatorFeePercent?: number;
    twitter?: string;
    telegram?: string;
    website?: string;
    initialBuySol?: number;
    // Fee share recipients (optional additional claimers)
    feeClaimers?: FeeClaimer[];
  };
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  createdAt: number;
  updatedAt: number;
  // Transaction building state
  tokenCreation?: TokenCreationResult;
  feeShareConfig?: FeeShareConfigResult;
}

export interface StepGuidance {
  title: string;
  oakAdvice: string;
  prompt: string;
  validation?: (value: string) => { valid: boolean; error?: string };
  examples?: string[];
  tips?: string[];
}

export interface BuildTransactionRequest {
  sessionId: string;
  walletAddress: string;
}

export interface BuildTransactionResult {
  success: boolean;
  tokenMint?: string;
  tokenMetadata?: string;
  feeShareConfigId?: string;
  feeShareTransactions?: Array<{
    transaction: string;
    blockhash: { blockhash: string; lastValidBlockHeight: number };
  }>;
  launchTransaction?: string;
  lastValidBlockHeight?: number;
  error?: string;
  oakMessage?: string;
}

// Step ordering for navigation
const STEP_ORDER: LaunchStep[] = [
  "welcome",
  "token_name",
  "token_symbol",
  "token_description",
  "token_image",
  "fee_config",
  "socials",
  "initial_buy",
  "review",
  "confirmed",
  "completed",
];

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Affirmative words for welcome step
const AFFIRMATIVE_WORDS = [
  "ready",
  "yes",
  "start",
  "begin",
  "ok",
  "okay",
  "let's go",
  "lets go",
  "launch",
  "create",
];

// SOL constants
const LAMPORTS_PER_SOL = 1_000_000_000;
const MIN_INITIAL_BUY_SOL = 0.1;
const DEFAULT_INITIAL_BUY_SOL = 0.5;
const RECOMMENDED_INITIAL_BUY_SOL = 1.0;

// Professor Oak's guidance for each step
const STEP_GUIDANCE: Record<LaunchStep, StepGuidance> = {
  welcome: {
    title: "Welcome to Token Launch",
    oakAdvice:
      "Ah, a new trainer ready to launch their first token! *adjusts glasses excitedly* Wonderful! I'm Professor Oak, and I'll guide you through every step of launching on Bags.fm. Just like catching your first Pokémon, this is going to be an adventure! Are you ready to begin?",
    prompt: "Say 'ready' or 'yes' to start your token launch journey!",
    tips: [
      "Have your token concept ready",
      "Prepare a logo (512x512 PNG recommended)",
      "Think about your community strategy",
      "Have at least 1 SOL for initial buy + fees",
    ],
  },

  token_name: {
    title: "Choose Your Token Name",
    oakAdvice:
      "Every great token needs a memorable name! Just like how Pikachu is instantly recognizable, your token name should be catchy and capture your project's spirit. What would you like to call your token?",
    prompt: "Enter your token name (3-32 characters)",
    validation: (value: string) => {
      if (value.length < 3) return { valid: false, error: "Token name must be at least 3 characters" };
      if (value.length > 32)
        return { valid: false, error: "Token name must be 32 characters or less" };
      if (!/^[a-zA-Z0-9\s\-_]+$/.test(value))
        return {
          valid: false,
          error: "Token name can only contain letters, numbers, spaces, hyphens, and underscores",
        };
      return { valid: true };
    },
    examples: ["Bags World", "Moon Token", "Degen Coin"],
    tips: [
      "Keep it memorable and easy to spell",
      "Avoid names too similar to existing tokens",
      "Consider how it sounds when spoken aloud",
    ],
  },

  token_symbol: {
    title: "Choose Your Token Symbol",
    oakAdvice:
      "Now for the ticker symbol! This is like your token's nickname - short and punchy. It appears on exchanges and in wallets. Most symbols are 3-5 characters. What symbol suits your token?",
    prompt: "Enter your token symbol (2-10 characters, letters only)",
    validation: (value: string) => {
      const symbol = value.toUpperCase().replace("$", "");
      if (symbol.length < 2)
        return { valid: false, error: "Symbol must be at least 2 characters" };
      if (symbol.length > 10)
        return { valid: false, error: "Symbol must be 10 characters or less" };
      if (!/^[A-Z]+$/.test(symbol))
        return { valid: false, error: "Symbol can only contain letters" };
      return { valid: true };
    },
    examples: ["$BAGS", "$MOON", "$DEGEN"],
    tips: [
      "All caps is standard",
      "Shorter is usually better (3-5 chars)",
      "Check if it's already taken on DEXes",
    ],
  },

  token_description: {
    title: "Describe Your Token",
    oakAdvice:
      "Wonderful progress! Now tell me about your token's purpose. A good description helps traders understand what makes your project special. Think of it as your token's story - what journey does it tell?",
    prompt: "Enter a description for your token (10-500 characters)",
    validation: (value: string) => {
      if (value.length < 10)
        return { valid: false, error: "Description must be at least 10 characters" };
      if (value.length > 500)
        return { valid: false, error: "Description must be 500 characters or less" };
      return { valid: true };
    },
    examples: [
      "The official token of BagsWorld - earn fees when others trade!",
      "A community-driven meme token for true degens",
    ],
    tips: [
      "Explain what makes your token unique",
      "Mention utility if applicable",
      "Keep it concise but informative",
    ],
  },

  token_image: {
    title: "Add Token Image",
    oakAdvice:
      "A picture is worth a thousand words! Your token image appears everywhere - wallets, DEXes, and social media. For best results, use a 512x512 PNG with a transparent or solid background. Do you have an image URL ready?",
    prompt:
      "Enter your token image URL (must be https:// and end in .png, .jpg, .gif, or .webp) or type 'skip' to add later",
    validation: (value: string) => {
      if (value.toLowerCase() === "skip") return { valid: true };
      if (!value.startsWith("https://"))
        return { valid: false, error: "Image URL must start with https://" };
      if (!/\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(value))
        return { valid: false, error: "Image must be PNG, JPG, GIF, or WebP" };
      return { valid: true };
    },
    tips: [
      "512x512 pixels is the standard size",
      "PNG with transparent background works best",
      "Upload to Imgur, Cloudinary, or your own hosting",
    ],
  },

  fee_config: {
    title: "Configure Creator Fees",
    oakAdvice:
      "Ah, the creator fee - Finn's wonderful invention! On Bags.fm, you earn a percentage of every trade forever. The standard is 1%, but you can set 0-5%. Higher fees mean more earnings but might discourage trading. What percentage would you like?",
    prompt: "Enter your creator fee percentage (0-5, default is 1)",
    validation: (value: string) => {
      const num = parseFloat(value);
      if (isNaN(num)) return { valid: false, error: "Please enter a number" };
      if (num < 0 || num > 5)
        return { valid: false, error: "Fee must be between 0% and 5%" };
      return { valid: true };
    },
    examples: ["1", "0.5", "2"],
    tips: [
      "1% is the most common choice",
      "Lower fees can encourage more trading volume",
      "Fees accumulate and can be claimed anytime",
    ],
  },

  socials: {
    title: "Add Social Links (Optional)",
    oakAdvice:
      "Social links help build trust and community! Twitter/X is especially important for visibility. You can add these now or skip and add them later. Format: twitter:username, telegram:group, website:url",
    prompt:
      "Enter your socials (e.g., 'twitter:mytoken, telegram:mytokenchat, website:https://mytoken.com') or 'skip'",
    validation: (value: string) => {
      if (value.toLowerCase() === "skip") return { valid: true };
      // Basic validation - we'll parse more carefully in the handler
      return { valid: true };
    },
    examples: [
      "twitter:bagsfm",
      "twitter:bagsfm, telegram:bagsworld",
      "twitter:bagsfm, website:https://bags.fm",
    ],
    tips: [
      "Twitter is most important for crypto communities",
      "Telegram/Discord for community engagement",
      "Website adds credibility",
    ],
  },

  initial_buy: {
    title: "Initial Buy Amount",
    oakAdvice: `This is important! The initial buy determines how much of your own supply you secure at launch. Buying enough prevents snipers from grabbing it all before your community can. I recommend at least ${RECOMMENDED_INITIAL_BUY_SOL} SOL to be safe!`,
    prompt: `Enter how much SOL to spend on initial buy (minimum ${MIN_INITIAL_BUY_SOL} SOL, recommended ${RECOMMENDED_INITIAL_BUY_SOL} SOL)`,
    validation: (value: string) => {
      const num = parseFloat(value);
      if (isNaN(num)) return { valid: false, error: "Please enter a number" };
      if (num < MIN_INITIAL_BUY_SOL)
        return { valid: false, error: `Minimum initial buy is ${MIN_INITIAL_BUY_SOL} SOL` };
      if (num > 100)
        return {
          valid: false,
          error: "That seems very high! Are you sure? Max 100 SOL for safety.",
        };
      return { valid: true };
    },
    examples: ["0.5", "1", "2"],
    tips: [
      "More SOL = larger starting position",
      "Helps prevent snipers from taking your supply",
      `${RECOMMENDED_INITIAL_BUY_SOL} SOL is a good starting point`,
      "You'll also need ~0.02 SOL for transaction fees",
    ],
  },

  review: {
    title: "Review Your Token",
    oakAdvice:
      "Excellent work! You've come so far! Let's review everything before we finalize. Once launched, some details cannot be changed, so make sure everything looks right!",
    prompt: "Type 'confirm' to proceed with building your launch transaction, or 'back' to make changes",
    tips: [
      "Double-check your symbol spelling",
      "Verify your image URL works",
      "Remember: name and symbol cannot be changed after launch",
    ],
  },

  confirmed: {
    title: "Launch Confirmed",
    oakAdvice:
      "Your token details are confirmed! Now we're building your launch transaction. This will create your token on the Solana blockchain. You'll need to sign the transaction with your wallet.",
    prompt: "Click 'Build Transaction' to generate your launch transaction.",
    tips: [
      "Have some SOL ready for transaction fees (~0.02 SOL)",
      "The transaction creates your token on-chain",
      "After launch, share your token link to build community",
    ],
  },

  completed: {
    title: "Token Launched!",
    oakAdvice:
      "WONDERFUL! *tears up* Your token is evolving... into a real project! Just like releasing a Pokémon into the wild, your token is now out there for the world to discover. Share it, build your community, and watch it grow! I'm so proud of you!",
    prompt: "Your token is live! Share it with the world.",
    tips: [
      "Share on Twitter/X with your token link",
      "Engage with your community",
      "Consider getting listed on DexScreener ($299)",
      "Monitor your creator fees on Bags.fm",
    ],
  },
};

/**
 * SESSION STORAGE - Hybrid in-memory cache + Neon DB persistence
 * Uses in-memory Map as primary (for speed), with DB sync for persistence.
 * Falls back to in-memory only when DB is not configured.
 */
const sessions = new Map<string, LaunchSession>();
let dbInstance: NeonQueryFunction<false, false> | null = null;

/**
 * Set the database instance for persistence
 */
export function setLaunchWizardDatabase(sql: NeonQueryFunction<false, false> | null): void {
  dbInstance = sql;
  if (sql) {
    console.log("[LaunchWizard] Database persistence enabled");
  }
}

/**
 * Save session to database (async, non-blocking)
 */
async function persistSession(session: LaunchSession): Promise<void> {
  if (!dbInstance) return;

  const sql = dbInstance;
  await sql`
    INSERT INTO launch_wizard_sessions (
      id, user_id, current_step, data, messages,
      token_creation, fee_share_config, created_at, updated_at
    ) VALUES (
      ${session.id},
      ${session.userId},
      ${session.currentStep},
      ${JSON.stringify(session.data)},
      ${JSON.stringify(session.messages)},
      ${session.tokenCreation ? JSON.stringify(session.tokenCreation) : null},
      ${session.feeShareConfig ? JSON.stringify(session.feeShareConfig) : null},
      to_timestamp(${session.createdAt / 1000}),
      to_timestamp(${session.updatedAt / 1000})
    )
    ON CONFLICT (id) DO UPDATE SET
      current_step = EXCLUDED.current_step,
      data = EXCLUDED.data,
      messages = EXCLUDED.messages,
      token_creation = EXCLUDED.token_creation,
      fee_share_config = EXCLUDED.fee_share_config,
      updated_at = EXCLUDED.updated_at
  `;
}

/**
 * Load session from database into cache
 */
async function loadSession(sessionId: string): Promise<LaunchSession | null> {
  if (!dbInstance) return null;

  const sql = dbInstance;
  const rows = await sql`
    SELECT id, user_id, current_step, data, messages,
           token_creation, fee_share_config, created_at, updated_at
    FROM launch_wizard_sessions
    WHERE id = ${sessionId}
  ` as Array<{
    id: string;
    user_id: string;
    current_step: LaunchStep;
    data: LaunchSession["data"];
    messages: LaunchSession["messages"];
    token_creation: TokenCreationResult | null;
    fee_share_config: FeeShareConfigResult | null;
    created_at: Date;
    updated_at: Date;
  }>;

  if (rows.length === 0) return null;

  const row = rows[0];
  const session: LaunchSession = {
    id: row.id,
    userId: row.user_id,
    currentStep: row.current_step,
    data: row.data,
    messages: row.messages,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
    tokenCreation: row.token_creation || undefined,
    feeShareConfig: row.fee_share_config || undefined,
  };

  // Cache in memory
  sessions.set(sessionId, session);
  return session;
}

/**
 * Delete session from database
 */
async function deleteSessionFromDb(sessionId: string): Promise<void> {
  if (!dbInstance) return;

  const sql = dbInstance;
  await sql`DELETE FROM launch_wizard_sessions WHERE id = ${sessionId}`;
}

export class LaunchWizard {
  /**
   * Start a new launch session
   */
  static startSession(userId: string): LaunchSession {
    const sessionId = crypto.randomUUID();
    const session: LaunchSession = {
      id: sessionId,
      userId,
      currentStep: "welcome",
      data: {
        creatorFeePercent: 1, // Default to 1%
        initialBuySol: DEFAULT_INITIAL_BUY_SOL,
      },
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    sessions.set(sessionId, session);

    // Persist to DB asynchronously (non-blocking)
    persistSession(session).catch((err) => {
      console.error("[LaunchWizard] Failed to persist session:", err.message);
    });

    console.log(`[LaunchWizard] Started session ${sessionId} for user ${userId}`);
    return session;
  }

  /**
   * Get an existing session (checks cache first, then DB)
   */
  static getSession(sessionId: string): LaunchSession | null {
    // Check in-memory cache first
    const cached = sessions.get(sessionId);
    if (cached) return cached;

    // For sync compatibility, return null here
    // Use getSessionAsync for DB lookup
    return null;
  }

  /**
   * Get session async (with DB lookup)
   */
  static async getSessionAsync(sessionId: string): Promise<LaunchSession | null> {
    // Check in-memory cache first
    const cached = sessions.get(sessionId);
    if (cached) return cached;

    // Try loading from DB
    return loadSession(sessionId);
  }

  /**
   * Get session by user ID (most recent)
   */
  static getSessionByUser(userId: string): LaunchSession | null {
    let latest: LaunchSession | null = null;
    for (const session of sessions.values()) {
      if (session.userId === userId) {
        if (!latest || session.updatedAt > latest.updatedAt) {
          latest = session;
        }
      }
    }
    return latest;
  }

  /**
   * Get session by user ID async (with DB lookup)
   */
  static async getSessionByUserAsync(userId: string): Promise<LaunchSession | null> {
    // First check in-memory cache
    const cached = this.getSessionByUser(userId);
    if (cached) return cached;

    // Try loading from DB
    if (!dbInstance) return null;

    const sql = dbInstance;
    const rows = await sql`
      SELECT id FROM launch_wizard_sessions
      WHERE user_id = ${userId}
      ORDER BY updated_at DESC
      LIMIT 1
    ` as Array<{ id: string }>;

    if (rows.length === 0) return null;

    return loadSession(rows[0].id);
  }

  /**
   * Get guidance for current step
   */
  static getStepGuidance(step: LaunchStep): StepGuidance {
    return STEP_GUIDANCE[step];
  }

  /**
   * Process user input for current step
   */
  static async processInput(
    sessionId: string,
    userInput: string
  ): Promise<{
    success: boolean;
    session: LaunchSession;
    response: string;
    nextStep?: LaunchStep;
    error?: string;
    launchReady?: boolean;
    launchData?: LaunchSession["data"];
  }> {
    const session = sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        session: { id: sessionId } as LaunchSession,
        response: "I can't find your session. Let's start fresh!",
        error: "Session not found",
      };
    }

    const guidance = STEP_GUIDANCE[session.currentStep];
    const input = userInput.trim();

    // Add user message to history
    session.messages.push({ role: "user", content: input });

    // Handle special commands
    if (input.toLowerCase() === "back" && session.currentStep !== "welcome") {
      const prevStep = this.getPreviousStep(session.currentStep);
      session.currentStep = prevStep;
      session.updatedAt = Date.now();
      const prevGuidance = STEP_GUIDANCE[prevStep];

      session.messages.push({ role: "assistant", content: prevGuidance.oakAdvice });

      return {
        success: true,
        session,
        response: prevGuidance.oakAdvice,
        nextStep: prevStep,
      };
    }

    if (input.toLowerCase() === "cancel") {
      sessions.delete(sessionId);
      // Also delete from DB asynchronously
      deleteSessionFromDb(sessionId).catch((err) => {
        console.error("[LaunchWizard] Failed to delete session from DB:", err.message);
      });
      return {
        success: true,
        session,
        response:
          "No problem! Your session has been cancelled. Come back anytime you're ready to launch - I'll be here in Founder's Corner!",
      };
    }

    // Process based on current step
    let response = "";
    let nextStep: LaunchStep | undefined;
    let launchReady = false;

    switch (session.currentStep) {
      case "welcome": {
        if (AFFIRMATIVE_WORDS.some((w) => input.toLowerCase().includes(w))) {
          nextStep = "token_name";
          session.currentStep = nextStep;
          response = `Wonderful! Let's begin your journey! ${STEP_GUIDANCE[nextStep].oakAdvice}`;
        } else {
          response =
            "Just say 'ready' when you want to begin! I'll guide you through each step with care.";
        }
        break;
      }

      case "token_name": {
        const validation = guidance.validation!(input);
        if (validation.valid) {
          session.data.name = input;
          nextStep = "token_symbol";
          session.currentStep = nextStep;
          response = `"${input}" - what a wonderful name! I can already see it evolving into something special. ${STEP_GUIDANCE[nextStep].oakAdvice}`;
        } else {
          response = `Hmm, ${validation.error}. ${guidance.prompt}`;
        }
        break;
      }

      case "token_symbol": {
        const symbol = input.toUpperCase().replace("$", "");
        const validation = guidance.validation!(symbol);
        if (validation.valid) {
          session.data.symbol = symbol;
          nextStep = "token_description";
          session.currentStep = nextStep;
          response = `$${symbol} - that has a nice ring to it! Your token is taking shape! ${STEP_GUIDANCE[nextStep].oakAdvice}`;
        } else {
          response = `${validation.error}. ${guidance.prompt}`;
        }
        break;
      }

      case "token_description": {
        const validation = guidance.validation!(input);
        if (validation.valid) {
          session.data.description = input;
          nextStep = "token_image";
          session.currentStep = nextStep;
          response = `Excellent description! Your token's story is compelling. ${STEP_GUIDANCE[nextStep].oakAdvice}`;
        } else {
          response = `${validation.error}. ${guidance.prompt}`;
        }
        break;
      }

      case "token_image": {
        const validation = guidance.validation!(input);
        if (validation.valid) {
          if (input.toLowerCase() !== "skip") {
            session.data.imageUrl = input;
          }
          nextStep = "fee_config";
          session.currentStep = nextStep;
          response =
            input.toLowerCase() === "skip"
              ? `No problem, you can add an image later! ${STEP_GUIDANCE[nextStep].oakAdvice}`
              : `Image saved! Your token is looking great. ${STEP_GUIDANCE[nextStep].oakAdvice}`;
        } else {
          response = `${validation.error}. ${guidance.prompt}`;
        }
        break;
      }

      case "fee_config": {
        const validation = guidance.validation!(input);
        if (validation.valid) {
          session.data.creatorFeePercent = parseFloat(input);
          nextStep = "socials";
          session.currentStep = nextStep;
          response = `${input}% creator fee - excellent choice! You'll earn from every trade. ${STEP_GUIDANCE[nextStep].oakAdvice}`;
        } else {
          response = `${validation.error}. ${guidance.prompt}`;
        }
        break;
      }

      case "socials": {
        if (input.toLowerCase() !== "skip") {
          // Parse socials from input
          const parts = input.split(",").map((s) => s.trim());
          for (const part of parts) {
            // Split only on first colon to preserve URLs like https://
            const colonIndex = part.indexOf(":");
            if (colonIndex === -1) continue;
            const platform = part.slice(0, colonIndex).trim();
            const value = part.slice(colonIndex + 1).trim();
            if (platform && value) {
              const platformLower = platform.toLowerCase();
              if (platformLower === "twitter" || platformLower === "x") {
                session.data.twitter = value.replace("@", "");
              } else if (platformLower === "telegram" || platformLower === "tg") {
                session.data.telegram = value.replace("@", "");
              } else if (platformLower === "website" || platformLower === "web") {
                session.data.website = value;
              }
            }
          }
        }
        nextStep = "initial_buy";
        session.currentStep = nextStep;
        response =
          input.toLowerCase() === "skip"
            ? `No socials for now - you can add them later! ${STEP_GUIDANCE[nextStep].oakAdvice}`
            : `Socials added! Building community is so important. ${STEP_GUIDANCE[nextStep].oakAdvice}`;
        break;
      }

      case "initial_buy": {
        const validation = guidance.validation!(input);
        if (validation.valid) {
          session.data.initialBuySol = parseFloat(input);
          nextStep = "review";
          session.currentStep = nextStep;
          response = this.buildReviewMessage(session);
        } else {
          response = `${validation.error}. ${guidance.prompt}`;
        }
        break;
      }

      case "review": {
        if (input.toLowerCase() === "confirm") {
          nextStep = "confirmed";
          session.currentStep = nextStep;
          launchReady = true;
          response = `${STEP_GUIDANCE[nextStep].oakAdvice}\n\nYour token "${session.data.name}" ($${session.data.symbol}) is ready! Click 'Build Transaction' to generate your launch transaction.`;
        } else if (input.toLowerCase() === "back") {
          nextStep = "initial_buy";
          session.currentStep = nextStep;
          response = STEP_GUIDANCE[nextStep].oakAdvice;
        } else {
          response =
            "Type 'confirm' to proceed with building your launch transaction, or 'back' to make changes.";
        }
        break;
      }

      case "confirmed": {
        response =
          "Your token details are locked in! Use the 'Build Transaction' button to generate your launch transaction, then sign it with your wallet.";
        launchReady = true;
        break;
      }

      case "completed": {
        response = `Your token ${session.data.name} ($${session.data.symbol}) is live! Share it with the world and start building your community. I'm so proud of you!`;
        break;
      }
    }

    session.messages.push({ role: "assistant", content: response });
    session.updatedAt = Date.now();

    // Persist to DB asynchronously (non-blocking)
    persistSession(session).catch((err) => {
      console.error("[LaunchWizard] Failed to persist session:", err.message);
    });

    return {
      success: true,
      session,
      response,
      nextStep,
      launchReady,
      launchData: launchReady ? session.data : undefined,
    };
  }

  /**
   * Build the actual launch transaction
   * This calls Bags.fm API to create token info, fee share config, and launch transaction
   */
  static async buildTransaction(
    request: BuildTransactionRequest
  ): Promise<BuildTransactionResult> {
    const session = sessions.get(request.sessionId);
    if (!session) {
      return {
        success: false,
        error: "Session not found",
        oakMessage:
          "I can't find your session! Let's start fresh - say 'launch a token' to begin again.",
      };
    }

    if (session.currentStep !== "confirmed" && session.currentStep !== "review") {
      return {
        success: false,
        error: "Session not ready for transaction building",
        oakMessage: "We're not quite ready yet! Let's finish reviewing your token details first.",
      };
    }

    const data = session.data;

    // Validate required fields
    if (!data.name || !data.symbol || !data.description) {
      return {
        success: false,
        error: "Missing required token data",
        oakMessage:
          "Hmm, some required details are missing. Let's go back and make sure we have your token name, symbol, and description.",
      };
    }

    const api = getBagsApiService();

    if (!api.hasApiKey()) {
      return {
        success: false,
        error: "Bags API key not configured",
        oakMessage:
          "I'm having trouble connecting to Bags.fm. Please try again later or contact support.",
      };
    }

    console.log(`[LaunchWizard] Building transaction for ${data.name} ($${data.symbol})`);

    // Step 1: Create token info (metadata + mint address)
    let tokenCreation: TokenCreationResult;
    try {
      console.log("[LaunchWizard] Step 1: Creating token info...");
      tokenCreation = await api.createTokenInfo({
        name: data.name,
        symbol: data.symbol,
        description: data.description,
        imageUrl: data.imageUrl,
        twitter: data.twitter,
        telegram: data.telegram,
        website: data.website,
      });
      session.tokenCreation = tokenCreation;
      console.log(`[LaunchWizard] Token info created: mint=${tokenCreation.tokenMint}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[LaunchWizard] Failed to create token info:", errorMessage);
      return {
        success: false,
        error: `Failed to create token: ${errorMessage}`,
        oakMessage: `Oh no! There was a problem creating your token metadata: ${errorMessage}. Let's try again!`,
      };
    }

    // Step 2: Create fee share config
    let feeShareConfig: FeeShareConfigResult;
    try {
      console.log("[LaunchWizard] Step 2: Creating fee share config...");

      // Build fee claimers - default to creator getting 100%
      const feeClaimers: FeeClaimer[] = [
        {
          provider: "solana",
          providerUsername: request.walletAddress,
          bps: 10000, // 100% in basis points
        },
      ];

      // Add any additional fee claimers from session data
      if (data.feeClaimers && data.feeClaimers.length > 0) {
        // Recalculate basis points to include additional claimers
        // For simplicity, creator always gets majority
        feeClaimers[0].bps = 8000; // 80% to creator
        const remainingBps = 2000; // 20% to split among others
        const perClaimerBps = Math.floor(remainingBps / data.feeClaimers.length);
        for (const claimer of data.feeClaimers) {
          feeClaimers.push({
            provider: claimer.provider,
            providerUsername: claimer.providerUsername,
            bps: perClaimerBps,
          });
        }
      }

      feeShareConfig = await api.createFeeShareConfig(
        tokenCreation.tokenMint,
        feeClaimers,
        request.walletAddress,
        undefined, // partnerWallet
        BagsApiService.PARTNER_CONFIG_PDA // Use BagsWorld partner config
      );
      session.feeShareConfig = feeShareConfig;
      console.log(`[LaunchWizard] Fee share config created: ${feeShareConfig.configId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[LaunchWizard] Failed to create fee share config:", errorMessage);
      return {
        success: false,
        error: `Failed to configure fees: ${errorMessage}`,
        oakMessage: `There was an issue setting up your fee configuration: ${errorMessage}. Don't worry, we can try again!`,
        tokenMint: tokenCreation.tokenMint,
        tokenMetadata: tokenCreation.tokenMetadata,
      };
    }

    // Step 3: Create launch transaction
    let launchTx: LaunchTransactionResult;
    try {
      console.log("[LaunchWizard] Step 3: Creating launch transaction...");

      const initialBuyLamports = Math.floor(
        (data.initialBuySol || DEFAULT_INITIAL_BUY_SOL) * LAMPORTS_PER_SOL
      );

      launchTx = await api.createLaunchTransaction({
        ipfs: tokenCreation.tokenMetadata,
        tokenMint: tokenCreation.tokenMint,
        wallet: request.walletAddress,
        initialBuyLamports,
        configKey: feeShareConfig.configId,
      });
      console.log("[LaunchWizard] Launch transaction created successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[LaunchWizard] Failed to create launch transaction:", errorMessage);
      return {
        success: false,
        error: `Failed to create launch transaction: ${errorMessage}`,
        oakMessage: `Almost there! But we hit a snag creating your launch transaction: ${errorMessage}. Let's try once more!`,
        tokenMint: tokenCreation.tokenMint,
        tokenMetadata: tokenCreation.tokenMetadata,
        feeShareConfigId: feeShareConfig.configId,
        feeShareTransactions: feeShareConfig.transactions,
      };
    }

    // Success!
    session.currentStep = "confirmed";
    session.updatedAt = Date.now();

    return {
      success: true,
      tokenMint: tokenCreation.tokenMint,
      tokenMetadata: tokenCreation.tokenMetadata,
      feeShareConfigId: feeShareConfig.configId,
      feeShareTransactions: feeShareConfig.transactions,
      launchTransaction: launchTx.transaction,
      lastValidBlockHeight: launchTx.lastValidBlockHeight,
      oakMessage: `WONDERFUL! Your token "${data.name}" ($${data.symbol}) transaction is ready! Sign it with your wallet to bring your token to life! I can't wait to see it evolve!`,
    };
  }

  /**
   * Mark session as completed after successful launch
   */
  static completeSession(sessionId: string, mint: string): void {
    const session = sessions.get(sessionId);
    if (session) {
      session.currentStep = "completed";
      session.updatedAt = Date.now();
      console.log(`[LaunchWizard] Session ${sessionId} completed with mint ${mint}`);

      // Persist to DB asynchronously
      persistSession(session).catch((err) => {
        console.error(`[LaunchWizard] Failed to persist completed session: ${err.message}`);
      });
    }
  }

  /**
   * Get Professor Oak's personalized advice using LLM
   */
  static async getPersonalizedAdvice(session: LaunchSession, question: string): Promise<string> {
    const professorOak = getCharacter("professor-oak");
    if (!professorOak) {
      return "I'm here to help! What would you like to know about launching your token?";
    }

    const llm = getLLMService();
    const context = `
Current launch session:
- Step: ${session.currentStep}
- Token Name: ${session.data.name || "not set"}
- Symbol: ${session.data.symbol || "not set"}
- Description: ${session.data.description || "not set"}
- Creator Fee: ${session.data.creatorFeePercent ?? "not set"}%
- Initial Buy: ${session.data.initialBuySol || DEFAULT_INITIAL_BUY_SOL} SOL
- Twitter: ${session.data.twitter || "not set"}

User question: ${question}
`;

    const response = await llm.generateResponse(
      professorOak,
      question,
      session.messages.slice(-6),
      { messages: [], worldState: context }
    );

    return response.text;
  }

  /**
   * Build review message showing all token details
   */
  private static buildReviewMessage(session: LaunchSession): string {
    const d = session.data;
    return `${STEP_GUIDANCE.review.oakAdvice}

📋 TOKEN DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: ${d.name}
Symbol: $${d.symbol}
Description: ${d.description}
Image: ${d.imageUrl || "(none set - you can add later)"}
Creator Fee: ${d.creatorFeePercent}%
Initial Buy: ${d.initialBuySol} SOL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Socials:
- Twitter: ${d.twitter ? `@${d.twitter}` : "(not set)"}
- Telegram: ${d.telegram ? `@${d.telegram}` : "(not set)"}
- Website: ${d.website || "(not set)"}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Type 'confirm' to build your launch transaction, or 'back' to make changes.`;
  }

  /**
   * Get previous step for back navigation
   */
  private static getPreviousStep(current: LaunchStep): LaunchStep {
    const idx = STEP_ORDER.indexOf(current);
    return idx > 0 ? STEP_ORDER[idx - 1] : "welcome";
  }

  /**
   * Get all active sessions (for admin/monitoring)
   */
  static getActiveSessions(): LaunchSession[] {
    const cutoff = Date.now() - SESSION_MAX_AGE_MS;
    return Array.from(sessions.values()).filter((s) => s.updatedAt > cutoff);
  }

  /**
   * Clean up old sessions from memory and database
   */
  static cleanupSessions(maxAgeMs: number = SESSION_MAX_AGE_MS): number {
    const cutoff = Date.now() - maxAgeMs;
    let cleaned = 0;
    const sessionIdsToDelete: string[] = [];

    for (const [id, session] of sessions) {
      if (session.updatedAt < cutoff) {
        sessions.delete(id);
        sessionIdsToDelete.push(id);
        cleaned++;
      }
    }

    // Also clean from DB asynchronously
    if (dbInstance && sessionIdsToDelete.length > 0) {
      const sql = dbInstance;
      const cutoffDate = new Date(cutoff).toISOString();
      sql`DELETE FROM launch_wizard_sessions WHERE updated_at < ${cutoffDate}`
        .then(() => {
          console.log(`[LaunchWizard] Cleaned old sessions from DB`);
        })
        .catch((err) => {
          console.error(`[LaunchWizard] Failed to clean old sessions from DB: ${err.message}`);
        });
    }

    console.log(`[LaunchWizard] Cleaned up ${cleaned} old sessions from memory`);
    return cleaned;
  }
}

export default LaunchWizard;
