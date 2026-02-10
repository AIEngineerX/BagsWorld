"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Connection, VersionedTransaction, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import { useMobileWallet } from "@/hooks/useMobileWallet";
import { useSwipeToDismiss } from "@/hooks/useSwipeToDismiss";
import { useActionGuard } from "@/hooks/useActionGuard";

// Helper to deserialize transaction - handles both base58 and base64 encoding
function deserializeTransaction(
  encoded: string | Record<string, unknown>,
  context: string = "transaction"
): VersionedTransaction | Transaction {
  // Extract transaction string from object or use string directly
  let txString: string | undefined;
  if (typeof encoded === "object" && encoded !== null) {
    const possibleFields = ["transaction", "tx", "data", "rawTransaction", "serializedTransaction"];
    for (const field of possibleFields) {
      if (typeof encoded[field] === "string") {
        txString = encoded[field] as string;
        break;
      }
    }
    if (!txString) {
      throw new Error(`Invalid ${context}: no transaction string found in object`);
    }
  } else if (typeof encoded === "string") {
    txString = encoded;
  } else {
    throw new Error(`Invalid ${context}: expected string or object`);
  }

  if (!txString || txString.length < 50) {
    throw new Error(`Invalid ${context}: too short`);
  }

  txString = txString.trim().replace(/\s/g, "");
  const isLikelyBase64 = txString.includes("+") || txString.includes("/") || txString.endsWith("=");

  let buffer: Uint8Array;
  try {
    buffer = isLikelyBase64 ? Buffer.from(txString, "base64") : bs58.decode(txString);
    if (buffer.length < 50) throw new Error("Buffer too small");
  } catch {
    // Try the other encoding
    try {
      buffer = isLikelyBase64 ? bs58.decode(txString) : Buffer.from(txString, "base64");
    } catch {
      throw new Error(`${context}: decode failed`);
    }
  }

  // Try VersionedTransaction first, fall back to legacy
  try {
    return VersionedTransaction.deserialize(buffer);
  } catch {
    try {
      return Transaction.from(buffer);
    } catch {
      throw new Error(`Failed to deserialize ${context}`);
    }
  }
}
import {
  saveLaunchedToken,
  saveTokenGlobally,
  getAllWorldTokens,
  type LaunchedToken,
} from "@/lib/token-registry";
import { ECOSYSTEM_CONFIG, getEcosystemFeeShare } from "@/lib/config";

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
  const { publicKey, connected, mobileSignTransaction: signTransaction } = useMobileWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { translateY, isDismissing, handlers: swipeHandlers } = useSwipeToDismiss(onClose);
  const guardAction = useActionGuard();

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

      // 1. Create token info via API
      setLaunchStatus("Uploading token metadata to IPFS...");
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
            twitter: formData.twitter || undefined,
            telegram: formData.telegram || undefined,
            website: formData.website || undefined,
          },
        }),
      });

      if (!tokenInfoResponse.ok) {
        const err = await tokenInfoResponse.json();
        throw new Error(err.error || "Failed to create token info");
      }

      const { tokenMint, tokenMetadata } = await tokenInfoResponse.json();

      // 2. Configure fee sharing (always includes ecosystem fee)
      // IMPORTANT: Bags.fm API requires BPS to sum to exactly 10000 (100%)
      const validFeeShares = feeShares.filter((f) => f.username.trim());

      // Calculate total user-defined BPS
      const userDefinedBps = validFeeShares.reduce((sum, f) => sum + f.bps, 0);
      const allocatedBps = ecosystemFee.bps + userDefinedBps;
      const remainingBps = 10000 - allocatedBps;

      // Build fee claimers array
      // IMPORTANT: All usernames should be lowercase (Bags API is case-insensitive but normalized)
      // Note: The Bags API requires wallet addresses, so usernames must have linked wallets at bags.fm/settings

      // Start with user-defined fee shares
      const userFeeClaimers = validFeeShares.map((f) => ({
        provider: f.provider,
        providerUsername: f.username.replace(/@/g, "").toLowerCase().trim(),
        bps: f.bps,
      }));

      // Try to include ecosystem fee if configured
      let allFeeClaimers = [...userFeeClaimers];
      let ecosystemFeeIncluded = false;

      if (ecosystemFee.bps > 0) {
        // Ecosystem fee is configured - add it to the list
        // If wallet lookup fails later, the error will be shown to user
        allFeeClaimers = [
          {
            provider: ecosystemFee.provider,
            providerUsername: ecosystemFee.providerUsername.toLowerCase().trim(),
            bps: ecosystemFee.bps,
          },
          ...userFeeClaimers,
        ];
        ecosystemFeeIncluded = true;
      }

      // Bags.fm API requires total BPS to equal exactly 10000 (100%)
      // All fee claimers must use social providers (twitter, kick, github) - no raw wallet addresses
      const totalAllocatedBps = ecosystemFee.bps + userDefinedBps;
      if (totalAllocatedBps !== 10000) {
        throw new Error(
          `Fee shares must total exactly 100%. Currently ${(totalAllocatedBps / 100).toFixed(1)}%. Add fee claimers to allocate the remaining ${((10000 - totalAllocatedBps) / 100).toFixed(1)}% to Twitter/GitHub/Kick accounts.`
        );
      }

      setLaunchStatus("Configuring fee sharing...");

      let configKey: string | undefined;
      const feeConfigResponse = await fetch("/api/launch-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "configure-fees",
          data: {
            mint: tokenMint,
            payer: publicKey?.toBase58(),
            feeClaimers: allFeeClaimers,
          },
        }),
      });

      if (feeConfigResponse.ok) {
        const feeResult = await feeConfigResponse.json();
        configKey = feeResult.configId;

        // If the fee share config needs to be created on-chain, sign and submit the transactions
        if (feeResult.needsCreation && feeResult.transactions?.length > 0) {
          setLaunchStatus("Creating fee share config on-chain...");

          const connection = new Connection(
            process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://rpc.ankr.com/solana"
          );

          for (let i = 0; i < feeResult.transactions.length; i++) {
            const txData = feeResult.transactions[i];
            setLaunchStatus(
              `Signing fee config transaction ${i + 1}/${feeResult.transactions.length}...`
            );

            // Decode and sign the transaction (handles both versioned and legacy formats)
            const transaction = deserializeTransaction(
              txData.transaction,
              `fee-config-tx-${i + 1}`
            );

            // Check if transaction already has signatures
            let hasExistingSignatures = false;
            if (transaction instanceof VersionedTransaction) {
              hasExistingSignatures = transaction.signatures.some((sig) =>
                sig.some((byte) => byte !== 0)
              );
            } else {
              hasExistingSignatures = transaction.signatures.some(
                (sig) => sig.signature && sig.signature.some((byte) => byte !== 0)
              );
            }

            // Only refresh blockhash if no existing signatures
            let blockhash: string;
            let lastValidBlockHeight: number;

            if (!hasExistingSignatures) {
              const latestBlockhash = await connection.getLatestBlockhash("confirmed");
              blockhash = latestBlockhash.blockhash;
              lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;

              if (transaction instanceof VersionedTransaction) {
                transaction.message.recentBlockhash = blockhash;
              } else {
                transaction.recentBlockhash = blockhash;
              }
            } else {
              if (transaction instanceof VersionedTransaction) {
                blockhash = transaction.message.recentBlockhash;
              } else {
                blockhash = transaction.recentBlockhash!;
              }
              const latestBlockhash = await connection.getLatestBlockhash("confirmed");
              lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
            }

            let signedTx;
            try {
              signedTx = await signTransaction(transaction);
            } catch (signError: unknown) {
              const signErrorMsg =
                signError instanceof Error ? signError.message : String(signError);
              if (
                signErrorMsg.includes("User rejected") ||
                signErrorMsg.includes("rejected") ||
                signErrorMsg.includes("closed")
              ) {
                throw new Error(
                  "Transaction cancelled. Please try again and approve all transactions in your wallet."
                );
              }
              throw new Error(`Wallet signing failed: ${signErrorMsg}`);
            }

            setLaunchStatus(
              `Broadcasting fee config transaction ${i + 1}/${feeResult.transactions.length}...`
            );

            // Send transaction - skip preflight to avoid blockhash simulation issues
            // The transaction will still be validated by validators when submitted
            const txid = await connection.sendRawTransaction(signedTx.serialize(), {
              skipPreflight: true,
              preflightCommitment: "confirmed",
              maxRetries: 5,
            });

            await connection.confirmTransaction(
              {
                signature: txid,
                blockhash,
                lastValidBlockHeight,
              },
              "confirmed"
            );
          }
        }
      } else {
        const feeError = await feeConfigResponse.json();
        const errorMsg = feeError.error || "Failed to configure fee sharing";
        // Show the actual error from the API - it will include which username failed
        // Common errors:
        // - "Could not find wallet for twitter user: xyz" = user hasn't linked at bags.fm/settings
        // - "Failed to lookup wallets for fee claimers" = bulk lookup failed
        console.error("Fee config error:", errorMsg);
        console.error("Fee claimers sent:", JSON.stringify(allFeeClaimers, null, 2));

        // Add helpful context to the error
        if (errorMsg.toLowerCase().includes("could not find wallet")) {
          throw new Error(
            `${errorMsg}. The user needs to link their wallet at bags.fm/settings first.`
          );
        }
        throw new Error(errorMsg);
      }

      if (!configKey) {
        throw new Error("Fee configuration failed - no config key received");
      }

      // 3. Create launch transaction, sign it, and send to blockchain
      {
        setLaunchStatus("Creating launch transaction...");

        // Convert SOL to lamports (1 SOL = 1,000,000,000 lamports)
        const initialBuyLamports = Math.floor(parseFloat(initialBuySOL || "0") * 1_000_000_000);

        const launchTxResponse = await fetch("/api/launch-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create-launch-tx",
            data: {
              ipfs: tokenMetadata,
              tokenMint: tokenMint,
              wallet: publicKey?.toBase58(),
              initialBuyLamports,
              configKey: configKey,
            },
          }),
        });

        if (!launchTxResponse.ok) {
          const err = await launchTxResponse.json();
          throw new Error(err.error || "Failed to create launch transaction");
        }

        const launchResult = await launchTxResponse.json();

        // Handle various response formats - extract the base64 transaction string
        let txBase64 = launchResult.transaction;

        // If transaction is nested (some API versions return { transaction: { transaction: "..." } })
        if (txBase64 && typeof txBase64 === "object" && "transaction" in txBase64) {
          txBase64 = txBase64.transaction;
        }

        if (!txBase64 || typeof txBase64 !== "string") {
          console.error("Invalid transaction response:", launchResult);
          throw new Error(
            "No valid transaction received from API. The token may already exist or there was a server error."
          );
        }

        setLaunchStatus("Please sign the transaction in your wallet...");

        // Decode transaction (handles both versioned and legacy formats)
        const transaction = deserializeTransaction(txBase64, "launch-transaction");

        // Get connection
        const connection = new Connection(
          process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://rpc.ankr.com/solana"
        );

        // Check if transaction already has signatures (from the API)
        // If so, we should NOT modify the blockhash as it would invalidate existing signatures
        let hasExistingSignatures = false;
        if (transaction instanceof VersionedTransaction) {
          hasExistingSignatures = transaction.signatures.some((sig) =>
            sig.some((byte) => byte !== 0)
          );
        } else {
          hasExistingSignatures = transaction.signatures.some(
            (sig) => sig.signature && sig.signature.some((byte) => byte !== 0)
          );
        }

        // Only refresh blockhash if there are no existing signatures
        // Otherwise we'd invalidate the API's signatures
        let blockhash: string;
        let lastValidBlockHeight: number;

        if (!hasExistingSignatures) {
          const latestBlockhash = await connection.getLatestBlockhash("confirmed");
          blockhash = latestBlockhash.blockhash;
          lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;

          if (transaction instanceof VersionedTransaction) {
            transaction.message.recentBlockhash = blockhash;
          } else {
            transaction.recentBlockhash = blockhash;
          }
        } else {
          // Use the blockhash from the transaction
          if (transaction instanceof VersionedTransaction) {
            blockhash = transaction.message.recentBlockhash;
          } else {
            blockhash = transaction.recentBlockhash!;
          }
          // Get current block height for confirmation
          const latestBlockhash = await connection.getLatestBlockhash("confirmed");
          lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
        }

        // Sign transaction - with better error handling for Phantom
        let signedTx;
        try {
          signedTx = await signTransaction(transaction);
        } catch (signError: unknown) {
          const signErrorMsg = signError instanceof Error ? signError.message : String(signError);
          console.error("Transaction signing failed:", signErrorMsg);

          // User rejected
          if (signErrorMsg.includes("User rejected") || signErrorMsg.includes("rejected")) {
            throw new Error(
              "Transaction cancelled. Please try again and approve the transaction in your wallet."
            );
          }
          // Phantom popup closed
          if (signErrorMsg.includes("Popup closed") || signErrorMsg.includes("closed")) {
            throw new Error("Wallet popup was closed. Please try again and complete the approval.");
          }
          // Transaction simulation failed
          if (signErrorMsg.includes("simulation") || signErrorMsg.includes("Simulation")) {
            throw new Error(
              `Transaction simulation failed: ${signErrorMsg}. This may be a temporary network issue - please try again.`
            );
          }
          // Generic error
          throw new Error(`Wallet signing failed: ${signErrorMsg}`);
        }

        setLaunchStatus("Broadcasting to Solana...");

        // Send to blockchain with retry logic for blockhash issues
        // If the transaction has pre-signed components (from API), we need to request
        // a fresh transaction from the API rather than modifying the blockhash ourselves
        let txid: string | undefined;
        let sendAttempts = 0;
        const maxSendAttempts = 3;
        let currentSignedTx = signedTx;

        while (sendAttempts < maxSendAttempts) {
          sendAttempts++;
          try {
            txid = await connection.sendRawTransaction(currentSignedTx.serialize(), {
              skipPreflight: true,
              preflightCommitment: "confirmed",
              maxRetries: 5,
            });
            break; // Success, exit loop
          } catch (sendError: unknown) {
            const errorMessage = sendError instanceof Error ? sendError.message : String(sendError);
            console.error(`Send attempt ${sendAttempts} failed:`, errorMessage);

            // If blockhash error and we haven't hit max attempts, request fresh transaction from API
            if (
              sendAttempts < maxSendAttempts &&
              (errorMessage.includes("Blockhash not found") ||
                errorMessage.includes("block height exceeded"))
            ) {
              setLaunchStatus(`Retrying (${sendAttempts}/${maxSendAttempts})...`);

              // Request a completely new transaction from the API with fresh blockhash
              const retryResponse = await fetch("/api/launch-token", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "create-launch-tx",
                  data: {
                    ipfs: tokenMetadata,
                    tokenMint: tokenMint,
                    wallet: publicKey?.toBase58(),
                    initialBuyLamports: Math.floor(
                      parseFloat(initialBuySOL || "0") * 1_000_000_000
                    ),
                    configKey: configKey,
                  },
                }),
              });

              if (!retryResponse.ok) {
                const retryErr = await retryResponse.json();
                throw new Error(retryErr.error || "Failed to create retry transaction");
              }

              const retryResult = await retryResponse.json();
              let retryTxBase64 = retryResult.transaction;
              if (
                retryTxBase64 &&
                typeof retryTxBase64 === "object" &&
                "transaction" in retryTxBase64
              ) {
                retryTxBase64 = retryTxBase64.transaction;
              }

              const retryTransaction = deserializeTransaction(
                retryTxBase64,
                "retry-launch-transaction"
              );

              // Get fresh blockhash for confirmation tracking
              const freshBlockhash = await connection.getLatestBlockhash("confirmed");
              blockhash = freshBlockhash.blockhash;
              lastValidBlockHeight = freshBlockhash.lastValidBlockHeight;

              // Sign the fresh transaction
              setLaunchStatus("Please sign the transaction...");
              try {
                currentSignedTx = await signTransaction(retryTransaction);
              } catch (retrySignError: unknown) {
                const retrySignMsg =
                  retrySignError instanceof Error ? retrySignError.message : String(retrySignError);
                if (
                  retrySignMsg.includes("User rejected") ||
                  retrySignMsg.includes("rejected") ||
                  retrySignMsg.includes("closed")
                ) {
                  throw new Error("Transaction cancelled. Please try again.");
                }
                throw new Error(`Wallet signing failed: ${retrySignMsg}`);
              }
              setLaunchStatus("Broadcasting to Solana...");

              // Continue loop to try sending
            } else {
              throw sendError;
            }
          }
        }

        if (!txid) {
          throw new Error("Failed to send transaction after multiple attempts");
        }

        setLaunchStatus("Confirming transaction...");

        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(
          {
            signature: txid,
            blockhash,
            lastValidBlockHeight,
          },
          "confirmed"
        );
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
            username: ecosystemFee.displayName,
            bps: ecosystemFee.bps,
          },
          ...validFeeShares.map((f) => ({
            provider: f.provider,
            username: f.username.replace(/@/g, "").toLowerCase().trim(),
            bps: f.bps,
          })),
        ],
      };

      // Save to local storage (fast, offline-capable)
      saveLaunchedToken(launchedToken);

      // Save to global database (so everyone sees it)
      setLaunchStatus("Saving to global database...");
      const globalSaveSuccess = await saveTokenGlobally(launchedToken);

      // Dispatch custom event to notify useWorldState hook
      window.dispatchEvent(new CustomEvent("bagsworld-token-update"));

      setLaunchStatus("");
      if (globalSaveSuccess) {
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
    } catch (err) {
      setLaunchStatus("");
      const errorMessage = err instanceof Error ? err.message : "Failed to launch token";

      // Provide user-friendly error messages for common issues
      if (errorMessage.toLowerCase().includes("internal server error")) {
        setError(
          "Bags.fm API is temporarily unavailable. Please try again in a few minutes. If this persists, check bags.fm status."
        );
      } else if (errorMessage.toLowerCase().includes("rate limit")) {
        setError("Too many requests. Please wait a minute before trying again.");
      } else if (
        errorMessage.toLowerCase().includes("api key") ||
        errorMessage.toLowerCase().includes("unauthorized")
      ) {
        setError("API configuration issue. Please contact support.");
      } else if (
        errorMessage.toLowerCase().includes("insufficient") ||
        errorMessage.toLowerCase().includes("balance")
      ) {
        setError("Insufficient SOL balance in your wallet. Please add more SOL and try again.");
      } else if (
        errorMessage.toLowerCase().includes("user rejected") ||
        errorMessage.toLowerCase().includes("cancelled")
      ) {
        setError("Transaction was cancelled. Click Launch to try again.");
      } else {
        setError(errorMessage);
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
                Supported providers: <span className="text-bags-green">Twitter, GitHub, Kick</span>
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
