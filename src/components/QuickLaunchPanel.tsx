"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useMobileWallet } from "@/hooks/useMobileWallet";
import { useActionGuard } from "@/hooks/useActionGuard";
import { getEcosystemFeeShare } from "@/lib/config";
import { QuickLaunchBuildingPreview } from "@/components/QuickLaunchBuildingPreview";
import {
  type FeeShareEntry,
  type LaunchFormData,
  type NameSuggestion,
  checkDuplicateToken,
  validateFeeShares,
  estimateLaunchCost,
  executeLaunchFlow,
  generateNameSuggestions,
  generateLogo,
  generateBanner,
  validateImageFile,
} from "@/lib/launch-utils";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type ArtStyle = "pixel-art" | "cartoon" | "cute" | "minimalist" | "abstract";
type AiStep = "concept" | "style" | "pick-name";

const AI_STEPS: { key: AiStep; label: string; number: number }[] = [
  { key: "concept", label: "CONCEPT", number: 1 },
  { key: "style", label: "STYLE", number: 2 },
  { key: "pick-name", label: "PICK NAME", number: 3 },
];

const ART_STYLES: { id: ArtStyle; name: string; emoji: string }[] = [
  { id: "pixel-art", name: "Pixel Art", emoji: "[P]" },
  { id: "cartoon", name: "Cartoon", emoji: "[C]" },
  { id: "cute", name: "Kawaii", emoji: "[K]" },
  { id: "minimalist", name: "Minimal", emoji: "[M]" },
  { id: "abstract", name: "Abstract", emoji: "[A]" },
];

const ecosystemFee = getEcosystemFeeShare();

