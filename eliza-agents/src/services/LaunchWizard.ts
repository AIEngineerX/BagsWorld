// LaunchWizard - Guided token launch flow with Professor Oak
// Walks users through each step of launching a token on Bags.fm

import { getCharacter } from '../characters/index.js';
import { getLLMService } from './LLMService.js';

export type LaunchStep =
  | 'welcome'
  | 'token_name'
  | 'token_symbol'
  | 'token_description'
  | 'token_image'
  | 'fee_config'
  | 'review'
  | 'confirmed'
  | 'completed';

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
  };
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  createdAt: number;
  updatedAt: number;
}

export interface StepGuidance {
  title: string;
  oakAdvice: string;
  prompt: string;
  validation?: (value: string) => { valid: boolean; error?: string };
  examples?: string[];
  tips?: string[];
}

// Step ordering for navigation
const STEP_ORDER: LaunchStep[] = [
  'welcome', 'token_name', 'token_symbol', 'token_description',
  'token_image', 'fee_config', 'review', 'confirmed', 'completed',
];

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// Affirmative words for welcome step
const AFFIRMATIVE_WORDS = ['ready', 'yes', 'start', 'begin', 'ok', 'okay', "let's go", 'lets go'];

// Professor Oak's guidance for each step
const STEP_GUIDANCE: Record<LaunchStep, StepGuidance> = {
  welcome: {
    title: 'Welcome to Token Launch',
    oakAdvice: "Ah, welcome young trainer! I'm Professor Oak, and I'll guide you through launching your very own token on Bags.fm. Just like catching your first Pokémon, this is an exciting journey! Are you ready to begin?",
    prompt: "Say 'ready' or 'yes' to start your token launch journey!",
    tips: [
      "Have your token concept ready",
      "Prepare a logo (512x512 PNG recommended)",
      "Think about your community strategy",
    ],
  },

  token_name: {
    title: 'Choose Your Token Name',
    oakAdvice: "Every great token needs a memorable name! Just like how Pikachu is instantly recognizable, your token name should be catchy and represent your project's identity. What would you like to call your token?",
    prompt: "Enter your token name (3-32 characters)",
    validation: (value: string) => {
      if (value.length < 3) return { valid: false, error: 'Token name must be at least 3 characters' };
      if (value.length > 32) return { valid: false, error: 'Token name must be 32 characters or less' };
      if (!/^[a-zA-Z0-9\s]+$/.test(value)) return { valid: false, error: 'Token name can only contain letters, numbers, and spaces' };
      return { valid: true };
    },
    examples: ['Bags World', 'Moon Token', 'Degen Coin'],
    tips: [
      "Keep it memorable and easy to spell",
      "Avoid names too similar to existing tokens",
      "Consider how it sounds when spoken aloud",
    ],
  },

  token_symbol: {
    title: 'Choose Your Token Symbol',
    oakAdvice: "Now for the ticker symbol! This is like your token's nickname - short and punchy. It appears on exchanges and in wallets. Most symbols are 3-5 characters. What symbol suits your token?",
    prompt: "Enter your token symbol (2-10 characters, letters only)",
    validation: (value: string) => {
      const symbol = value.toUpperCase().replace('$', '');
      if (symbol.length < 2) return { valid: false, error: 'Symbol must be at least 2 characters' };
      if (symbol.length > 10) return { valid: false, error: 'Symbol must be 10 characters or less' };
      if (!/^[A-Z]+$/.test(symbol)) return { valid: false, error: 'Symbol can only contain letters' };
      return { valid: true };
    },
    examples: ['$BAGS', '$MOON', '$DEGEN'],
    tips: [
      "All caps is standard",
      "Shorter is usually better (3-5 chars)",
      "Check if it's already taken on DEXes",
    ],
  },

  token_description: {
    title: 'Describe Your Token',
    oakAdvice: "Fascinating! Now tell me about your token's purpose. A good description helps traders understand what makes your project special. Think of it as your token's Pokédex entry - what story does it tell?",
    prompt: "Enter a description for your token (10-500 characters)",
    validation: (value: string) => {
      if (value.length < 10) return { valid: false, error: 'Description must be at least 10 characters' };
      if (value.length > 500) return { valid: false, error: 'Description must be 500 characters or less' };
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
    title: 'Add Token Image',
    oakAdvice: "A picture is worth a thousand words! Your token image appears everywhere - wallets, DEXes, and social media. For best results, use a 512x512 PNG with a transparent or solid background. Do you have an image URL ready?",
    prompt: "Enter your token image URL (must be https:// and end in .png, .jpg, .gif, or .webp) or type 'skip' to add later",
    validation: (value: string) => {
      if (value.toLowerCase() === 'skip') return { valid: true };
      if (!value.startsWith('https://')) return { valid: false, error: 'Image URL must start with https://' };
      if (!/\.(png|jpg|jpeg|gif|webp)$/i.test(value)) return { valid: false, error: 'Image must be PNG, JPG, GIF, or WebP' };
      return { valid: true };
    },
    tips: [
      "512x512 pixels is the standard size",
      "PNG with transparent background works best",
      "For DexScreener paid listing: 512x512 logo + 1500x500 banner",
      "DexScreener listing costs $299 but increases visibility",
    ],
  },

  fee_config: {
    title: 'Configure Creator Fees',
    oakAdvice: "Ah, the creator fee! On Bags.fm, you earn a percentage of every trade. The standard is 1%, but you can set 0-5%. Higher fees mean more earnings but might discourage trading. What percentage would you like?",
    prompt: "Enter your creator fee percentage (0-5, default is 1)",
    validation: (value: string) => {
      const num = parseFloat(value);
      if (isNaN(num)) return { valid: false, error: 'Please enter a number' };
      if (num < 0 || num > 5) return { valid: false, error: 'Fee must be between 0% and 5%' };
      return { valid: true };
    },
    examples: ['1', '0.5', '2'],
    tips: [
      "1% is the most common choice",
      "Lower fees can encourage more trading volume",
      "Fees accumulate and can be claimed anytime",
      "You can check unclaimed fees on your profile",
    ],
  },

  review: {
    title: 'Review Your Token',
    oakAdvice: "Excellent work! Let's review everything before we finalize. Once launched, some details cannot be changed, so make sure everything looks right!",
    prompt: "Type 'confirm' to launch your token, or 'back' to make changes",
    tips: [
      "Double-check your symbol spelling",
      "Verify your image URL works",
      "Remember: name and symbol cannot be changed after launch",
    ],
  },

  confirmed: {
    title: 'Launch Confirmed',
    oakAdvice: "Your token details are confirmed! Now you'll need to sign a transaction with your wallet to complete the launch. This will create your token on the Solana blockchain.",
    prompt: "Ready to sign the transaction? This will open your wallet.",
    tips: [
      "Have some SOL ready for transaction fees (~0.02 SOL)",
      "The transaction creates your token on-chain",
      "After launch, share your token link to build community",
    ],
  },

  completed: {
    title: 'Token Launched!',
    oakAdvice: "Congratulations, trainer! Your token is now live on Bags.fm! Just like releasing a Pokémon into the wild, your token is now out there for the world to discover. Share it, build your community, and watch it grow!",
    prompt: "Your token is live! Share it with the world.",
    tips: [
      "Share on Twitter/X with your token link",
      "Engage with your community",
      "Consider getting listed on DexScreener ($299)",
      "Monitor your creator fees on Bags.fm",
    ],
  },
};

// Session storage (in production, use Redis or database)
const sessions = new Map<string, LaunchSession>();

export class LaunchWizard {
  /**
   * Start a new launch session
   */
  static startSession(userId: string): LaunchSession {
    const sessionId = crypto.randomUUID();
    const session: LaunchSession = {
      id: sessionId,
      userId,
      currentStep: 'welcome',
      data: {},
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    sessions.set(sessionId, session);
    console.log(`[LaunchWizard] Started session ${sessionId} for user ${userId}`);
    return session;
  }

  /**
   * Get an existing session
   */
  static getSession(sessionId: string): LaunchSession | null {
    return sessions.get(sessionId) || null;
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
    launchData?: LaunchSession['data'];
  }> {
    const session = sessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        session: { id: sessionId } as LaunchSession,
        response: "I can't find your session. Let's start fresh!",
        error: 'Session not found',
      };
    }

    const guidance = STEP_GUIDANCE[session.currentStep];
    const input = userInput.trim();

    // Add user message to history
    session.messages.push({ role: 'user', content: input });

    // Handle special commands
    if (input.toLowerCase() === 'back' && session.currentStep !== 'welcome') {
      const prevStep = this.getPreviousStep(session.currentStep);
      session.currentStep = prevStep;
      session.updatedAt = Date.now();
      const prevGuidance = STEP_GUIDANCE[prevStep];

      session.messages.push({ role: 'assistant', content: prevGuidance.oakAdvice });

      return {
        success: true,
        session,
        response: prevGuidance.oakAdvice,
        nextStep: prevStep,
      };
    }

    if (input.toLowerCase() === 'cancel') {
      sessions.delete(sessionId);
      return {
        success: true,
        session,
        response: "No problem! Your session has been cancelled. Come back anytime you're ready to launch!",
      };
    }

    // Process based on current step
    let response = '';
    let nextStep: LaunchStep | undefined;
    let launchReady = false;

    switch (session.currentStep) {
      case 'welcome': {
        if (AFFIRMATIVE_WORDS.some(w => input.toLowerCase().includes(w))) {
          nextStep = 'token_name';
          session.currentStep = nextStep;
          response = STEP_GUIDANCE[nextStep].oakAdvice;
        } else {
          response = "Just say 'ready' when you want to begin! I'll guide you through each step.";
        }
        break;
      }

      case 'token_name': {
        const validation = guidance.validation!(input);
        if (validation.valid) {
          session.data.name = input;
          nextStep = 'token_symbol';
          session.currentStep = nextStep;
          response = `"${input}" - wonderful choice! ${STEP_GUIDANCE[nextStep].oakAdvice}`;
        } else {
          response = `Hmm, ${validation.error}. ${guidance.prompt}`;
        }
        break;
      }

      case 'token_symbol': {
        const symbol = input.toUpperCase().replace('$', '');
        const validation = guidance.validation!(symbol);
        if (validation.valid) {
          session.data.symbol = symbol;
          nextStep = 'token_description';
          session.currentStep = nextStep;
          response = `$${symbol} - that has a nice ring to it! ${STEP_GUIDANCE[nextStep].oakAdvice}`;
        } else {
          response = `${validation.error}. ${guidance.prompt}`;
        }
        break;
      }

      case 'token_description': {
        const validation = guidance.validation!(input);
        if (validation.valid) {
          session.data.description = input;
          nextStep = 'token_image';
          session.currentStep = nextStep;
          response = `Great description! ${STEP_GUIDANCE[nextStep].oakAdvice}`;
        } else {
          response = `${validation.error}. ${guidance.prompt}`;
        }
        break;
      }

      case 'token_image': {
        const validation = guidance.validation!(input);
        if (validation.valid) {
          if (input.toLowerCase() !== 'skip') {
            session.data.imageUrl = input;
          }
          nextStep = 'fee_config';
          session.currentStep = nextStep;
          response = input.toLowerCase() === 'skip'
            ? `No problem, you can add an image later! ${STEP_GUIDANCE[nextStep].oakAdvice}`
            : `Image saved! ${STEP_GUIDANCE[nextStep].oakAdvice}`;
        } else {
          response = `${validation.error}. ${guidance.prompt}`;
        }
        break;
      }

      case 'fee_config': {
        const validation = guidance.validation!(input);
        if (validation.valid) {
          session.data.creatorFeePercent = parseFloat(input);
          nextStep = 'review';
          session.currentStep = nextStep;
          response = this.buildReviewMessage(session);
        } else {
          response = `${validation.error}. ${guidance.prompt}`;
        }
        break;
      }

      case 'review': {
        if (input.toLowerCase() === 'confirm') {
          nextStep = 'confirmed';
          session.currentStep = nextStep;
          launchReady = true;
          response = `${STEP_GUIDANCE[nextStep].oakAdvice}\n\nYour token "${session.data.name}" ($${session.data.symbol}) is ready to launch!`;
        } else if (input.toLowerCase() === 'back') {
          nextStep = 'fee_config';
          session.currentStep = nextStep;
          response = STEP_GUIDANCE[nextStep].oakAdvice;
        } else {
          response = "Type 'confirm' to proceed with the launch, or 'back' to make changes.";
        }
        break;
      }

      case 'confirmed': {
        // After confirmation, they need to sign the transaction
        response = "Your token details are locked in! Connect your wallet and sign the transaction to complete the launch.";
        launchReady = true;
        break;
      }

      case 'completed': {
        response = `Your token ${session.data.name} ($${session.data.symbol}) is live! Share it with the world and start building your community.`;
        break;
      }
    }

    session.messages.push({ role: 'assistant', content: response });
    session.updatedAt = Date.now();

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
   * Mark session as completed after successful launch
   */
  static completeSession(sessionId: string, mint: string): void {
    const session = sessions.get(sessionId);
    if (session) {
      session.currentStep = 'completed';
      session.updatedAt = Date.now();
      console.log(`[LaunchWizard] Session ${sessionId} completed with mint ${mint}`);
    }
  }

  /**
   * Get Professor Oak's personalized advice using LLM
   */
  static async getPersonalizedAdvice(
    session: LaunchSession,
    question: string
  ): Promise<string> {
    const professorOak = getCharacter('professor-oak');
    if (!professorOak) {
      return "I'm here to help! What would you like to know about launching your token?";
    }

    const llm = getLLMService();
    const context = `
Current launch session:
- Step: ${session.currentStep}
- Token Name: ${session.data.name || 'not set'}
- Symbol: ${session.data.symbol || 'not set'}
- Description: ${session.data.description || 'not set'}
- Creator Fee: ${session.data.creatorFeePercent ?? 'not set'}%

User question: ${question}
`;

    const response = await llm.generateResponse(
      professorOak,
      question,
      session.messages.slice(-6),
      { worldState: context }
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
━━━━━━━━━━━━━━━━━━
Name: ${d.name}
Symbol: $${d.symbol}
Description: ${d.description}
Image: ${d.imageUrl || '(none set)'}
Creator Fee: ${d.creatorFeePercent}%
━━━━━━━━━━━━━━━━━━

Type 'confirm' to launch, or 'back' to make changes.`;
  }

  /**
   * Get previous step for back navigation
   */
  private static getPreviousStep(current: LaunchStep): LaunchStep {
    const idx = STEP_ORDER.indexOf(current);
    return idx > 0 ? STEP_ORDER[idx - 1] : 'welcome';
  }

  /**
   * Get all active sessions (for admin/monitoring)
   */
  static getActiveSessions(): LaunchSession[] {
    const cutoff = Date.now() - SESSION_MAX_AGE_MS;
    return Array.from(sessions.values()).filter(s => s.updatedAt > cutoff);
  }

  /**
   * Clean up old sessions
   */
  static cleanupSessions(maxAgeMs: number = SESSION_MAX_AGE_MS): number {
    const cutoff = Date.now() - maxAgeMs;
    let cleaned = 0;
    for (const [id, session] of sessions) {
      if (session.updatedAt < cutoff) {
        sessions.delete(id);
        cleaned++;
      }
    }
    console.log(`[LaunchWizard] Cleaned up ${cleaned} old sessions`);
    return cleaned;
  }
}

export default LaunchWizard;
