"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import type { ScreenProps, SuggestedName } from "../types";
import { ART_STYLES, DIALOGUE } from "../constants";
import { DialogueBox } from "../DialogueBox";
import { OakSprite } from "../PixelSprites";

/* ─── Sub-screen: Token Concept ─── */
function TokenConceptView({
  state,
  dispatch,
  onAdvance,
}: Pick<ScreenProps, "state" | "dispatch" | "onAdvance">) {
  const [concept, setConcept] = useState(state.tokenConcept || "");
  const [showInput, setShowInput] = useState(false);

  const handleSubmit = () => {
    if (concept.trim().length >= 3) {
      dispatch({ type: "SET_TOKEN_CONCEPT", concept: concept.trim() });
      onAdvance();
    }
  };

  return (
    <div
      className="absolute inset-0 bg-gray-900 flex flex-col items-center overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900 to-gray-800" />

      {/* Oak sprite */}
      <div className="relative z-[5] mt-[8%] sm:mt-[5%]">
        <OakSprite className="scale-[1.5] sm:scale-[2]" />
      </div>

      {/* Dialogue then input */}
      {!showInput ? (
        <DialogueBox
          lines={DIALOGUE.token_concept}
          speakerName="PROF. OAK"
          onComplete={() => setShowInput(true)}
        />
      ) : (
        <div className="absolute bottom-0 left-0 right-0 p-3 z-10">
          <div className="bg-black/95 border-2 border-white rounded-lg p-3 mx-2 mb-2">
            <label className="font-pixel text-[9px] text-bags-gold mb-2 block">
              Describe your token idea...
            </label>
            <textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="A cosmic cat exploring galaxies..."
              className="w-full bg-gray-900 border border-gray-600 text-white font-pixel text-[10px] px-3 py-2 rounded resize-none h-16 focus:border-bags-green focus:outline-none placeholder:text-gray-600"
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.code === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              autoFocus
            />
            <button
              type="button"
              className={`mt-2 w-full font-pixel text-[10px] py-2 rounded cursor-pointer transition-colors ${concept.trim().length >= 3 ? "bg-bags-green text-black hover:bg-green-400" : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}
              onClick={handleSubmit}
              disabled={concept.trim().length < 3}
            >
              [CONTINUE]
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-screen: Art Style Picker ─── */
function TokenStyleView({
  state,
  dispatch,
  onAdvance,
}: Pick<ScreenProps, "state" | "dispatch" | "onAdvance">) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const confirm = useCallback(() => {
    const style = ART_STYLES[selectedIndex];
    dispatch({ type: "SET_TOKEN_STYLE", style: style.id });
    onAdvance();
  }, [selectedIndex, dispatch, onAdvance]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.code === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => (i > 0 ? i - 1 : ART_STYLES.length - 1));
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i < ART_STYLES.length - 1 ? i + 1 : 0));
      } else if (e.code === "Enter" || e.code === "Space") {
        e.preventDefault();
        confirm();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirm]);

  return (
    <div
      className="absolute inset-0 bg-black flex flex-col items-center justify-center px-4"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <h2 className="font-pixel text-[11px] sm:text-sm text-white mb-6">Choose an art style</h2>

      <div className="w-full max-w-[320px] space-y-1">
        {ART_STYLES.map((style, index) => (
          <button
            key={style.id}
            type="button"
            className={`w-full flex items-center gap-3 px-3 py-2 rounded font-pixel text-[10px] transition-colors cursor-pointer text-left ${index === selectedIndex ? "bg-gray-800 text-bags-green border border-bags-green" : "bg-transparent text-gray-400 border border-transparent hover:bg-gray-900"}`}
            onClick={() => {
              setSelectedIndex(index);
              dispatch({ type: "SET_TOKEN_STYLE", style: style.id });
              onAdvance();
            }}
          >
            <span className="text-bags-green w-4 text-center font-pixel">
              {index === selectedIndex ? ">" : " "}
            </span>
            <span>{style.label}</span>
            <span className="text-gray-600 text-[8px] ml-auto">{style.description}</span>
          </button>
        ))}
      </div>

      <p className="font-pixel text-[8px] text-gray-600 mt-4">
        Arrow keys to navigate, Enter to select
      </p>
    </div>
  );
}

/* ─── Sub-screen: Token Names ─── */
function TokenNamesView({
  state,
  dispatch,
  onAdvance,
}: Pick<ScreenProps, "state" | "dispatch" | "onAdvance">) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  // Fetch suggested names on mount
  useEffect(() => {
    if (state.suggestedNames.length > 0 || fetchedRef.current) return;
    fetchedRef.current = true;

    const fetchNames = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/oak-generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "suggest-names",
            concept: state.tokenConcept,
          }),
        });

        if (!res.ok) throw new Error("Failed to generate names");

        const data = await res.json();
        const names: SuggestedName[] = (data.suggestions || data.names || []).map(
          (n: Record<string, string>) => ({
            name: n.name || n.label || "",
            symbol: n.symbol || n.ticker || "",
            description: n.description || "",
          })
        );

        dispatch({ type: "SET_SUGGESTED_NAMES", names });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
        fetchedRef.current = false;
      } finally {
        setLoading(false);
      }
    };

    fetchNames();
  }, [state.suggestedNames.length, state.tokenConcept, dispatch]);

  const handleSelect = (name: SuggestedName) => {
    dispatch({
      type: "SET_TOKEN_DATA",
      name: name.name,
      symbol: name.symbol,
      description: name.description,
    });
    onAdvance();
  };

  return (
    <div
      className="absolute inset-0 bg-black flex flex-col items-center justify-center px-4"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      {loading ? (
        <div className="flex flex-col items-center gap-3">
          <OakSprite className="scale-[1.5] animate-pulse" />
          <p className="font-pixel text-[10px] text-bags-gold animate-pulse">
            Consulting my research database...
          </p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3">
          <p className="font-pixel text-[10px] text-red-400">{error}</p>
          <button
            type="button"
            className="font-pixel text-[10px] text-bags-green border border-bags-green px-4 py-2 rounded cursor-pointer hover:bg-bags-green hover:text-black transition-colors"
            onClick={() => {
              fetchedRef.current = false;
              setError(null);
              setLoading(true);
              // Re-trigger fetch via state change
              dispatch({ type: "SET_SUGGESTED_NAMES", names: [] });
            }}
          >
            [RETRY]
          </button>
        </div>
      ) : (
        <>
          <h2 className="font-pixel text-[11px] sm:text-sm text-white mb-4">Choose your TOKEN!</h2>

          <div className="w-full max-w-[360px] space-y-1">
            {state.suggestedNames.map((name, index) => (
              <button
                key={index}
                type="button"
                className="w-full text-left px-3 py-2 rounded font-pixel text-[9px] sm:text-[10px] bg-transparent text-gray-300 border border-transparent hover:bg-gray-800 hover:border-bags-green hover:text-bags-green cursor-pointer transition-colors"
                onClick={() => handleSelect(name)}
              >
                <span className="text-white">{name.name}</span>
                <span className="text-bags-gold ml-1">(${name.symbol})</span>
                {name.description && (
                  <span className="text-gray-500 block mt-0.5 text-[8px]">{name.description}</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Sub-screen: Token Image ─── */
function TokenImageView({
  state,
  dispatch,
  onAdvance,
}: Pick<ScreenProps, "state" | "dispatch" | "onAdvance">) {
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchImage = useCallback(async () => {
    setLoading(true);
    setRevealed(false);
    setError(null);

    try {
      // Fetch logo and banner in parallel
      const [logoRes, bannerRes] = await Promise.all([
        fetch("/api/oak-generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate-logo",
            concept: state.tokenConcept,
            name: state.tokenName,
            style: state.tokenStyle,
          }),
        }),
        fetch("/api/oak-generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate-banner",
            concept: state.tokenConcept,
            name: state.tokenName,
            style: state.tokenStyle,
          }),
        }),
      ]);

      if (!logoRes.ok) throw new Error("Failed to generate logo");

      const logoData = await logoRes.json();
      dispatch({ type: "SET_TOKEN_IMAGE", url: logoData.url || logoData.imageUrl || null });

      if (bannerRes.ok) {
        const bannerData = await bannerRes.json();
        dispatch({ type: "SET_TOKEN_BANNER", url: bannerData.url || bannerData.imageUrl || null });
      }

      // Reveal animation delay
      setTimeout(() => setRevealed(true), 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed");
    } finally {
      setLoading(false);
    }
  }, [state.tokenConcept, state.tokenName, state.tokenStyle, dispatch]);

  // Fetch on mount if no image
  useEffect(() => {
    if (state.tokenImageUrl || fetchedRef.current) return;
    fetchedRef.current = true;
    fetchImage();
  }, [state.tokenImageUrl, fetchImage]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    dispatch({ type: "SET_TOKEN_IMAGE", url });
    setRevealed(true);
  };

  const handleRegenerate = () => {
    fetchedRef.current = true;
    dispatch({ type: "SET_TOKEN_IMAGE", url: null });
    dispatch({ type: "SET_TOKEN_BANNER", url: null });
    fetchImage();
  };

  return (
    <div
      className="absolute inset-0 bg-black flex flex-col items-center justify-center px-4"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      {loading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-24 h-24 rounded-full border-2 border-bags-green border-dashed animate-spin" />
          <p className="font-pixel text-[10px] text-bags-gold animate-pulse">
            Drawing your {state.tokenName || "TOKEN"}...
          </p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3">
          <p className="font-pixel text-[10px] text-red-400">{error}</p>
          <button
            type="button"
            className="font-pixel text-[10px] text-bags-green border border-bags-green px-4 py-2 rounded cursor-pointer hover:bg-bags-green hover:text-black transition-colors"
            onClick={handleRegenerate}
          >
            [RETRY]
          </button>
        </div>
      ) : (
        <>
          <h2 className="font-pixel text-[11px] sm:text-sm text-white mb-4">
            Your {state.tokenName || "TOKEN"}!
          </h2>

          {/* Image with circle reveal */}
          <div className="relative w-32 h-32 mb-4">
            {state.tokenImageUrl && (
              <div
                className="w-full h-full rounded-full overflow-hidden border-2 border-bags-green transition-all duration-700"
                style={{
                  clipPath: revealed ? "circle(50% at 50% 50%)" : "circle(0% at 50% 50%)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={state.tokenImageUrl}
                  alt={state.tokenName || "Token"}
                  className="w-full h-full object-cover"
                  style={{ imageRendering: "pixelated" }}
                />
              </div>
            )}
          </div>

          <p className="font-pixel text-[10px] text-bags-gold mb-4">
            {state.tokenName} <span className="text-gray-500">(${state.tokenSymbol})</span>
          </p>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              className="font-pixel text-[9px] text-black bg-bags-green hover:bg-green-400 px-4 py-2 rounded cursor-pointer transition-colors"
              onClick={onAdvance}
            >
              [USE THIS]
            </button>
            <button
              type="button"
              className="font-pixel text-[9px] text-bags-green border border-bags-green px-4 py-2 rounded cursor-pointer hover:bg-bags-green hover:text-black transition-colors"
              onClick={handleRegenerate}
            >
              [REGENERATE]
            </button>
            <button
              type="button"
              className="font-pixel text-[9px] text-gray-400 border border-gray-600 px-4 py-2 rounded cursor-pointer hover:border-gray-400 hover:text-gray-300 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              [UPLOAD OWN]
            </button>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
        </>
      )}
    </div>
  );
}

/* ─── Main TokenCreationScreen ─── */
export function TokenCreationScreen(props: ScreenProps) {
  const { state } = props;

  switch (state.currentScreen) {
    case "token_concept":
      return <TokenConceptView {...props} />;
    case "token_style":
      return <TokenStyleView {...props} />;
    case "token_names":
      return <TokenNamesView {...props} />;
    case "token_image":
      return <TokenImageView {...props} />;
    default:
      return <TokenConceptView {...props} />;
  }
}