function PixelBuildLoader() {
  return (
    <span className="pixel-build-loader">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuickLaunchPanel() {
  const { publicKey, connected, mobileSignTransaction, mobileSignAndSend } = useMobileWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const guardAction = useActionGuard();

  // Form state
  const [formData, setFormData] = useState<LaunchFormData>({
    name: "",
    symbol: "",
    description: "",
    twitter: "",
    telegram: "",
    website: "",
  });
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [bannerDataUrl, setBannerDataUrl] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [feeShares, setFeeShares] = useState<FeeShareEntry[]>([
    { provider: "twitter", username: "", bps: 10000 },
  ]);
  const [initialBuySOL, setInitialBuySOL] = useState("0");
  const [showSocials, setShowSocials] = useState(false);
  const [showFeeSplit, setShowFeeSplit] = useState(false);

  // AI assist state
  const [aiOpen, setAiOpen] = useState(true);
  const [aiConcept, setAiConcept] = useState("");
  const [aiStyle, setAiStyle] = useState<ArtStyle>("pixel-art");
  const [aiNames, setAiNames] = useState<NameSuggestion[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Step progression (#3)
  const [aiStep, setAiStep] = useState<AiStep>("concept");
  const [completedSteps, setCompletedSteps] = useState<Set<AiStep>>(new Set());

  // Regeneration (#4, #5)
  const [aiSelectedName, setAiSelectedName] = useState<NameSuggestion | null>(null);
  const [isRegeneratingLogo, setIsRegeneratingLogo] = useState(false);
  const [isRegeneratingBanner, setIsRegeneratingBanner] = useState(false);

  // Hover preview (#6)
  const [hoverName, setHoverName] = useState<string | null>(null);
  const [hoverSymbol, setHoverSymbol] = useState<string | null>(null);

  // Description tracking (#8)
  const [descriptionIsAiFilled, setDescriptionIsAiFilled] = useState(false);

  // Launch state
  const [isLaunching, setIsLaunching] = useState(false);
  const [launchStatus, setLaunchStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Duplicate warnings
  const [dupWarnings, setDupWarnings] = useState<{ name: string | null; symbol: string | null }>({
    name: null,
    symbol: null,
  });

  // Prevent focus-scroll on mobile
  const formRef = useRef<HTMLDivElement>(null);

  // Check duplicates on name/symbol change
  useEffect(() => {
    const timer = setTimeout(() => {
      setDupWarnings(checkDuplicateToken(formData.name, formData.symbol));
    }, 300);
    return () => clearTimeout(timer);
  }, [formData.name, formData.symbol]);

  // Fee share math
  const userTotalBps = feeShares.reduce((sum, f) => sum + (f.username.trim() ? f.bps : 0), 0);
  const totalBps = userTotalBps + ecosystemFee.bps;
  const isValidBps = totalBps === 10000;

  // Cost estimate
  const cost = estimateLaunchCost(parseFloat(initialBuySOL) || 0);

  // Can launch?
  const canLaunch =
    connected &&
    formData.name.trim() &&
    formData.symbol.trim() &&
    formData.description.trim() &&
    imageDataUrl &&
    isValidBps &&
    !isLaunching &&
    !success;

  // CTA label
  const ctaLabel = !connected
    ? "CONNECT WALLET"
    : !formData.name.trim() || !formData.symbol.trim() || !formData.description.trim()
      ? "FILL REQUIRED FIELDS"
      : !imageDataUrl
        ? "UPLOAD LOGO"
        : !isValidBps
          ? "FIX FEE SHARES"
          : isLaunching
            ? "LAUNCHING..."
            : success
              ? "LAUNCHED!"
              : "LAUNCH TOKEN";

  // ---------------------------------------------------------------------------
  // Image handlers
  // ---------------------------------------------------------------------------

  const handleImageUpload = useCallback(
    (
      file: File,
      setPreview: (v: string) => void,
      setData: (v: string) => void,
      _type: "logo" | "banner"
    ) => {
      const err = validateImageFile(file);
      if (err) {
        setError(err);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setPreview(result);
        setData(result);
        setError(null);
      };
      reader.readAsDataURL(file);
    },
    []
  );

  // ---------------------------------------------------------------------------
  // AI Assist handlers
  // ---------------------------------------------------------------------------

  const handleAiConceptChange = (value: string) => {
    setAiConcept(value);
    // Reset steps 2+3 when concept changes
    if (completedSteps.has("style") || completedSteps.has("pick-name")) {
      setCompletedSteps(new Set(value.trim() ? ["concept"] : []));
      setAiStep(value.trim() ? "style" : "concept");
    } else if (value.trim() && !completedSteps.has("concept")) {
      setCompletedSteps(new Set(["concept"]));
      setAiStep("style");
    }
  };

  const handleAiGenerate = async () => {
    if (!aiConcept.trim()) return;
    setAiLoading(true);
    setAiError(null);
    setAiNames([]);

    // Mark concept + style as completed
    setCompletedSteps(new Set(["concept", "style"]));
    setAiStep("pick-name");

    const result = await generateNameSuggestions(aiConcept, aiStyle);
    setAiLoading(false);

    if (result.success && result.names && result.names.length > 0) {
      setAiNames(result.names);
    } else {
      setAiError(result.error || "Failed to generate names. Try again.");
      // Revert style completion on failure
      setCompletedSteps(new Set(["concept"]));
      setAiStep("style");
    }
  };

  const handleSelectName = (name: NameSuggestion) => {
    setFormData((prev) => ({
      ...prev,
      name: name.name,
      symbol: name.ticker,
      description: name.description,
    }));
    setAiSelectedName(name);
    setDescriptionIsAiFilled(true);

    // Mark all steps completed — keep aiNames visible for comparison
    setCompletedSteps(new Set(["concept", "style", "pick-name"]));

    // Generate images independently
    const concept = `${name.name} - ${aiConcept}`;

    setIsRegeneratingLogo(true);
    generateLogo(concept, aiStyle).then((logoResult) => {
      setIsRegeneratingLogo(false);
      if (logoResult.success && logoResult.imageUrl) {
        setImagePreview(logoResult.imageUrl);
        setImageDataUrl(logoResult.imageUrl);
      }
    });

    setIsRegeneratingBanner(true);
    generateBanner(concept, aiStyle).then((bannerResult) => {
      setIsRegeneratingBanner(false);
      if (bannerResult.success && bannerResult.imageUrl) {
        setBannerPreview(bannerResult.imageUrl);
        setBannerDataUrl(bannerResult.imageUrl);
      }
    });
  };

  const handleRegenerateNames = async () => {
    if (!aiConcept.trim() || aiLoading) return;
    setAiLoading(true);
    setAiError(null);

    const result = await generateNameSuggestions(aiConcept, aiStyle);
    setAiLoading(false);

    if (result.success && result.names && result.names.length > 0) {
      setAiNames(result.names);
    } else {
      setAiError(result.error || "Failed to regenerate names. Try again.");
    }
  };

  const handleRegenerateLogo = async () => {
    if (isRegeneratingLogo || !aiConcept.trim()) return;
    setIsRegeneratingLogo(true);

    const name = aiSelectedName?.name ?? formData.name;
    const concept = `${name} - ${aiConcept} variation ${Date.now()}`;
    const result = await generateLogo(concept, aiStyle);

    setIsRegeneratingLogo(false);
    if (result.success && result.imageUrl) {
      setImagePreview(result.imageUrl);
      setImageDataUrl(result.imageUrl);
    }
  };

  const handleRegenerateBanner = async () => {
    if (isRegeneratingBanner || !aiConcept.trim()) return;
    setIsRegeneratingBanner(true);

    const name = aiSelectedName?.name ?? formData.name;
    const concept = `${name} - ${aiConcept} variation ${Date.now()}`;
    const result = await generateBanner(concept, aiStyle);

    setIsRegeneratingBanner(false);
    if (result.success && result.imageUrl) {
      setBannerPreview(result.imageUrl);
      setBannerDataUrl(result.imageUrl);
    }
  };

  // ---------------------------------------------------------------------------
  // Fee share handlers
  // ---------------------------------------------------------------------------

  const addFeeShare = () => {
    if (feeShares.length < 10) {
      setFeeShares([...feeShares, { provider: "twitter", username: "", bps: 100 }]);
    }
  };

  const removeFeeShare = (index: number) => {
    setFeeShares(feeShares.filter((_, i) => i !== index));
  };

  const updateFeeShare = (index: number, field: keyof FeeShareEntry, value: string | number) => {
    const updated = [...feeShares];
    updated[index] = { ...updated[index], [field]: value };
    setFeeShares(updated);
  };

  // ---------------------------------------------------------------------------
  // Launch handler
  // ---------------------------------------------------------------------------

  const handleLaunch = async () => {
    if (!connected || !publicKey) {
      setWalletModalVisible(true);
      return;
    }
    if (!canLaunch) return;

    setIsLaunching(true);
    setError(null);
    setSuccess(null);
    setLaunchStatus("");

    try {
      const result = await executeLaunchFlow({
        formData,
        imageDataUrl: imageDataUrl!,
        bannerDataUrl,
        feeShares,
        initialBuySOL: parseFloat(initialBuySOL) || 0,
        walletPublicKey: publicKey.toBase58(),
        signTransaction: mobileSignTransaction,
        signAndSend: mobileSignAndSend,
        onStatus: setLaunchStatus,
      });

      setLaunchStatus("");
      if (result.globalSaved) {
        setSuccess(
          `Token $${formData.symbol} launched on Bags.fm! Your building is now visible to ALL BagsWorld players!`
        );
      } else {
        setSuccess(`Token $${formData.symbol} launched on Bags.fm! Building visible locally.`);
      }
    } catch (err) {
      setLaunchStatus("");
      const msg = err instanceof Error ? err.message : "Failed to launch token";
      if (msg.toLowerCase().includes("internal server error")) {
        setError("Bags.fm API is temporarily unavailable. Please try again in a few minutes.");
      } else if (
        msg.toLowerCase().includes("user rejected") ||
        msg.toLowerCase().includes("cancelled")
      ) {
        setError("Transaction was cancelled. Click Launch to try again.");
      } else if (
        msg.toLowerCase().includes("insufficient") ||
        msg.toLowerCase().includes("balance")
      ) {
        setError("Insufficient SOL balance. Please add more SOL and try again.");
      } else {
        setError(msg);
      }
    } finally {
      setIsLaunching(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div ref={formRef} className="space-y-4">
      {/* 2-column layout: form left, preview right */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* ============================================================== */}
        {/* LEFT COLUMN — Form */}
        {/* ============================================================== */}
        <div className="flex-1 space-y-4 min-w-0">
          {/* A. AI Assist */}
          <div className="bg-black/40 border-2 border-bags-green/30">
            <button
              onClick={() => setAiOpen(!aiOpen)}
              className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
            >
              <span className="font-pixel text-[10px] text-bags-green">
                [AI] AI ASSIST — Generate name, logo & banner
              </span>
              <span className="font-pixel text-[10px] text-gray-500">{aiOpen ? "[-]" : "[+]"}</span>
            </button>

            {aiOpen && (
              <div className="px-3 pb-3 space-y-3 border-t border-bags-green/20">
                {/* Step Progress Bar (#3) */}
                <div className="flex items-center justify-between mt-3 px-1">
                  {AI_STEPS.map((step, i) => {
                    const isCompleted = completedSteps.has(step.key);
                    const isActive = aiStep === step.key;
                    return (
                      <div key={step.key} className="flex items-center">
                        <div className="flex items-center gap-1.5">
                          <div
                            className={`w-5 h-5 flex items-center justify-center border font-pixel text-[7px] ${
                              isCompleted
                                ? "bg-bags-green text-bags-dark border-bags-green"
                                : isActive
                                  ? "border-bags-green text-bags-green animate-pulse"
                                  : "border-gray-600 text-gray-600"
                            }`}
                          >
                            {isCompleted ? "+" : step.number}
                          </div>
                          <span
                            className={`font-pixel text-[7px] ${
                              isCompleted
                                ? "text-bags-green"
                                : isActive
                                  ? "text-bags-green"
                                  : "text-gray-600"
                            }`}
                          >
                            {step.label}
                          </span>
                        </div>
                        {i < AI_STEPS.length - 1 && (
                          <div
                            className={`w-6 sm:w-10 h-px mx-1.5 ${
                              completedSteps.has(AI_STEPS[i + 1].key) ||
                              aiStep === AI_STEPS[i + 1].key
                                ? "bg-bags-green/50"
                                : "bg-gray-700"
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Concept input */}
                <div>
                  <label className="block font-pixel text-[8px] text-gray-400 mb-1">
                    TOKEN CONCEPT
                  </label>
                  <input
                    type="text"
                    value={aiConcept}
                    onChange={(e) => handleAiConceptChange(e.target.value)}
                    placeholder="e.g. a space cat exploring galaxies"
                    className="w-full bg-bags-darker border-2 border-bags-green p-2 font-pixel text-xs text-white focus:outline-none focus:border-bags-gold min-h-[44px]"
                  />
                  <p className="font-pixel text-[7px] text-gray-500 mt-1">
                    Describe the theme, idea, or story behind your token
                  </p>
                </div>

                {/* Style selector */}
                <div className="flex flex-wrap gap-1">
                  {ART_STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setAiStyle(s.id)}
                      className={`px-2 py-1.5 font-pixel text-[8px] border transition-all min-h-[36px] ${
                        aiStyle === s.id
                          ? "bg-bags-green text-bags-dark border-bags-green"
                          : "bg-transparent text-gray-400 border-gray-600 hover:border-bags-green/50"
                      }`}
                    >
                      {s.emoji} {s.name}
                    </button>
                  ))}
                </div>

                {/* Generate button with pixel-build loader (#7) */}
                <button
                  onClick={handleAiGenerate}
                  disabled={aiLoading || !aiConcept.trim()}
                  className="w-full py-2 bg-bags-green/20 border-2 border-bags-green font-pixel text-[10px] text-bags-green hover:bg-bags-green/30 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2"
                >
                  {aiLoading ? (
                    <>
                      <PixelBuildLoader /> GENERATING...
                    </>
                  ) : (
                    "GENERATE 5 NAMES"
                  )}
                </button>

                {/* Error */}
                {aiError && (
                  <div className="bg-red-500/20 border-2 border-red-500 p-2">
                    <p className="font-pixel text-[8px] text-red-400">{aiError}</p>
                  </div>
                )}

                {/* Name suggestions with hover (#6) */}
                {aiNames.length > 0 && (
                  <div className="space-y-1">
                    <p className="font-pixel text-[8px] text-gray-400">Click to select:</p>
                    {aiNames.map((n, i) => {
                      const isSelected =
                        aiSelectedName?.ticker === n.ticker && aiSelectedName?.name === n.name;
                      return (
                        <button
                          key={i}
                          onClick={() => handleSelectName(n)}
                          onMouseEnter={() => {
                            setHoverName(n.name);
                            setHoverSymbol(n.ticker);
                          }}
                          onMouseLeave={() => {
                            setHoverName(null);
                            setHoverSymbol(null);
                          }}
                          className={`w-full p-2 border transition-all text-left ${
                            isSelected
                              ? "bg-bags-green/20 border-bags-green"
                              : "bg-bags-green/10 border-bags-green/30 hover:bg-bags-green/20 hover:border-bags-green"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-pixel text-[10px] text-white">{n.name}</span>
                            <span className="font-pixel text-[9px] text-bags-green">
                              ${n.ticker}
                            </span>
                          </div>
                          <p className="font-pixel text-[7px] text-gray-400 mt-1 line-clamp-2">
                            {n.description}
                          </p>
                        </button>
                      );
                    })}

                    {/* Regenerate names button (#4) */}
                    <button
                      onClick={handleRegenerateNames}
                      disabled={aiLoading}
                      className="w-full py-1.5 border border-dashed border-bags-green/50 font-pixel text-[8px] text-bags-green/70 hover:text-bags-green hover:border-bags-green disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px] flex items-center justify-center gap-2 mt-2"
                    >
                      {aiLoading ? (
                        <>
                          <PixelBuildLoader /> REGENERATING...
                        </>
                      ) : (
                        "REGENERATE 5 NAMES"
                      )}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* B. Token Form */}
          <div className="bg-black/40 border-2 border-bags-green/30 p-3 space-y-3">
            {/* Images row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Logo */}
              <div className="space-y-1">
                <p className="font-pixel text-[8px] text-gray-400 text-center">LOGO (512x512) *</p>
                <label className="cursor-pointer block">
                  <div
                    className={`aspect-square bg-bags-darker border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors ${
                      isRegeneratingLogo
                        ? "border-bags-green animate-pulse"
                        : "border-bags-green hover:border-bags-gold"
                    }`}
                  >
                    {isRegeneratingLogo ? (
                      <div className="flex flex-col items-center gap-2">
                        <PixelBuildLoader />
                        <span className="font-pixel text-[7px] text-bags-green animate-pulse">
                          GENERATING LOGO...
                        </span>
                      </div>
                    ) : imagePreview ? (
                      <img src={imagePreview} alt="Logo" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-pixel text-[8px] text-gray-500 text-center px-1">
                        CLICK TO UPLOAD
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImageUpload(f, setImagePreview, setImageDataUrl, "logo");
                    }}
                    className="hidden"
                  />
                </label>
                {/* Regenerate logo button (#5) */}
                {imagePreview && aiConcept.trim() && !isRegeneratingLogo && (
                  <button
                    onClick={handleRegenerateLogo}
                    className="w-full py-1 font-pixel text-[7px] text-bags-green/60 hover:text-bags-green border border-transparent hover:border-bags-green/30 transition-colors inline-action"
                  >
                    [R] NEW LOGO
                  </button>
                )}
              </div>

              {/* Banner */}
              <div className="space-y-1">
                <p className="font-pixel text-[8px] text-gray-400 text-center">BANNER (600x200)</p>
                <label className="cursor-pointer block">
                  <div
                    className={`aspect-[3/1] bg-bags-darker border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors ${
                      isRegeneratingBanner
                        ? "border-bags-green animate-pulse"
                        : "border-gray-600 hover:border-bags-gold"
                    }`}
                  >
                    {isRegeneratingBanner ? (
                      <div className="flex flex-col items-center gap-1">
                        <PixelBuildLoader />
                        <span className="font-pixel text-[6px] text-bags-green animate-pulse">
                          GENERATING BANNER...
                        </span>
                      </div>
                    ) : bannerPreview ? (
                      <img
                        src={bannerPreview}
                        alt="Banner"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-pixel text-[7px] text-gray-500 text-center px-1">
                        OPTIONAL
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImageUpload(f, setBannerPreview, setBannerDataUrl, "banner");
                    }}
                    className="hidden"
                  />
                </label>
                <p className="font-pixel text-[6px] text-gray-500 text-center">
                  3:1 ratio for DexScreener
                </p>
                {/* Regenerate banner button (#5) */}
                {bannerPreview && aiConcept.trim() && !isRegeneratingBanner && (
                  <button
                    onClick={handleRegenerateBanner}
                    className="w-full py-1 font-pixel text-[7px] text-bags-green/60 hover:text-bags-green border border-transparent hover:border-bags-green/30 transition-colors inline-action"
                  >
                    [R] NEW BANNER
                  </button>
                )}
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="block font-pixel text-[10px] text-gray-400 mb-1">
                TOKEN NAME *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Awesome Token"
                className={`w-full bg-bags-darker border-2 p-2 font-pixel text-xs text-white focus:outline-none min-h-[44px] ${
                  dupWarnings.name
                    ? "border-yellow-500 focus:border-yellow-400"
                    : "border-bags-green focus:border-bags-gold"
                }`}
              />
              <p className="font-pixel text-[7px] text-gray-500 mt-0.5">
                Appears on your building sign in BagsWorld
              </p>
              {dupWarnings.name && (
                <p className="font-pixel text-[8px] text-yellow-400 mt-1">{dupWarnings.name}</p>
              )}
            </div>

            {/* Symbol */}
            <div>
              <label className="block font-pixel text-[10px] text-gray-400 mb-1">SYMBOL *</label>
              <input
                type="text"
                value={formData.symbol}
                onChange={(e) =>
                  setFormData({ ...formData, symbol: e.target.value.toUpperCase().trim() })
                }
                placeholder="TOKEN"
                maxLength={10}
                className={`w-full bg-bags-darker border-2 p-2 font-pixel text-xs text-white focus:outline-none min-h-[44px] ${
                  dupWarnings.symbol
                    ? "border-yellow-500 focus:border-yellow-400"
                    : "border-bags-green focus:border-bags-gold"
                }`}
              />
              <p className="font-pixel text-[7px] text-gray-500 mt-0.5">
                Short ticker like $DOGE — max 10 characters
              </p>
              {dupWarnings.symbol && (
                <p className="font-pixel text-[8px] text-yellow-400 mt-1">{dupWarnings.symbol}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block font-pixel text-[10px] text-gray-400 mb-1">
                DESCRIPTION *
              </label>
              {descriptionIsAiFilled && (
                <div className="font-pixel text-[7px] text-bags-green/60 mb-1">
                  [AI GENERATED - EDIT BELOW]
                </div>
              )}
              <textarea
                value={formData.description}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value });
                  if (descriptionIsAiFilled) setDescriptionIsAiFilled(false);
                }}
                placeholder="Describe your token..."
                className="w-full bg-bags-darker border-2 border-bags-green p-2 font-pixel text-xs text-white focus:outline-none focus:border-bags-gold h-20 resize-none"
              />
              <p className="font-pixel text-[7px] text-gray-500 mt-0.5">
                Shown when players click your building
              </p>
            </div>

            {/* Social links (collapsible) */}
            <div>
              <button
                onClick={() => setShowSocials(!showSocials)}
                className="font-pixel text-[8px] text-gray-400 hover:text-bags-green transition-colors"
              >
                {showSocials ? "[-] SOCIAL LINKS" : "[+] SOCIAL LINKS (OPTIONAL)"}
              </button>
              {showSocials && (
                <div className="mt-2 space-y-2">
                  <input
                    type="url"
                    value={formData.twitter ?? ""}
                    onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                    placeholder="https://x.com/..."
                    className="w-full bg-bags-darker border-2 border-bags-green p-2 font-pixel text-[10px] text-white focus:outline-none focus:border-bags-gold min-h-[44px]"
                  />
                  <input
                    type="url"
                    value={formData.telegram ?? ""}
                    onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
                    placeholder="https://t.me/..."
                    className="w-full bg-bags-darker border-2 border-bags-green p-2 font-pixel text-[10px] text-white focus:outline-none focus:border-bags-gold min-h-[44px]"
                  />
                  <input
                    type="url"
                    value={formData.website ?? ""}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-bags-darker border-2 border-bags-green p-2 font-pixel text-[10px] text-white focus:outline-none focus:border-bags-gold min-h-[44px]"
                  />
                </div>
              )}
            </div>
          </div>

          {/* C. Fee Sharing */}
          <div className="bg-black/40 border-2 border-bags-green/30 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-pixel text-[10px] text-gray-400">FEE SHARING</p>
              <span
                className={`font-pixel text-[8px] px-2 py-0.5 border ${
                  isValidBps
                    ? "border-bags-green/40 text-bags-green bg-bags-green/10"
                    : "border-red-500/40 text-red-400 bg-red-500/10"
                }`}
              >
                {(totalBps / 100).toFixed(1)}%{!isValidBps && " (MUST = 100%)"}
              </span>
            </div>

            {/* Ecosystem fee badge */}
            {ecosystemFee.bps > 0 && (
              <div className="flex justify-between font-pixel text-[8px] p-2 bg-bags-gold/10 border border-bags-gold/30">
                <span className="text-bags-gold">{ecosystemFee.providerUsername}</span>
                <span className="text-bags-gold">{ecosystemFee.bps / 100}%</span>
              </div>
            )}

            {/* Default single creator row */}
            {!showFeeSplit && (
              <div className="flex items-center gap-2">
                <select
                  value={feeShares[0]?.provider ?? "twitter"}
                  onChange={(e) => updateFeeShare(0, "provider", e.target.value)}
                  className="bg-bags-darker border border-bags-green p-2 font-pixel text-[8px] text-white min-h-[44px]"
                >
                  <option value="twitter">Twitter</option>
                  <option value="moltbook">Moltbook</option>
                  <option value="github">GitHub</option>
                  <option value="kick">Kick</option>
                  <option value="tiktok">TikTok</option>
                  <option value="instagram">Instagram</option>
                </select>
                <input
                  type="text"
                  value={feeShares[0]?.username ?? ""}
                  onChange={(e) => updateFeeShare(0, "username", e.target.value)}
                  placeholder="@your_username"
                  className="flex-1 bg-bags-darker border border-bags-green p-2 font-pixel text-[8px] text-white min-h-[44px]"
                />
                <span className="font-pixel text-[8px] text-bags-green whitespace-nowrap">
                  100%
                </span>
              </div>
            )}

            {/* Expanded fee editor */}
            {showFeeSplit && (
              <div className="space-y-2">
                {feeShares.map((share, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      value={share.provider}
                      onChange={(e) => updateFeeShare(index, "provider", e.target.value)}
                      className="bg-bags-darker border border-bags-green p-2 font-pixel text-[8px] text-white min-h-[44px]"
                    >
                      <option value="twitter">Twitter</option>
                      <option value="moltbook">Moltbook</option>
                      <option value="github">GitHub</option>
                      <option value="kick">Kick</option>
                      <option value="tiktok">TikTok</option>
                      <option value="instagram">Instagram</option>
                    </select>
                    <input
                      type="text"
                      value={share.username}
                      onChange={(e) => updateFeeShare(index, "username", e.target.value)}
                      placeholder="@username"
                      className="flex-1 bg-bags-darker border border-bags-green p-2 font-pixel text-[8px] text-white min-h-[44px]"
                    />
                    <input
                      type="number"
                      value={share.bps / 100}
                      onChange={(e) =>
                        updateFeeShare(
                          index,
                          "bps",
                          Math.min(10000, Math.max(0, (parseFloat(e.target.value) || 0) * 100))
                        )
                      }
                      className="w-16 bg-bags-darker border border-bags-green p-2 font-pixel text-[8px] text-white text-center min-h-[44px]"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                    <span className="font-pixel text-[8px] text-gray-400">%</span>
                    {feeShares.length > 1 && (
                      <button
                        onClick={() => removeFeeShare(index)}
                        className="text-red-400 font-pixel text-[10px] hover:text-red-300 min-w-[24px] min-h-[44px]"
                      >
                        X
                      </button>
                    )}
                  </div>
                ))}
                {feeShares.length < 10 && (
                  <button
                    onClick={addFeeShare}
                    className="w-full py-2 border-2 border-dashed border-bags-green/50 font-pixel text-[8px] text-bags-green hover:border-bags-green min-h-[44px]"
                  >
                    + ADD FEE CLAIMER
                  </button>
                )}
              </div>
            )}

            <button
              onClick={() => setShowFeeSplit(!showFeeSplit)}
              className="font-pixel text-[8px] text-gray-400 hover:text-bags-green transition-colors"
            >
              {showFeeSplit ? "[-] SIMPLE MODE" : "[+] SPLIT FEES WITH OTHERS"}
            </button>

            <p className="font-pixel text-[7px] text-gray-500">
              Fee claimers need a wallet linked at bags.fm/settings
            </p>
          </div>

          {/* D. Initial Buy */}
          <div className="bg-black/40 border-2 border-bags-green/30 p-3 space-y-2">
            <p className="font-pixel text-[10px] text-gray-400">INITIAL BUY (OPTIONAL)</p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={initialBuySOL}
                onChange={(e) => setInitialBuySOL(e.target.value)}
                placeholder="0"
                min="0"
                step="0.1"
                className="flex-1 bg-bags-darker border-2 border-bags-green p-2 font-pixel text-xs text-white text-center focus:outline-none focus:border-bags-gold min-h-[44px]"
              />
              <span className="font-pixel text-[10px] text-gray-400">SOL</span>
            </div>
            <p className="font-pixel text-[7px] text-gray-500">
              {parseFloat(initialBuySOL || "0") > 0
                ? `You'll buy ${initialBuySOL} SOL worth of your token at launch`
                : "Set to 0 to launch without buying"}
            </p>
          </div>

          {/* Status / Error / Success */}
          {launchStatus && (
            <div className="bg-purple-500/20 border-2 border-purple-500 p-2">
              <p className="font-pixel text-[8px] text-purple-400 animate-pulse">{launchStatus}</p>
            </div>
          )}
          {error && (
            <div className="bg-red-500/20 border-2 border-red-500 p-2">
              <p className="font-pixel text-[8px] text-red-400">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-bags-green/20 border-2 border-bags-green p-2">
              <p className="font-pixel text-[8px] text-bags-green">{success}</p>
            </div>
          )}

          {/* E. Launch Button */}
          <button
            onClick={() => {
              if (!connected) {
                setWalletModalVisible(true);
                return;
              }
              guardAction(handleLaunch);
            }}
            disabled={connected && !canLaunch}
            className={`w-full py-3 font-pixel text-xs min-h-[48px] transition-all ${
              !connected
                ? "bg-bags-green/20 border-2 border-bags-green text-bags-green hover:bg-bags-green/30"
                : canLaunch
                  ? "btn-retro"
                  : "bg-gray-700/50 border-2 border-gray-600 text-gray-500 cursor-not-allowed"
            }`}
          >
            {ctaLabel}
          </button>
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN — Preview + Info (hidden on very small mobile) */}
        {/* ============================================================== */}
        <div className="w-full sm:w-64 shrink-0 space-y-4">
          {/* Building Preview (#6 — hover preview) */}
          <QuickLaunchBuildingPreview
            name={hoverName || formData.name}
            symbol={hoverSymbol || formData.symbol}
            logoUrl={imagePreview}
            level={1}
          />

          {/* Cost Estimator */}
          <div className="bg-black/40 border-2 border-bags-green/30 p-3 space-y-2">
            <p className="font-pixel text-[8px] text-gray-500">COST ESTIMATE</p>
            <div className="space-y-1">
              <div className="flex justify-between font-pixel text-[8px]">
                <span className="text-gray-400">Network fees</span>
                <span className="text-gray-300">~{cost.network} SOL</span>
              </div>
              {cost.initialBuy > 0 && (
                <div className="flex justify-between font-pixel text-[8px]">
                  <span className="text-gray-400">Initial buy</span>
                  <span className="text-gray-300">{cost.initialBuy} SOL</span>
                </div>
              )}
              <div className="flex justify-between font-pixel text-[10px] pt-1 border-t border-bags-green/20">
                <span className="text-white">Total</span>
                <span className="text-bags-green">~{cost.total.toFixed(3)} SOL</span>
              </div>
            </div>
          </div>

          {/* Why Launch Here */}
          <div className="bg-black/40 border-2 border-bags-green/30 p-3 space-y-2">
            <p className="font-pixel text-[8px] text-gray-500">WHY LAUNCH HERE?</p>
            <div className="space-y-1.5">
              {[
                { icon: "[B]", text: "Your token becomes a living building" },
                { icon: "[F]", text: "Earn trading fees on every trade" },
                { icon: "[0]", text: "Zero extra BagsWorld fees" },
                { icon: "[AI]", text: "AI-generated names, logos & banners" },
              ].map((item) => (
                <div key={item.icon} className="flex items-start gap-2">
                  <span className="font-pixel text-[8px] text-bags-green shrink-0">
                    {item.icon}
                  </span>
                  <span className="font-pixel text-[7px] text-gray-400">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
