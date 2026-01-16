"use client";

import { useState } from "react";

interface LaunchModalProps {
  onClose: () => void;
}

export function LaunchModal({ onClose }: LaunchModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    description: "",
    twitter: "",
    website: "",
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // In production, this would connect to wallet and call the API
      // For now, show a message about wallet connection needed
      setError("Connect your Solana wallet to launch a token");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to launch token");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-bags-dark border-4 border-bags-green w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b-4 border-bags-green">
          <h2 className="font-pixel text-sm text-bags-green">
            🏗️ BUILD A TOKEN
          </h2>
          <button
            onClick={onClose}
            className="font-pixel text-xs text-gray-400 hover:text-white"
          >
            [X]
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
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
              TOKEN NAME
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full bg-bags-darker border-2 border-bags-green p-2 font-pixel text-xs text-white focus:outline-none focus:border-bags-gold"
              placeholder="My Awesome Token"
              required
            />
          </div>

          {/* Symbol */}
          <div>
            <label className="block font-pixel text-[10px] text-gray-400 mb-1">
              SYMBOL
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
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block font-pixel text-[10px] text-gray-400 mb-1">
              DESCRIPTION
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full bg-bags-darker border-2 border-bags-green p-2 font-pixel text-xs text-white focus:outline-none focus:border-bags-gold h-20 resize-none"
              placeholder="Describe your token..."
              required
            />
          </div>

          {/* Social Links */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-pixel text-[8px] text-gray-400 mb-1">
                TWITTER (optional)
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
                WEBSITE (optional)
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

          {/* Error Message */}
          {error && (
            <div className="bg-bags-red/20 border-2 border-bags-red p-2">
              <p className="font-pixel text-[8px] text-bags-red">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-retro disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "BUILDING..." : "🚀 LAUNCH TOKEN"}
          </button>

          <p className="font-pixel text-[8px] text-gray-500 text-center">
            Your token will appear as a building in BagsWorld
          </p>
        </form>
      </div>
    </div>
  );
}
