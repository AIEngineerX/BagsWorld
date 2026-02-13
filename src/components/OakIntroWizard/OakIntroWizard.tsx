"use client";

import { useReducer, useCallback, useEffect, useMemo, useRef } from "react";
import { useMobileWallet } from "@/hooks/useMobileWallet";
import { executeLaunchFlow } from "@/lib/launch-flow";
import { GameBoyFrame } from "./GameBoyFrame";
import { TitleScreen } from "./screens/TitleScreen";
import { ProfessorEntry } from "./screens/ProfessorEntry";
import { CreatorNameScreen } from "./screens/CreatorNameScreen";
import { RivalScreen } from "./screens/RivalScreen";
import { TokenCreationScreen } from "./screens/TokenCreationScreen";
import { EducationScreens } from "./screens/EducationScreens";
import { LaunchScreen } from "./screens/LaunchScreen";
import { SendOffScreen } from "./screens/SendOffScreen";
import type { WizardState, WizardAction, ScreenProps } from "./types";
import { SCREEN_ORDER } from "./constants";

const initialState: WizardState = {
  currentScreen: "title",
  creatorName: "",
  feeShares: [{ provider: "twitter", username: "", bps: 10000 }],
  tokenConcept: "",
  tokenStyle: "pixel-art",
  tokenName: "",
  tokenSymbol: "",
  tokenDescription: "",
  tokenImageUrl: null,
  tokenBannerUrl: null,
  suggestedNames: [],
  isGenerating: false,
  initialBuySOL: "0",
  launchPhase: 0,
  launchStatus: "",
  launchError: null,
  tokenMint: null,
};

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_SCREEN":
      return { ...state, currentScreen: action.screen };
    case "SET_CREATOR_NAME":
      return { ...state, creatorName: action.name };
    case "SET_FEE_SHARES":
      return { ...state, feeShares: action.shares };
    case "SET_TOKEN_CONCEPT":
      return { ...state, tokenConcept: action.concept };
    case "SET_TOKEN_STYLE":
      return { ...state, tokenStyle: action.style };
    case "SET_TOKEN_DATA":
      return {
        ...state,
        tokenName: action.name,
        tokenSymbol: action.symbol,
        tokenDescription: action.description,
      };
    case "SET_TOKEN_IMAGE":
      return { ...state, tokenImageUrl: action.url };
    case "SET_TOKEN_BANNER":
      return { ...state, tokenBannerUrl: action.url };
    case "SET_SUGGESTED_NAMES":
      return { ...state, suggestedNames: action.names };
    case "SET_GENERATING":
      return { ...state, isGenerating: action.generating };
    case "SET_INITIAL_BUY":
      return { ...state, initialBuySOL: action.amount };
    case "SET_LAUNCH_PHASE":
      return { ...state, launchPhase: action.phase };
    case "SET_LAUNCH_STATUS":
      return { ...state, launchStatus: action.status };
    case "SET_LAUNCH_ERROR":
      return { ...state, launchError: action.error };
    case "SET_TOKEN_MINT":
      return { ...state, tokenMint: action.mint };
    case "ADVANCE_SCREEN": {
      const currentIndex = SCREEN_ORDER.indexOf(state.currentScreen);
      const nextScreen = SCREEN_ORDER[currentIndex + 1];
      if (nextScreen) {
        return { ...state, currentScreen: nextScreen };
      }
      return state;
    }
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

interface OakIntroWizardProps {
  onClose: () => void;
  onLaunchSuccess?: () => void;
}

