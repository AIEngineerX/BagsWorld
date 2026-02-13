"use client";

import { useState, useEffect } from "react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useMobileWallet } from "@/hooks/useMobileWallet";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";
import { useActionGuard } from "@/hooks/useActionGuard";
import { getAllWorldTokens } from "@/lib/token-registry";
import { ECOSYSTEM_CONFIG, getEcosystemFeeShare } from "@/lib/config";
import { executeLaunchFlow } from "@/lib/launch-flow";

interface FeeShareEntry {
  provider: string;
  username: string;
  bps: number; // basis points (100 = 1%)
}

// Get ecosystem config
const ecosystemFee = getEcosystemFeeShare();

interface LaunchModalProps {
  onClose: () => void;
  onLaunchSuccess?: () => void;
}

export function LaunchModal({ onClose, onLaunchSuccess }: LaunchModalProps) {
  const { publicKey, connected, mobileSignTransaction, mobileSignAndSend } = useMobileWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { translateY, isDismissing, handlers: swipeHandlers } = useSwipeToDismiss(onClose);
  const guardAction = useActionGuard();

  // Escape key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    description: "",
    twitter: "",
    telegram: "",
    website: "",
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [bannerDataUrl, setBannerDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const [launchStatus, setLaunchStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [step, setStep] = useState<"info" | "fees" | "confirm">("info");
  const [initialBuySOL, setInitialBuySOL] = useState<string>("0"); // SOL amount to buy at launch
  const [feeShares, setFeeShares] = useState<FeeShareEntry[]>([
    { provider: "twitter", username: "", bps: 10000 }, // Default 100% to creator
  ]);

  // Duplicate name/symbol warnings
  const [duplicateWarning, setDuplicateWarning] = useState<{
    name: string | null;
    symbol: string | null;
  }>({ name: null, symbol: null });

  // Check for duplicate names/symbols when form data changes
  useEffect(() => {
    const existingTokens = getAllWorldTokens();
    const warnings = { name: null as string | null, symbol: null as string | null };

    if (formData.name.trim()) {
      const duplicateName = existingTokens.find(
        (t) => t.name.toLowerCase() === formData.name.trim().toLowerCase()
      );
      if (duplicateName) {
        warnings.name = `A token named "${duplicateName.name}" already exists`;
      }
    }

    if (formData.symbol.trim()) {
      const symbolToCheck = formData.symbol.trim().toUpperCase().replace(/^\$/, "");
      const duplicateSymbol = existingTokens.find((t) => t.symbol.toUpperCase() === symbolToCheck);
      if (duplicateSymbol) {
        warnings.symbol = `Symbol $${duplicateSymbol.symbol} is already in use`;
      }
    }

    setDuplicateWarning(warnings);
  }, [formData.name, formData.symbol]);

  // Notify quest tracker that the launch modal was opened
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("bagsworld-launch-opened"));
  }, []);

  // Listen for pre-fill events from Professor Oak AI Generator
  useEffect(() => {
    const handlePrefill = (e: Event) => {
      const event = e as CustomEvent<{
        name?: string;
        symbol?: string;
        description?: string;
        logo?: string;
        banner?: string;
      }>;

      const { name, symbol, description, logo, banner } = event.detail;

      // Update form data
      setFormData((prev) => ({
        ...prev,
        name: name || prev.name,
        symbol: symbol || prev.symbol,
        description: description || prev.description,
      }));

      // Set logo if provided
      if (logo) {
        setImagePreview(logo);
        setImageDataUrl(logo);
      }

      // Set banner if provided
      if (banner) {
        setBannerPreview(banner);
        setBannerDataUrl(banner);
      }

      setPrefilled(true);
    };

    window.addEventListener("bagsworld-launch-prefill", handlePrefill);
    return () => {
      window.removeEventListener("bagsworld-launch-prefill", handlePrefill);
    };
  }, []);

  const userTotalBps = feeShares.reduce((sum, f) => sum + (f.username ? f.bps : 0), 0);
  const totalBps = userTotalBps + ecosystemFee.bps; // Include ecosystem fee
  const isValidBps = totalBps === 10000; // Must equal exactly 100% (Bags.fm requirement)

  // Image dimension warnings (not errors, just warnings)
  const [logoWarning, setLogoWarning] = useState<string | null>(null);
  const [bannerWarning, setBannerWarning] = useState<string | null>(null);
  const [isResizingLogo, setIsResizingLogo] = useState(false);
  const [isResizingBanner, setIsResizingBanner] = useState(false);

  // Validate image dimensions and load it
  const validateAndLoadImage = (
    file: File,
    expectedWidth: number,
    expectedHeight: number,
    setPreview: (url: string) => void,
    setDataUrl: (url: string) => void,
    setWarning: (warning: string | null) => void,
    imageType: "logo" | "banner"
  ) => {
    // File size check (max 10MB)
    const maxSizeMB = 10;
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(
        `${imageType === "logo" ? "Logo" : "Banner"} file is too large. Maximum size is ${maxSizeMB}MB.`
      );
      return;
    }

    // Validate file type
    const validTypes = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
    if (!validTypes.includes(file.type)) {
      setError(`Invalid file type. Please upload PNG, JPG, GIF, WEBP, or SVG.`);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => {
      setError(`Failed to read ${imageType} file. Please try again.`);
    };
    reader.onloadend = () => {
      const result = reader.result as string;

      // Create an Image to check dimensions
      const img = new Image();
      img.onload = () => {
        const width = img.naturalWidth;
        const height = img.naturalHeight;

        // Check dimensions and set warning if not optimal
        if (imageType === "logo") {
          if (width !== height) {
            setWarning(`Logo is ${width}x${height}px (not square). Recommended: 512x512px square.`);
          } else if (width < 256) {
            setWarning(
              `Logo is only ${width}x${height}px. Recommended: at least 512x512px for best quality.`
            );
          } else if (width !== 512) {
            setWarning(`Logo is ${width}x${height}px. Recommended: 512x512px.`);
          } else {
            setWarning(null);
          }
        } else {
          // Banner: check 3:1 ratio
          const ratio = width / height;
          if (Math.abs(ratio - 3) > 0.1) {
            setWarning(
              `Banner is ${width}x${height}px (${ratio.toFixed(1)}:1 ratio). Recommended: 600x200px (3:1 ratio) for DexScreener.`
            );
          } else if (width < 600) {
            setWarning(`Banner is only ${width}x${height}px. Recommended: at least 600x200px.`);
          } else {
            setWarning(null);
          }
        }

        // Set the preview and data URL regardless of warnings
        setPreview(result);
        setDataUrl(result);
      };
      img.onerror = () => {
        setError(`Failed to load ${imageType} image. The file may be corrupted.`);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  // Auto-resize image to target dimensions using the API
  const autoResizeImage = async (
    imageType: "logo" | "banner",
    currentDataUrl: string,
    targetWidth: number,
    targetHeight: number,
    setPreview: (url: string) => void,
    setDataUrl: (url: string) => void,
    setWarning: (warning: string | null) => void,
    setResizing: (resizing: boolean) => void
  ) => {
    setResizing(true);
    setError(null);

    const response = await fetch("/api/oak-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "resize-image",
        imageData: currentDataUrl,
        targetWidth,
        targetHeight,
      }),
    });

    setResizing(false);

    if (!response.ok) {
      setError(`Failed to resize ${imageType}. Please try again.`);
      return;
    }

    const data = await response.json();
    if (data.success && data.imageUrl) {
      setPreview(data.imageUrl);
      setDataUrl(data.imageUrl);
      setWarning(null);
    } else {
      setError(data.error || `Failed to resize ${imageType}.`);
    }
  };

  const handleResizeLogo = () => {
    if (!imageDataUrl) return;
    autoResizeImage(
      "logo",
      imageDataUrl,
      512,
      512,
      setImagePreview,
      setImageDataUrl,
      setLogoWarning,
      setIsResizingLogo
    );
  };

  const handleResizeBanner = () => {
    if (!bannerDataUrl) return;
    autoResizeImage(
      "banner",
      bannerDataUrl,
      600,
      200,
      setBannerPreview,
      setBannerDataUrl,
      setBannerWarning,
      setIsResizingBanner
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setError(null);
      validateAndLoadImage(
        file,
        512,
        512,
        setImagePreview,
        setImageDataUrl,
        setLogoWarning,
        "logo"
      );
    }
  };

  const handleBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setError(null);
      validateAndLoadImage(
        file,
        600,
        200,
        setBannerPreview,
        setBannerDataUrl,
        setBannerWarning,
        "banner"
      );
    }
  };

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

  const handleNextStep = () => {
    if (step === "info") {
      if (!formData.name || !formData.symbol || !formData.description) {
        setError("Please fill in all required fields");
        return;
      }
      if (!imageDataUrl) {
        setError("Please upload a token image");
        return;
      }
      setError(null);
      setStep("fees");
    } else if (step === "fees") {
      if (!isValidBps) {
        setError(
          `Total fee share must equal exactly 100%. Currently ${(totalBps / 100).toFixed(1)}%`
        );
        return;
      }
      // Check at least one fee claimer has a username
      const validFeeShares = feeShares.filter((f) => f.username.trim());
      if (validFeeShares.length === 0) {
        setError("Add at least one fee claimer with a username");
        return;
      }
      setError(null);
      setStep("confirm");
    }
  };

  const handleBack = () => {
    setError(null);
    if (step === "fees") setStep("info");
    if (step === "confirm") setStep("fees");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Check for wallet connection
      if (!connected || !publicKey) {
        setError("Connect your Solana wallet first!");
        setWalletModalVisible(true);
        setIsLoading(false);
        return;
      }

      // Validate image is provided (Bags.fm API requires an image)
      if (!imageDataUrl) {
        setError("Please upload a token image. This is required by Bags.fm.");
        setIsLoading(false);
        return;
      }

      // Build fee claimers from the UI fee share entries
      const validFeeShares = feeShares.filter((f) => f.username.trim());
      const feeClaimers = validFeeShares.map((f) => ({
        provider: f.provider,
        providerUsername: f.username.replace(/@/g, "").trim(),
        bps: f.bps,
      }));

      const result = await executeLaunchFlow({
        tokenData: {
          name: formData.name,
          symbol: formData.symbol,
          description: formData.description,
          image: imageDataUrl,
          twitter: formData.twitter || undefined,
          telegram: formData.telegram || undefined,
          website: formData.website || undefined,
        },
        feeShares: feeClaimers,
        initialBuySOL,
        walletPublicKey: publicKey,
        signTransaction: mobileSignTransaction,
        signAndSendTransaction: mobileSignAndSend,
        onStatus: setLaunchStatus,
      });

      if (result.success) {
        if (result.globalSaveSuccess) {
          setSuccess(
            `🎉 Token ${formData.symbol} launched on Bags.fm! Your building is now visible to ALL BagsWorld players!`
          );
        } else {
          setSuccess(
            `🎉 Token ${formData.symbol} launched on Bags.fm! Building visible locally. (Global database not configured)`
          );
        }

        // Call the success callback to refresh the world state
        if (onLaunchSuccess) {
          onLaunchSuccess();
        }

        // Auto-close after a short delay
        setTimeout(() => {
          onClose();
        }, 3000);
      } else {
        setError(result.error || "Failed to launch token");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Prevent clicks from going through to the game
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-[100] safe-area-bottom"
      onClick={handleBackdropClick}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className={`bg-bags-dark border-4 border-bags-green w-full sm:max-w-md max-h-[85vh] sm:max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-xl ${isDismissing ? "modal-sheet-dismiss" : ""}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        {...swipeHandlers}
        style={{
          transform: translateY > 0 ? `translateY(${translateY}px)` : undefined,
          transition: translateY === 0 && !isDismissing ? "transform 0.2s ease" : undefined,
        }}
      >
        <div className="sm:hidden flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-600" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b-4 border-bags-green sticky top-0 bg-bags-dark z-10">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-bags-green/20 border border-bags-green rounded flex items-center justify-center flex-shrink-0">
              <span className="font-pixel text-bags-green text-sm sm:text-base">+</span>
            </div>
            <div>
              <h2 className="font-pixel text-xs sm:text-sm text-bags-green">BUILD A TOKEN</h2>
              <p className="font-pixel text-[7px] sm:text-[8px] text-gray-400">
                Step {step === "info" ? "1/3" : step === "fees" ? "2/3" : "3/3"}:{" "}
                {step === "info" ? "Token Info" : step === "fees" ? "Fee Sharing" : "Confirm"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="font-pixel text-xs p-2 text-gray-400 hover:text-white touch-target border border-gray-700 hover:border-bags-green rounded"
            aria-label="Close"
          >
            [X]
          </button>
        </div>

        {/* Step 1: Token Info */}
        {step === "info" && (
          <div className="p-4 space-y-4">
            {/* Why Launch Here */}
            <div className="bg-gradient-to-r from-bags-green/10 to-bags-gold/10 border border-bags-green/30 p-3 space-y-2">
              <p className="font-pixel text-[10px] text-bags-gold">WHY LAUNCH ON BAGSWORLD?</p>
              <div className="space-y-1">
                <div className="flex items-start gap-2">
                  <span className="font-pixel text-xs text-bags-gold">1</span>
                  <span className="font-pixel text-[7px] text-gray-300">
                    <span className="text-bags-green">Earn trading fees</span> - Get a share of
                    every trade on your token
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-pixel text-xs text-bags-gold">2</span>
                  <span className="font-pixel text-[7px] text-gray-300">
                    <span className="text-bags-green">Flexible fee sharing</span> - Split fees with
                    collaborators via social accounts
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-pixel text-xs text-bags-gold">3</span>
                  <span className="font-pixel text-[7px] text-gray-300">
                    <span className="text-bags-green">Living building</span> - Your token appears in
                    the game world
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="font-pixel text-xs text-bags-gold">4</span>
                  <span className="font-pixel text-[7px] text-gray-300">
                    <span className="text-bags-green">No extra fees</span> - Just standard Bags.fm
                    fees
                  </span>
                </div>
              </div>
            </div>

            {/* AI Generated Notice */}
            {prefilled && (
              <div className="bg-purple-500/10 border border-purple-500/30 p-2 text-center">
                <p className="font-pixel text-[8px] text-purple-400">
                  🤖 Pre-filled by Professor Oak AI Generator
                </p>
              </div>
            )}

            {/* Image Upload - Logo and Banner side by side */}
            <div className="grid grid-cols-2 gap-4">
              {/* Logo Upload */}
              <div className="space-y-1">
                <p className="font-pixel text-[8px] text-gray-400 text-center">LOGO (512x512) *</p>
                <label className="cursor-pointer block">
                  <div
                    className={`aspect-square bg-bags-darker border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors ${
                      isResizingLogo
                        ? "border-amber-500 animate-pulse"
                        : logoWarning
                          ? "border-yellow-500 hover:border-yellow-400"
                          : "border-bags-green hover:border-bags-gold"
                    }`}
                  >
                    {isResizingLogo ? (
                      <span className="font-pixel text-[8px] text-amber-400 animate-pulse">
                        Resizing...
                      </span>
                    ) : imagePreview ? (
                      <img src={imagePreview} alt="Token" className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-pixel text-[8px] text-gray-500 text-center">
                        CLICK TO
                        <br />
                        UPLOAD
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
                {logoWarning && (
                  <div className="space-y-1">
                    <p className="font-pixel text-[6px] text-yellow-400 text-center">
                      ⚠️ {logoWarning}
                    </p>
                    <button
                      type="button"
                      onClick={handleResizeLogo}
                      disabled={isResizingLogo}
                      className="w-full py-1 bg-amber-600/20 border border-amber-600/50 font-pixel text-[7px] text-amber-400 hover:bg-amber-600/30 disabled:opacity-50"
                    >
                      {isResizingLogo ? "Resizing..." : "🔧 Auto-fix to 512x512"}
                    </button>
                  </div>
                )}
              </div>

              {/* Banner Upload */}
              <div className="space-y-1">
                <p className="font-pixel text-[8px] text-gray-400 text-center">BANNER (600x200)</p>
                <label className="cursor-pointer block">
                  <div
                    className={`aspect-[3/1] bg-bags-darker border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors ${
                      isResizingBanner
                        ? "border-amber-500 animate-pulse"
                        : bannerWarning
                          ? "border-yellow-500 hover:border-yellow-400"
                          : "border-amber-600/50 hover:border-amber-500"
                    }`}
                  >
                    {isResizingBanner ? (
                      <span className="font-pixel text-[7px] text-amber-400 animate-pulse">
                        Resizing...
                      </span>
                    ) : bannerPreview ? (
                      <img
                        src={bannerPreview}
                        alt="Banner"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="font-pixel text-[7px] text-gray-500 text-center">
                        FOR DEXSCREENER
                        <br />
                        (OPTIONAL)
                      </span>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                    onChange={handleBannerChange}
                    className="hidden"
                  />
                </label>
                {bannerWarning ? (
                  <div className="space-y-1">
                    <p className="font-pixel text-[6px] text-yellow-400 text-center">
                      ⚠️ {bannerWarning}
                    </p>
                    <button
                      type="button"
                      onClick={handleResizeBanner}
                      disabled={isResizingBanner}
                      className="w-full py-1 bg-amber-600/20 border border-amber-600/50 font-pixel text-[7px] text-amber-400 hover:bg-amber-600/30 disabled:opacity-50"
                    >
                      {isResizingBanner ? "Resizing..." : "🔧 Auto-fix to 600x200"}
                    </button>
                  </div>
                ) : (
                  <p className="font-pixel text-[6px] text-gray-500 text-center">
                    3:1 ratio for DexScreener
                  </p>
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
                className={`w-full bg-bags-darker border-2 p-2 font-pixel text-xs text-white focus:outline-none ${
                  duplicateWarning.name
                    ? "border-yellow-500 focus:border-yellow-400"
                    : "border-bags-green focus:border-bags-gold"
                }`}
                placeholder="My Awesome Token"
              />
              {duplicateWarning.name && (
                <p className="font-pixel text-[8px] text-yellow-400 mt-1 flex items-center gap-1">
                  <span>⚠️</span> {duplicateWarning.name}
                </p>
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
                className={`w-full bg-bags-darker border-2 p-2 font-pixel text-xs text-white focus:outline-none ${
                  duplicateWarning.symbol
                    ? "border-yellow-500 focus:border-yellow-400"
                    : "border-bags-green focus:border-bags-gold"
                }`}
                placeholder="TOKEN"
                maxLength={10}
              />
              {duplicateWarning.symbol && (
                <p className="font-pixel text-[8px] text-yellow-400 mt-1 flex items-center gap-1">
                  <span>⚠️</span> {duplicateWarning.symbol}
                </p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block font-pixel text-[10px] text-gray-400 mb-1">
                DESCRIPTION *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-bags-darker border-2 border-bags-green p-2 font-pixel text-xs text-white focus:outline-none focus:border-bags-gold h-20 resize-none"
                placeholder="Describe your token..."
              />
            </div>

            {/* Social Links */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-pixel text-[8px] text-gray-400 mb-1">
                    X (TWITTER) URL
                  </label>
                  <input
                    type="url"
                    value={formData.twitter}
                    onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                    className="w-full bg-bags-darker border-2 border-bags-green p-2 font-pixel text-[10px] text-white focus:outline-none focus:border-bags-gold"
                    placeholder="https://x.com/..."
                  />
                </div>
                <div>
                  <label className="block font-pixel text-[8px] text-gray-400 mb-1">WEBSITE</label>
                  <input
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full bg-bags-darker border-2 border-bags-green p-2 font-pixel text-[10px] text-white focus:outline-none focus:border-bags-gold"
                    placeholder="https://"
                  />
                </div>
              </div>
              <div>
                <label className="block font-pixel text-[8px] text-gray-400 mb-1">
                  TELEGRAM URL
                </label>
                <input
                  type="url"
                  value={formData.telegram}
                  onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
                  className="w-full bg-bags-darker border-2 border-bags-green p-2 font-pixel text-[10px] text-white focus:outline-none focus:border-bags-gold"
                  placeholder="https://t.me/..."
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Fee Sharing */}
        {step === "fees" && (
          <div className="p-4 space-y-4">
            {/* Important notice about permanent fees */}
            <div className="bg-bags-green/10 border-2 border-bags-green p-3">
              <p className="font-pixel text-[10px] text-bags-green mb-1">
                🔒 FEES ARE SET PERMANENTLY
              </p>
              <p className="font-pixel text-[8px] text-gray-300">
                On Bags.fm, fee shares are <span className="text-bags-gold">locked at launch</span>{" "}
                and cannot be changed. This is why launching through BagsWorld ensures the ecosystem
                is supported forever.
              </p>
            </div>

            <div className="bg-bags-darker p-3 border border-bags-green/30">
              <p className="font-pixel text-[10px] text-bags-gold mb-1">💰 HOW FEES WORK</p>
              <p className="font-pixel text-[8px] text-gray-400">
                Every trade generates fees split among claimers.{" "}
                <span className="text-bags-green">Total must equal exactly 100%.</span>
              </p>
              <p className="font-pixel text-[7px] text-gray-500 mt-1">
                Supported providers:{" "}
                <span className="text-bags-green">
                  Twitter, Moltbook, GitHub, Kick, TikTok, Instagram
                </span>
              </p>
              <p className="font-pixel text-[7px] text-gray-500 mt-1">
                Fee claimers need a wallet linked at{" "}
                <a
                  href="https://bags.fm/settings"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline hover:text-blue-300"
                >
                  bags.fm/settings
                </a>{" "}
                to claim their share.
              </p>
            </div>

            {/* Ecosystem Fee - Community Fund (only show if > 0) */}
            {ecosystemFee.bps > 0 && (
              <div className="bg-bags-gold/10 border border-bags-gold/30 p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">👑</span>
                    <div>
                      <p className="font-pixel text-[10px] text-bags-gold">
                        {ecosystemFee.displayName}
                      </p>
                      <p className="font-pixel text-[7px] text-gray-400">
                        Supports BagsWorld development
                      </p>
                    </div>
                  </div>
                  <span className="font-pixel text-[10px] text-bags-gold">
                    {ecosystemFee.bps / 100}%
                  </span>
                </div>
                <div className="pt-1 border-t border-bags-gold/20">
                  <p className="font-pixel text-[6px] text-gray-400">
                    This fee supports BagsWorld ecosystem development, features, and community
                    initiatives. Verifiable on-chain.
                  </p>
                </div>
                <a
                  href={`https://solscan.io/account/${ECOSYSTEM_CONFIG.ecosystem.wallet}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center font-pixel text-[7px] text-blue-400 hover:text-blue-300 pt-1"
                >
                  🔍 View Ecosystem Wallet on Solscan →
                </a>
              </div>
            )}

            <div className="space-y-3">
              {feeShares.map((share, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <select
                    value={share.provider}
                    onChange={(e) => updateFeeShare(index, "provider", e.target.value)}
                    className="bg-bags-darker border border-bags-green p-2 font-pixel text-[8px] text-white"
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
                    className="flex-1 bg-bags-darker border border-bags-green p-2 font-pixel text-[8px] text-white"
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
                    className="w-16 bg-bags-darker border border-bags-green p-2 font-pixel text-[8px] text-white text-center"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                  <span className="font-pixel text-[8px] text-gray-400">%</span>
                  {feeShares.length > 1 && (
                    <button
                      onClick={() => removeFeeShare(index)}
                      className="text-bags-red font-pixel text-[10px] hover:text-red-400"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {feeShares.length < 10 && (
              <button
                onClick={addFeeShare}
                className="w-full py-2 border-2 border-dashed border-bags-green/50 font-pixel text-[8px] text-bags-green hover:border-bags-green"
              >
                + ADD FEE CLAIMER
              </button>
            )}

            <div
              className={`p-2 ${isValidBps ? "bg-bags-green/10" : "bg-bags-red/10"} border ${isValidBps ? "border-bags-green/30" : "border-bags-red/30"}`}
            >
              <p className="font-pixel text-[8px] text-center">
                Total Fee Share:{" "}
                <span className={isValidBps ? "text-bags-green" : "text-bags-red"}>
                  {(totalBps / 100).toFixed(1)}%
                </span>
                {!isValidBps && <span className="text-bags-red ml-2">(must equal 100%)</span>}
              </p>
              {!isValidBps && totalBps < 10000 && (
                <p className="font-pixel text-[7px] text-gray-400 text-center mt-1">
                  Add {((10000 - totalBps) / 100).toFixed(1)}% more to Twitter/GitHub/Kick accounts
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === "confirm" && (
          <div className="p-4 space-y-4">
            <div className="bg-bags-darker p-4 space-y-3">
              {/* Banner Preview (if provided) */}
              {bannerPreview && (
                <div className="space-y-1 mb-2">
                  <div className="w-full aspect-[3/1] overflow-hidden border border-amber-600/30">
                    <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover" />
                  </div>
                  <p className="font-pixel text-[6px] text-amber-400/70 text-center">
                    💾 Banner saved locally for DexScreener Enhanced Token Info ($299 separate
                    process)
                  </p>
                </div>
              )}

              <div className="flex items-center gap-4">
                {imagePreview && (
                  <img
                    src={imagePreview}
                    alt="Token"
                    className="w-16 h-16 object-cover border-2 border-bags-green"
                  />
                )}
                <div>
                  <p className="font-pixel text-sm text-bags-gold">${formData.symbol}</p>
                  <p className="font-pixel text-xs text-white">{formData.name}</p>
                </div>
              </div>

              <p className="font-pixel text-[8px] text-gray-400">{formData.description}</p>

              {(formData.twitter || formData.telegram || formData.website) && (
                <div className="flex flex-wrap gap-2 text-[8px] font-pixel">
                  {formData.twitter && (
                    <span className="text-blue-400 truncate max-w-[150px]" title={formData.twitter}>
                      {formData.twitter}
                    </span>
                  )}
                  {formData.telegram && (
                    <span
                      className="text-blue-300 truncate max-w-[150px]"
                      title={formData.telegram}
                    >
                      {formData.telegram}
                    </span>
                  )}
                  {formData.website && (
                    <span className="text-gray-400 truncate max-w-[150px]" title={formData.website}>
                      {formData.website}
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="bg-bags-darker p-3 space-y-2">
              <div className="flex justify-between items-center mb-2">
                <p className="font-pixel text-[10px] text-bags-gold">💰 Fee Distribution</p>
                <span className="font-pixel text-[7px] text-gray-500 bg-bags-green/10 px-2 py-0.5 rounded">
                  🔒 PERMANENT
                </span>
              </div>
              {/* Ecosystem fee (only show if > 0) */}
              {ecosystemFee.bps > 0 && (
                <div className="flex justify-between font-pixel text-[8px] pb-1 border-b border-bags-green/20">
                  <span className="text-bags-gold">👑 {ecosystemFee.displayName}</span>
                  <span className="text-bags-gold">{ecosystemFee.bps / 100}%</span>
                </div>
              )}
              {/* User fee shares */}
              {feeShares
                .filter((f) => f.username)
                .map((share, i) => (
                  <div key={i} className="flex justify-between font-pixel text-[8px]">
                    <span className="text-gray-400">
                      {share.provider}/@{share.username}
                    </span>
                    <span className="text-bags-green">{(share.bps / 100).toFixed(1)}%</span>
                  </div>
                ))}
              {feeShares.filter((f) => f.username).length === 0 && (
                <p className="font-pixel text-[8px] text-gray-500">No additional fee claimers</p>
              )}
              <div className="flex justify-between font-pixel text-[8px] pt-1 border-t border-bags-green/20">
                <span className="text-white">Total</span>
                <span className="text-white">{(totalBps / 100).toFixed(1)}%</span>
              </div>
            </div>

            {/* Initial Buy Amount */}
            <div className="bg-purple-500/10 border border-purple-500/30 p-3 space-y-2">
              <div className="flex justify-between items-center">
                <p className="font-pixel text-[10px] text-purple-400">🛒 Initial Buy (Optional)</p>
                <span className="font-pixel text-[7px] text-gray-500">Be your first buyer!</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={initialBuySOL}
                  onChange={(e) => setInitialBuySOL(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.1"
                  className="flex-1 bg-bags-darker border border-purple-500/30 p-2 font-pixel text-[10px] text-white text-center focus:outline-none focus:border-purple-500"
                />
                <span className="font-pixel text-[10px] text-purple-400">SOL</span>
              </div>
              <p className="font-pixel text-[7px] text-gray-500 text-center">
                {parseFloat(initialBuySOL || "0") > 0
                  ? `You'll buy ${initialBuySOL} SOL worth of your token at launch`
                  : "Set to 0 to launch without buying"}
              </p>
            </div>

            <div className="bg-bags-gold/10 border border-bags-gold/30 p-3">
              <p className="font-pixel text-[8px] text-bags-gold text-center">
                🏢 Your token will appear as a building in BagsWorld!
              </p>
            </div>

            {/* Phantom warning notice */}
            <div className="bg-orange-500/10 border border-orange-500/30 p-3">
              <p className="font-pixel text-[8px] text-orange-400 text-center">
                ⚠️ Phantom may show a security warning for new dApps. Click &quot;Proceed
                anyway&quot; to continue - we&apos;re pending Phantom verification.
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-bags-green/30 space-y-3">
          {/* Launch Status */}
          {launchStatus && (
            <div className="bg-purple-500/20 border-2 border-purple-500 p-2">
              <p className="font-pixel text-[8px] text-purple-400 animate-pulse">{launchStatus}</p>
            </div>
          )}

          {/* Error/Success Message */}
          {error && (
            <div className="bg-bags-red/20 border-2 border-bags-red p-2">
              <p className="font-pixel text-[8px] text-bags-red">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-bags-green/20 border-2 border-bags-green p-2">
              <p className="font-pixel text-[8px] text-bags-green">{success}</p>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex gap-2">
            {step !== "info" && !isLoading && (
              <button
                onClick={handleBack}
                className="flex-1 py-2 border-2 border-bags-green font-pixel text-[10px] text-bags-green hover:bg-bags-green/10"
              >
                ← BACK
              </button>
            )}
            {step !== "confirm" ? (
              <button onClick={handleNextStep} className="flex-1 btn-retro">
                NEXT →
              </button>
            ) : (
              <button
                onClick={() =>
                  guardAction(() => handleSubmit({ preventDefault: () => {} } as React.FormEvent))
                }
                disabled={isLoading || !!success}
                className="flex-1 btn-retro disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading
                  ? "🔄 LAUNCHING..."
                  : success
                    ? "✓ DONE"
                    : `🚀 LAUNCH${parseFloat(initialBuySOL || "0") > 0 ? ` + BUY ${initialBuySOL} SOL` : ""}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
