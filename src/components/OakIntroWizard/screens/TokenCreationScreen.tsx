"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import type { ScreenProps, SuggestedName } from "../types";
import { ART_STYLES, DIALOGUE } from "../constants";
import { DialogueBox } from "../DialogueBox";
import { OakSprite } from "../PixelSprites";

/** Convert a File to a base64 data URL string */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Upload + auto-resize an image via the oak-generate API */
async function uploadAndResize(file: File, width: number, height: number): Promise<string> {
  const base64 = await fileToBase64(file);

  try {
    const res = await fetch("/api/oak-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "resize-image",
        imageData: base64,
        width,
        height,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.imageUrl) return data.imageUrl;
    }
  } catch {
    // Resize failed — fall back to raw file
  }

  // Fallback: return the raw base64 data URL
  return base64;
}

/* ─── Sub-screen: Token Concept — choose AI or Custom ─── */
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
      onAdvance(); // → token_style (AI path)
    }
  };

  const handleCustom = () => {
    dispatch({ type: "SET_SCREEN", screen: "token_custom" });
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
              Describe your token idea and I&apos;ll generate everything...
            </label>
            <textarea
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="A cosmic cat exploring galaxies..."
              className="w-full bg-gray-900 border border-gray-600 text-white font-pixel text-[10px] px-3 py-2 rounded resize-none h-14 focus:border-bags-green focus:outline-none placeholder:text-gray-600"
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.code === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                className={`flex-1 font-pixel text-[10px] py-2 rounded cursor-pointer transition-colors ${concept.trim().length >= 3 ? "bg-bags-green text-black hover:bg-green-400" : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}
                onClick={handleSubmit}
                disabled={concept.trim().length < 3}
              >
                [AI GENERATE]
              </button>
              <button
                type="button"
                className="flex-1 font-pixel text-[10px] py-2 rounded cursor-pointer transition-colors bg-gray-800 text-gray-300 border border-gray-600 hover:border-gray-400 hover:text-white"
                onClick={handleCustom}
              >
                [DO IT MYSELF]
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-screen: Custom Token Creation (manual everything) ─── */
function TokenCustomView({ state, dispatch }: Pick<ScreenProps, "state" | "dispatch">) {
  const [name, setName] = useState(state.tokenName || "");
  const [symbol, setSymbol] = useState(state.tokenSymbol || "");
  const [description, setDescription] = useState(state.tokenDescription || "");
  const [twitter, setTwitter] = useState(state.tokenTwitter || "");
  const [website, setWebsite] = useState(state.tokenWebsite || "");
  const [logoPreview, setLogoPreview] = useState<string | null>(state.tokenImageUrl);
  const [bannerPreview, setBannerPreview] = useState<string | null>(state.tokenBannerUrl);
  const [resizingLogo, setResizingLogo] = useState(false);
  const [resizingBanner, setResizingBanner] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const canContinue = name.trim().length >= 1 && symbol.trim().length >= 1 && logoPreview;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResizingLogo(true);
    const resized = await uploadAndResize(file, 512, 512);
    setLogoPreview(resized);
    dispatch({ type: "SET_TOKEN_IMAGE", url: resized });
    setResizingLogo(false);
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResizingBanner(true);
    const resized = await uploadAndResize(file, 600, 200);
    setBannerPreview(resized);
    dispatch({ type: "SET_TOKEN_BANNER", url: resized });
    setResizingBanner(false);
  };

  const handleContinue = () => {
    dispatch({
      type: "SET_TOKEN_DATA",
      name: name.trim(),
      symbol: symbol.trim().toUpperCase(),
      description: description.trim(),
    });
    dispatch({ type: "SET_TOKEN_TWITTER", twitter: twitter.trim() });
    dispatch({ type: "SET_TOKEN_WEBSITE", website: website.trim() });
    // Skip AI screens, go straight to education
    dispatch({ type: "SET_SCREEN", screen: "education_fees" });
  };

  return (
    <div
      className="absolute inset-0 bg-black flex flex-col items-center px-4 pt-3 overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      <h2 className="font-pixel text-[11px] sm:text-sm text-white mb-0.5">Create your TOKEN</h2>
      <p className="font-pixel text-[7px] text-gray-500 mb-2">Fill in the details below</p>

      <div className="w-full max-w-[320px] space-y-2">
        {/* Name + Symbol row */}
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="font-pixel text-[7px] text-gray-400 mb-0.5 block">Token Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="CoolCat"
              maxLength={32}
              className="w-full bg-gray-800 border border-gray-600 text-white font-pixel text-[9px] px-2 py-1.5 rounded focus:border-bags-green focus:outline-none placeholder:text-gray-600"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
          <div className="w-[90px] flex-shrink-0">
            <label className="font-pixel text-[7px] text-gray-400 mb-0.5 block">Ticker *</label>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="$COOL"
              maxLength={10}
              className="w-full bg-gray-800 border border-gray-600 text-white font-pixel text-[9px] px-2 py-1.5 rounded focus:border-bags-green focus:outline-none placeholder:text-gray-600"
              onKeyDown={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="font-pixel text-[7px] text-gray-400 mb-0.5 block">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A cool cat token for the community..."
            maxLength={200}
            className="w-full bg-gray-800 border border-gray-600 text-white font-pixel text-[9px] px-2 py-1.5 rounded resize-none h-12 focus:border-bags-green focus:outline-none placeholder:text-gray-600"
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>

        {/* Logo + Banner uploads */}
        <div className="flex gap-2">
          {/* Logo */}
          <div className="flex-1">
            <label className="font-pixel text-[7px] text-gray-400 mb-0.5 block">
              Logo (512x512) *
            </label>
            <button
              type="button"
              className="w-full h-16 bg-gray-800 border border-dashed border-gray-600 rounded flex items-center justify-center cursor-pointer hover:border-bags-green transition-colors overflow-hidden"
              onClick={() => logoInputRef.current?.click()}
            >
              {resizingLogo ? (
                <span className="font-pixel text-[7px] text-bags-gold animate-pulse">
                  Resizing...
                </span>
              ) : logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <span className="font-pixel text-[7px] text-gray-500">Upload logo</span>
              )}
            </button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoUpload}
              className="hidden"
            />
          </div>

          {/* Banner */}
          <div className="flex-1">
            <label className="font-pixel text-[7px] text-gray-400 mb-0.5 block">
              Banner (600x200)
            </label>
            <button
              type="button"
              className="w-full h-16 bg-gray-800 border border-dashed border-gray-600 rounded flex items-center justify-center cursor-pointer hover:border-bags-green transition-colors overflow-hidden"
              onClick={() => bannerInputRef.current?.click()}
            >
              {resizingBanner ? (
                <span className="font-pixel text-[7px] text-bags-gold animate-pulse">
                  Resizing...
                </span>
              ) : bannerPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover" />
              ) : (
                <span className="font-pixel text-[7px] text-gray-500">Upload banner</span>
              )}
            </button>
            <input
              ref={bannerInputRef}
              type="file"
              accept="image/*"
              onChange={handleBannerUpload}
              className="hidden"
            />
          </div>
        </div>
        <p className="font-pixel text-[6px] text-gray-600">
          Images auto-resize to correct dimensions
        </p>

        {/* X link */}
        <div>
          <label className="font-pixel text-[7px] text-gray-400 mb-0.5 block">
            X / Twitter link
          </label>
          <input
            type="text"
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            placeholder="https://x.com/yourtoken"
            className="w-full bg-gray-800 border border-gray-600 text-white font-pixel text-[9px] px-2 py-1.5 rounded focus:border-bags-green focus:outline-none placeholder:text-gray-600"
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>

        {/* Website */}
        <div>
          <label className="font-pixel text-[7px] text-gray-400 mb-0.5 block">Website</label>
          <input
            type="text"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://yourtoken.com"
            className="w-full bg-gray-800 border border-gray-600 text-white font-pixel text-[9px] px-2 py-1.5 rounded focus:border-bags-green focus:outline-none placeholder:text-gray-600"
            onKeyDown={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      {/* Continue button */}
      <button
        type="button"
        className={`mt-3 mb-4 font-pixel text-[10px] px-8 py-2 rounded cursor-pointer transition-colors ${canContinue ? "bg-bags-green text-black hover:bg-green-400" : "bg-gray-700 text-gray-500 cursor-not-allowed"}`}
        onClick={handleContinue}
        disabled={!canContinue}
      >
        [CONTINUE]
      </button>
    </div>
  );
}

/* ─── Sub-screen: Art Style Picker ─── */
function TokenStyleView({
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

/* ─── Sub-screen: Token Image (AI path) — includes X/website fields ─── */
function TokenImageView({
  state,
  dispatch,
  onAdvance,
}: Pick<ScreenProps, "state" | "dispatch" | "onAdvance">) {
  const [loading, setLoading] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [twitter, setTwitter] = useState(state.tokenTwitter || "");
  const [website, setWebsite] = useState(state.tokenWebsite || "");
  const [resizing, setResizing] = useState(false);
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

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResizing(true);
    const resized = await uploadAndResize(file, 512, 512);
    dispatch({ type: "SET_TOKEN_IMAGE", url: resized });
    setRevealed(true);
    setResizing(false);
  };

  const handleRegenerate = () => {
    fetchedRef.current = true;
    dispatch({ type: "SET_TOKEN_IMAGE", url: null });
    dispatch({ type: "SET_TOKEN_BANNER", url: null });
    fetchImage();
  };

  const handleContinue = () => {
    dispatch({ type: "SET_TOKEN_TWITTER", twitter: twitter.trim() });
    dispatch({ type: "SET_TOKEN_WEBSITE", website: website.trim() });
    onAdvance();
  };

  return (
    <div
      className="absolute inset-0 bg-black flex flex-col items-center px-4 pt-4 overflow-y-auto"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      {loading || resizing ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
          <div className="w-24 h-24 rounded-full border-2 border-bags-green border-dashed animate-spin" />
          <p className="font-pixel text-[10px] text-bags-gold animate-pulse">
            {resizing ? "Resizing image..." : `Drawing your ${state.tokenName || "TOKEN"}...`}
          </p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3">
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
          <h2 className="font-pixel text-[11px] sm:text-sm text-white mb-2">
            Your {state.tokenName || "TOKEN"}!
          </h2>

          {/* Image with circle reveal */}
          <div className="relative w-24 h-24 mb-2">
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

          <p className="font-pixel text-[10px] text-bags-gold mb-2">
            {state.tokenName} <span className="text-gray-500">(${state.tokenSymbol})</span>
          </p>

          {/* Image action buttons */}
          <div className="flex flex-wrap gap-2 justify-center mb-3">
            <button
              type="button"
              className="font-pixel text-[8px] text-bags-green border border-bags-green px-3 py-1.5 rounded cursor-pointer hover:bg-bags-green hover:text-black transition-colors"
              onClick={handleRegenerate}
            >
              [REGENERATE]
            </button>
            <button
              type="button"
              className="font-pixel text-[8px] text-gray-400 border border-gray-600 px-3 py-1.5 rounded cursor-pointer hover:border-gray-400 hover:text-gray-300 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              [UPLOAD OWN]
            </button>
          </div>

          {/* Optional social links */}
          <div className="w-full max-w-[300px] space-y-1.5 mb-3">
            <div>
              <label className="font-pixel text-[7px] text-gray-400 mb-0.5 block">
                X / Twitter link (optional)
              </label>
              <input
                type="text"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="https://x.com/yourtoken"
                className="w-full bg-gray-800 border border-gray-600 text-white font-pixel text-[9px] px-2 py-1.5 rounded focus:border-bags-green focus:outline-none placeholder:text-gray-600"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
            <div>
              <label className="font-pixel text-[7px] text-gray-400 mb-0.5 block">
                Website (optional)
              </label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://yourtoken.com"
                className="w-full bg-gray-800 border border-gray-600 text-white font-pixel text-[9px] px-2 py-1.5 rounded focus:border-bags-green focus:outline-none placeholder:text-gray-600"
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Continue button */}
          <button
            type="button"
            className="font-pixel text-[10px] text-black bg-bags-green hover:bg-green-400 px-6 py-2 rounded cursor-pointer transition-colors mb-4"
            onClick={handleContinue}
          >
            [CONTINUE]
          </button>

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
    case "token_custom":
      return <TokenCustomView {...props} />;
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