export function OakIntroWizard({ onClose, onLaunchSuccess }: OakIntroWizardProps) {
  const [state, dispatch] = useReducer(wizardReducer, initialState);
  const { publicKey, connected, mobileSignTransaction, mobileSignAndSend } = useMobileWallet();

  // Keep refs to wallet signing functions so the launch effect always uses current versions
  const signTxRef = useRef(mobileSignTransaction);
  const signAndSendRef = useRef(mobileSignAndSend);
  useEffect(() => {
    signTxRef.current = mobileSignTransaction;
    signAndSendRef.current = mobileSignAndSend;
  }, [mobileSignTransaction, mobileSignAndSend]);

  // Keep ref to state for use inside effects without re-triggering them
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const handleAdvance = useCallback(() => {
    dispatch({ type: "ADVANCE_SCREEN" });
  }, []);

  const handleSkip = useCallback(() => {
    const s = stateRef.current;
    if (s.tokenName && s.tokenImageUrl) {
      dispatch({ type: "SET_SCREEN", screen: "wallet_connect" });
    } else {
      sessionStorage.setItem("bagsworld_intro_seen", "true");
      onClose();
    }
  }, [onClose]);

  // Execute the launch when we enter the "launching" screen
  useEffect(() => {
    if (state.currentScreen !== "launching") return;
    if (!publicKey || !connected) return;

    let cancelled = false;
    const s = stateRef.current;

    const runLaunch = async () => {
      try {
        const feeClaimers = s.feeShares
          .filter((f) => f.username.trim())
          .map((f) => ({
            provider: f.provider,
            providerUsername: f.username.replace(/@/g, "").toLowerCase().trim(),
            bps: f.bps,
          }));

        if (feeClaimers.length === 0) {
          feeClaimers.push({
            provider: "twitter",
            providerUsername: s.creatorName || "creator",
            bps: 10000,
          });
        }

        dispatch({ type: "SET_LAUNCH_PHASE", phase: 0 });
        dispatch({ type: "SET_LAUNCH_ERROR", error: null });

        const result = await executeLaunchFlow({
          tokenData: {
            name: s.tokenName,
            symbol: s.tokenSymbol,
            description: s.tokenDescription,
            image: s.tokenImageUrl || "",
          },
          feeShares: feeClaimers,
          initialBuySOL: s.initialBuySOL,
          walletPublicKey: publicKey,
          signTransaction: (tx) => signTxRef.current(tx),
          signAndSendTransaction: (tx, opts) => signAndSendRef.current(tx, opts),
          onStatus: (msg: string) => {
            if (cancelled) return;
            dispatch({ type: "SET_LAUNCH_STATUS", status: msg });
            if (msg.includes("fee") || msg.includes("Fee")) {
              dispatch({ type: "SET_LAUNCH_PHASE", phase: 1 });
            } else if (
              msg.includes("launch") ||
              msg.includes("Launch") ||
              msg.includes("sign") ||
              msg.includes("Broadcast")
            ) {
              dispatch({ type: "SET_LAUNCH_PHASE", phase: 2 });
            }
          },
        });

        if (cancelled) return;

        if (result.success && result.tokenMint) {
          dispatch({ type: "SET_TOKEN_MINT", mint: result.tokenMint });
          dispatch({ type: "SET_SCREEN", screen: "sendoff" });
          onLaunchSuccess?.();
        } else {
          dispatch({ type: "SET_LAUNCH_ERROR", error: result.error || "Launch failed" });
          dispatch({ type: "SET_SCREEN", screen: "error" });
        }
      } catch (err) {
        if (cancelled) return;
        dispatch({
          type: "SET_LAUNCH_ERROR",
          error: err instanceof Error ? err.message : "Launch failed",
        });
        dispatch({ type: "SET_SCREEN", screen: "error" });
      }
    };

    runLaunch();
    return () => {
      cancelled = true;
    };
  }, [state.currentScreen, publicKey, connected, onLaunchSuccess]);

  const handleClose = useCallback(() => {
    sessionStorage.setItem("bagsworld_intro_seen", "true");
    onClose();
  }, [onClose]);

  // Block only Phaser game-control keys (arrows, WASD) from propagating.
  // All other keys (letters, Space, Enter, Backspace, Escape, numbers)
  // are allowed through so wizard screens can handle them.
  useEffect(() => {
    const BLOCKED_KEYS = new Set([
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
    ]);
    const handler = (e: KeyboardEvent) => {
      if (BLOCKED_KEYS.has(e.code)) {
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", handler, true);
    window.addEventListener("keyup", handler, true);
    return () => {
      window.removeEventListener("keydown", handler, true);
      window.removeEventListener("keyup", handler, true);
    };
  }, []);

  const screenProps: ScreenProps = useMemo(
    () => ({
      state,
      dispatch,
      onAdvance: handleAdvance,
      onSkip: handleSkip,
    }),
    [state, dispatch, handleAdvance, handleSkip]
  );

  const renderScreen = () => {
    switch (state.currentScreen) {
      case "title":
        return <TitleScreen {...screenProps} />;

      case "professor_entry":
      case "welcome_dialogue":
        return <ProfessorEntry {...screenProps} />;

      case "creator_name":
        return <CreatorNameScreen {...screenProps} />;

      case "rival_intro":
      case "rival_name":
        return <RivalScreen {...screenProps} />;

      case "token_concept":
      case "token_style":
      case "token_names":
      case "token_image":
        return <TokenCreationScreen {...screenProps} />;

      case "education_fees":
      case "education_world":
        return <EducationScreens {...screenProps} />;

      case "wallet_connect":
      case "launch_review":
      case "launching":
        return <LaunchScreen {...screenProps} />;

      case "sendoff":
        return <SendOffScreen {...screenProps} />;

      case "error":
        return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <p className="font-pixel text-sm text-red-400 mb-4">Something went wrong...</p>
            <p className="font-pixel text-[8px] text-gray-400 mb-6 max-w-xs">
              {state.launchError || "An unexpected error occurred"}
            </p>
            <button
              onClick={() => dispatch({ type: "SET_SCREEN", screen: "launch_review" })}
              className="font-pixel text-xs bg-bags-green text-black px-6 py-2 hover:bg-bags-gold transition-colors"
            >
              TRY AGAIN
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return <GameBoyFrame onClose={handleClose}>{renderScreen()}</GameBoyFrame>;
}
