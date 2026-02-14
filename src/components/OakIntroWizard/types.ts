import React from "react";

export type WizardScreen =
  | "title"
  | "professor_entry"
  | "creator_name"
  | "rival_intro"
  | "rival_name"
  | "token_concept"
  | "token_custom"
  | "token_style"
  | "token_names"
  | "token_image"
  | "education_fees"
  | "education_world"
  | "wallet_connect"
  | "launch_review"
  | "launching"
  | "sendoff"
  | "error";

export interface FeeShareConfig {
  provider: string;
  username: string;
  bps: number;
}

export interface SuggestedName {
  name: string;
  symbol: string;
  description: string;
}

export interface WizardState {
  currentScreen: WizardScreen;
  creatorName: string;
  feeShares: FeeShareConfig[];
  tokenConcept: string;
  tokenStyle: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDescription: string;
  tokenImageUrl: string | null;
  tokenBannerUrl: string | null;
  tokenTwitter: string;
  tokenWebsite: string;
  suggestedNames: SuggestedName[];
  isGenerating: boolean;
  initialBuySOL: string;
  launchPhase: number;
  launchStatus: string;
  launchError: string | null;
  tokenMint: string | null;
}

export type WizardAction =
  | { type: "SET_SCREEN"; screen: WizardScreen }
  | { type: "SET_CREATOR_NAME"; name: string }
  | { type: "SET_FEE_SHARES"; shares: FeeShareConfig[] }
  | { type: "SET_TOKEN_CONCEPT"; concept: string }
  | { type: "SET_TOKEN_STYLE"; style: string }
  | { type: "SET_TOKEN_DATA"; name: string; symbol: string; description: string }
  | { type: "SET_TOKEN_IMAGE"; url: string | null }
  | { type: "SET_TOKEN_BANNER"; url: string | null }
  | { type: "SET_TOKEN_TWITTER"; twitter: string }
  | { type: "SET_TOKEN_WEBSITE"; website: string }
  | { type: "SET_SUGGESTED_NAMES"; names: SuggestedName[] }
  | { type: "SET_GENERATING"; generating: boolean }
  | { type: "SET_INITIAL_BUY"; amount: string }
  | { type: "SET_LAUNCH_PHASE"; phase: number }
  | { type: "SET_LAUNCH_STATUS"; status: string }
  | { type: "SET_LAUNCH_ERROR"; error: string | null }
  | { type: "SET_TOKEN_MINT"; mint: string }
  | { type: "ADVANCE_SCREEN" }
  | { type: "RESET" };

export interface ScreenProps {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  onAdvance: () => void;
  onSkip: () => void;
}
