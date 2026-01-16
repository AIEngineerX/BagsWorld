"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { saveLaunchedToken, type LaunchedToken } from "@/lib/token-registry";

interface FeeShareEntry {
  provider: string;
  username: string;
  bps: number; // basis points (100 = 1%)
}

// Ecosystem configuration - 10% of all fees support BagsWorld
const ECOSYSTEM_FEE_BPS = 1000; // 10%
const ECOSYSTEM_WALLET = "Ccs9wSrEwmKx7iBD9H4xqd311eJUd2ufDk2ip87Knbo3";
const ECOSYSTEM_PROVIDER = "solana"; // Direct wallet

interface LaunchModalProps {
  onClose: () => void;
  onLaunchSuccess?: () => void;
}

export function LaunchModal({ onClose, onLaunchSuccess }: LaunchModalProps) {
  const { publicKey, connected } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    description: "",
    twitter: "",
    website: "",
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [step, setStep] = useState<"info" | "fees" | "confirm">("info");
  const [feeShares, setFeeShares] = useState<FeeShareEntry[]>([
    { provider: "twitter", username: "", bps: 500 }, // Default 5% to creator
  ]);

  const userTotalBps = feeShares.reduce((sum, f) => sum + (f.username ? f.bps : 0), 0);
  const totalBps = userTotalBps + ECOSYSTEM_FEE_BPS; // Include ecosystem fee
  const isValidBps = totalBps <= 10000; // Max 100%

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        // Keep the full data URL for API submission
        setImageDataUrl(result);
      };
      reader.readAsDataURL(file);
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
        setError("please fill in all required fields ser");
        return;
      }
      setError(null);
      setStep("fees");
    } else if (step === "fees") {
      if (!isValidBps) {
        setError("total fee share cant exceed 100% anon");
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

      // 1. Create token info via API
      const tokenInfoResponse = await fetch("/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-info",
          data: {
            name: formData.name,
            symbol: formData.symbol,
            description: formData.description,
            image: imageDataUrl || "",
            twitter: formData.twitter,
            website: formData.website,
          },
        }),
      });

      if (!tokenInfoResponse.ok) {
        const err = await tokenInfoResponse.json();
        throw new Error(err.error || "Failed to create token info");
      }

      const { tokenMint, tokenMetadata } = await tokenInfoResponse.json();

      // 2. Configure fee sharing (always includes ecosystem fee)
      const validFeeShares = feeShares.filter(f => f.username.trim());

      // Build fee claimers array - always include ecosystem fee
      const allFeeClaimers = [
        // Ecosystem fee - 10% to support BagsWorld
        {
          provider: ECOSYSTEM_PROVIDER,
          providerUsername: ECOSYSTEM_WALLET,
          bps: ECOSYSTEM_FEE_BPS,
        },
        // User-defined fee shares
        ...validFeeShares.map(f => ({
          provider: f.provider,
          providerUsername: f.username.replace("@", ""),
          bps: f.bps,
        })),
      ];

      let configKey: string | undefined;
      const feeConfigResponse = await fetch("/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "configure-fees",
          data: {
            mint: tokenMint,
            feeClaimers: allFeeClaimers,
          },
        }),
      });

      if (feeConfigResponse.ok) {
        const feeResult = await feeConfigResponse.json();
        configKey = feeResult.configId;
      } else {
        console.warn("Fee config warning:", await feeConfigResponse.text());
        // Continue anyway, fee config is optional
      }

      // 3. Create launch transaction and sign it
      if (configKey) {
        const launchTxResponse = await fetch("/api/launch-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create-launch-tx",
            data: {
              ipfs: tokenMetadata,
              tokenMint: tokenMint,
              wallet: publicKey?.toBase58(),
              initialBuyLamports: 0, // User can configure this
              configKey: configKey,
            },
          }),
        });

        if (!launchTxResponse.ok) {
          const err = await launchTxResponse.json();
          console.warn("Launch tx warning:", err.error);
          // Continue to save token anyway for display
        }
      }

      // 4. Save token to registry for the world to display
      const launchedToken: LaunchedToken = {
        mint: tokenMint,
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description,
        imageUrl: imagePreview || undefined,
        creator: publicKey?.toBase58() || "Unknown",
        createdAt: Date.now(),
        feeShares: [
          // Include ecosystem fee in saved data
          {
            provider: "ecosystem",
            username: "BagsWorld",
            bps: ECOSYSTEM_FEE_BPS,
          },
          ...validFeeShares.map((f) => ({
            provider: f.provider,
            username: f.username.replace("@", ""),
            bps: f.bps,
          })),
        ],
      };

      saveLaunchedToken(launchedToken);

      // Dispatch custom event to notify useWorldState hook
      window.dispatchEvent(new CustomEvent("bagsworld-token-update"));

      setSuccess(`Token ${formData.symbol} created! Your building is being constructed...`);

      // Call the success callback to refresh the world state
      if (onLaunchSuccess) {
        onLaunchSuccess();
      }

      // Auto-close after a short delay
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to launch token");
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
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4"
      onClick={handleBackdropClick}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        className="bg-bags-dark border-4 border-bags-green w-full max-w-md max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-4 border-bags-green sticky top-0 bg-bags-dark">
          <div>
            <h2 className="font-pixel text-sm text-bags-green">
              🏗️ BUILD A TOKEN
            </h2>
            <p className="font-pixel text-[8px] text-gray-400">
              Step {step === "info" ? "1/3" : step === "fees" ? "2/3" : "3/3"}: {step === "info" ? "Token Info" : step === "fees" ? "Fee Sharing" : "Confirm"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="font-pixel text-xs text-gray-400 hover:text-white"
          >
            [X]
          </button>
        </div>

        {/* Step 1: Token Info */}
        {step === "info" && (
          <div className="p-4 space-y-4">
            {/* Image Upload */}
            <div className="flex justify-center">
              <label className="cursor-pointer">
                <div className="w-24 h-24 bg-bags-darker border-2 border-dashed border-bags-green flex items-center justify-center overflow-hidden">
                  {imagePreview ? (
                    <img
                      src={imagePreview}
                      alt="Token"
                      className="w-full h-full object-cover"
                    />
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
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Name */}
            <div>
              <label className="block font-pixel text-[10px] text-gray-400 mb-1">
                TOKEN NAME *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full bg-bags-darker border-2 border-bags-green p-2 font-pixel text-xs text-white focus:outline-none focus:border-bags-gold"
                placeholder="My Awesome Token"
              />
            </div>

            {/* Symbol */}
            <div>
              <label className="block font-pixel text-[10px] text-gray-400 mb-1">
                SYMBOL *
              </label>
              <input
                type="text"
                value={formData.symbol}
                onChange={(e) =>
                  setFormData({ ...formData, symbol: e.target.value.toUpperCase() })
                }
                className="w-full bg-bags-darker border-2 border-bags-green p-2 font-pixel text-xs text-white focus:outline-none focus:border-bags-gold"
                placeholder="TOKEN"
                maxLength={10}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block font-pixel text-[10px] text-gray-400 mb-1">
                DESCRIPTION *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full bg-bags-darker border-2 border-bags-green p-2 font-pixel text-xs text-white focus:outline-none focus:border-bags-gold h-20 resize-none"
                placeholder="Describe your token..."
              />
            </div>

            {/* Social Links */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-pixel text-[8px] text-gray-400 mb-1">
                  TWITTER
                </label>
                <input
                  type="text"
                  value={formData.twitter}
                  onChange={(e) =>
                    setFormData({ ...formData, twitter: e.target.value })
                  }
                  className="w-full bg-bags-darker border-2 border-bags-green p-2 font-pixel text-[10px] text-white focus:outline-none focus:border-bags-gold"
                  placeholder="@handle"
                />
              </div>
              <div>
                <label className="block font-pixel text-[8px] text-gray-400 mb-1">
                  WEBSITE
                </label>
                <input
                  type="text"
                  value={formData.website}
                  onChange={(e) =>
                    setFormData({ ...formData, website: e.target.value })
                  }
                  className="w-full bg-bags-darker border-2 border-bags-green p-2 font-pixel text-[10px] text-white focus:outline-none focus:border-bags-gold"
                  placeholder="https://"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Fee Sharing */}
        {step === "fees" && (
          <div className="p-4 space-y-4">
            <div className="bg-bags-darker p-3 border border-bags-green/30">
              <p className="font-pixel text-[10px] text-bags-gold mb-1">💰 FEE SHARING</p>
              <p className="font-pixel text-[8px] text-gray-400">
                Add social accounts to share fees with. Each trade generates fees that get split among claimers.
              </p>
            </div>

            {/* Ecosystem Fee - Always included */}
            <div className="bg-bags-gold/10 border border-bags-gold/30 p-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🏙️</span>
                  <div>
                    <p className="font-pixel text-[10px] text-bags-gold">BagsWorld Ecosystem</p>
                    <p className="font-pixel text-[7px] text-gray-400">Auto-included to build the city</p>
                  </div>
                </div>
                <span className="font-pixel text-[10px] text-bags-gold">10%</span>
              </div>
            </div>

            <div className="space-y-3">
              {feeShares.map((share, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <select
                    value={share.provider}
                    onChange={(e) => updateFeeShare(index, "provider", e.target.value)}
                    className="bg-bags-darker border border-bags-green p-2 font-pixel text-[8px] text-white"
                  >
                    <option value="twitter">Twitter</option>
                    <option value="tiktok">TikTok</option>
                    <option value="instagram">Instagram</option>
                    <option value="github">GitHub</option>
                    <option value="kick">Kick</option>
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
                    onChange={(e) => updateFeeShare(index, "bps", Math.min(10000, Math.max(0, parseFloat(e.target.value) * 100)))}
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

            <div className={`p-2 ${isValidBps ? "bg-bags-green/10" : "bg-bags-red/10"} border ${isValidBps ? "border-bags-green/30" : "border-bags-red/30"}`}>
              <p className="font-pixel text-[8px] text-center">
                Total Fee Share: <span className={isValidBps ? "text-bags-green" : "text-bags-red"}>{(totalBps / 100).toFixed(1)}%</span>
                {!isValidBps && <span className="text-bags-red ml-2">(max 100%)</span>}
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === "confirm" && (
          <div className="p-4 space-y-4">
            <div className="bg-bags-darker p-4 space-y-3">
              <div className="flex items-center gap-4">
                {imagePreview && (
                  <img src={imagePreview} alt="Token" className="w-16 h-16 object-cover border-2 border-bags-green" />
                )}
                <div>
                  <p className="font-pixel text-sm text-bags-gold">${formData.symbol}</p>
                  <p className="font-pixel text-xs text-white">{formData.name}</p>
                </div>
              </div>

              <p className="font-pixel text-[8px] text-gray-400">{formData.description}</p>

              {(formData.twitter || formData.website) && (
                <div className="flex gap-4 text-[8px] font-pixel">
                  {formData.twitter && <span className="text-blue-400">{formData.twitter}</span>}
                  {formData.website && <span className="text-gray-400">{formData.website}</span>}
                </div>
              )}
            </div>

            <div className="bg-bags-darker p-3 space-y-2">
              <p className="font-pixel text-[10px] text-bags-gold">💰 Fee Distribution</p>
              {feeShares.filter(f => f.username).map((share, i) => (
                <div key={i} className="flex justify-between font-pixel text-[8px]">
                  <span className="text-gray-400">{share.provider}/@{share.username}</span>
                  <span className="text-bags-green">{(share.bps / 100).toFixed(1)}%</span>
                </div>
              ))}
              {feeShares.filter(f => f.username).length === 0 && (
                <p className="font-pixel text-[8px] text-gray-500">No fee claimers configured</p>
              )}
            </div>

            <div className="bg-bags-gold/10 border border-bags-gold/30 p-3">
              <p className="font-pixel text-[8px] text-bags-gold text-center">
                🏢 Your token will appear as a building in BagsWorld!
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-bags-green/30 space-y-3">
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
            {step !== "info" && (
              <button
                onClick={handleBack}
                className="flex-1 py-2 border-2 border-bags-green font-pixel text-[10px] text-bags-green hover:bg-bags-green/10"
              >
                ← BACK
              </button>
            )}
            {step !== "confirm" ? (
              <button
                onClick={handleNextStep}
                className="flex-1 btn-retro"
              >
                NEXT →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isLoading || !!success}
                className="flex-1 btn-retro disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "BUILDING..." : success ? "✓ DONE" : "🚀 LAUNCH TOKEN"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
