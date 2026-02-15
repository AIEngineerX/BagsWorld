// Launch utility functions shared between LaunchModal and QuickLaunchPanel.
// Fresh implementations calling the same APIs — LaunchModal is NOT modified.

import { Connection, VersionedTransaction } from "@solana/web3.js";
import {
  deserializeTransaction,
  hasExistingSignatures as checkExistingSignatures,
  preSimulateTransaction,
  sendSignedTransaction,
} from "@/lib/transaction-utils";
import {
  saveLaunchedToken,
  saveTokenGlobally,
  getAllWorldTokens,
  type LaunchedToken,
} from "@/lib/token-registry";
import { getEcosystemFeeShare } from "@/lib/config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeeShareEntry {
  provider: string;
  username: string;
  bps: number; // basis points (100 = 1%)
}

export interface LaunchFormData {
  name: string;
  symbol: string;
  description: string;
  twitter?: string;
  telegram?: string;
  website?: string;
}

export interface LaunchResult {
  success: boolean;
  mint?: string;
  error?: string;
  globalSaved?: boolean;
}

export interface NameSuggestion {
  name: string;
  ticker: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml"];
const MAX_IMAGE_SIZE_MB = 10;

export function validateImageFile(file: File): string | null {
  if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
    return `File is too large. Maximum size is ${MAX_IMAGE_SIZE_MB}MB.`;
  }
  if (!VALID_IMAGE_TYPES.includes(file.type)) {
    return "Invalid file type. Please upload PNG, JPG, GIF, WEBP, or SVG.";
  }
  return null;
}

export function checkDuplicateToken(
  name: string,
  symbol: string
): { name: string | null; symbol: string | null } {
  const tokens = getAllWorldTokens();
  const warnings = { name: null as string | null, symbol: null as string | null };

  if (name.trim()) {
    const dup = tokens.find((t) => t.name.toLowerCase() === name.trim().toLowerCase());
    if (dup) warnings.name = `A token named "${dup.name}" already exists`;
  }

  if (symbol.trim()) {
    const sym = symbol.trim().toUpperCase().replace(/^\$/, "");
    const dup = tokens.find((t) => t.symbol.toUpperCase() === sym);
    if (dup) warnings.symbol = `Symbol $${dup.symbol} is already in use`;
  }

  return warnings;
}

export function validateFeeShares(shares: FeeShareEntry[], ecosystemBps: number): string | null {
  const userBps = shares.reduce((sum, f) => sum + (f.username.trim() ? f.bps : 0), 0);
  const total = userBps + ecosystemBps;
  if (total !== 10000) {
    return `Total fee share must equal exactly 100%. Currently ${(total / 100).toFixed(1)}%`;
  }
  const valid = shares.filter((f) => f.username.trim());
  if (valid.length === 0) {
    return "Add at least one fee claimer with a username";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Cost estimator
// ---------------------------------------------------------------------------

export function estimateLaunchCost(initialBuySOL: number): {
  network: number;
  initialBuy: number;
  total: number;
} {
  const network = 0.01; // approximate SOL for tx fees + rent
  return { network, initialBuy: initialBuySOL, total: network + initialBuySOL };
}

// ---------------------------------------------------------------------------
// AI generation helpers
// ---------------------------------------------------------------------------

async function oakGenerate(
  action: string,
  concept: string,
  style: string
): Promise<{ success: boolean; [key: string]: unknown }> {
  const res = await fetch("/api/oak-generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, concept, style }),
  });
  if (!res.ok) return { success: false, error: `API error: ${res.status}` };
  return res.json();
}

export const generateNameSuggestions = (concept: string, style: string) =>
  oakGenerate("suggest-names", concept, style) as Promise<{
    success: boolean;
    names?: NameSuggestion[];
    error?: string;
  }>;

export const generateLogo = (concept: string, style: string) =>
  oakGenerate("generate-logo", concept, style) as Promise<{
    success: boolean;
    imageUrl?: string;
    error?: string;
  }>;

export const generateBanner = (concept: string, style: string) =>
  oakGenerate("generate-banner", concept, style) as Promise<{
    success: boolean;
    imageUrl?: string;
    error?: string;
  }>;

// ---------------------------------------------------------------------------
// Launch flow
// ---------------------------------------------------------------------------

interface SignTransaction {
  (
    tx: VersionedTransaction | import("@solana/web3.js").Transaction
  ): Promise<VersionedTransaction | import("@solana/web3.js").Transaction>;
}
interface SignAndSend {
  (
    tx: VersionedTransaction | import("@solana/web3.js").Transaction,
    opts?: { maxRetries?: number }
  ): Promise<string>;
}

export async function executeLaunchFlow(opts: {
  formData: LaunchFormData;
  imageDataUrl: string;
  bannerDataUrl?: string | null;
  feeShares: FeeShareEntry[];
  initialBuySOL: number;
  walletPublicKey: string;
  signTransaction: SignTransaction;
  signAndSend: SignAndSend;
  onStatus: (msg: string) => void;
}): Promise<LaunchResult> {
  const {
    formData,
    imageDataUrl,
    bannerDataUrl,
    feeShares,
    initialBuySOL,
    walletPublicKey,
    signTransaction,
    signAndSend,
    onStatus,
  } = opts;

  const ecosystemFee = getEcosystemFeeShare();

  // 1. Create token info
  onStatus("Uploading token metadata to IPFS...");
  const infoRes = await fetch("/api/launch-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "create-info",
      data: {
        name: formData.name,
        symbol: formData.symbol,
        description: formData.description,
        image: imageDataUrl,
        twitter: formData.twitter || undefined,
        telegram: formData.telegram || undefined,
        website: formData.website || undefined,
      },
    }),
  });

  if (!infoRes.ok) {
    const err = await infoRes.json();
    throw new Error(err.error || "Failed to create token info");
  }

  const { tokenMint, tokenMetadata } = await infoRes.json();

  // 2. Configure fee sharing
  const validFeeShares = feeShares.filter((f) => f.username.trim());
  const userFeeClaimers = validFeeShares.map((f) => ({
    provider: f.provider,
    providerUsername: f.username.replace(/@/g, "").toLowerCase().trim(),
    bps: f.bps,
  }));

  let allFeeClaimers = [...userFeeClaimers];
  if (ecosystemFee.bps > 0) {
    allFeeClaimers = [
      {
        provider: ecosystemFee.provider,
        providerUsername: ecosystemFee.providerUsername.toLowerCase().trim(),
        bps: ecosystemFee.bps,
      },
      ...userFeeClaimers,
    ];
  }

  const totalAllocatedBps = ecosystemFee.bps + validFeeShares.reduce((s, f) => s + f.bps, 0);
  if (totalAllocatedBps !== 10000) {
    throw new Error(
      `Fee shares must total exactly 100%. Currently ${(totalAllocatedBps / 100).toFixed(1)}%.`
    );
  }

  onStatus("Configuring fee sharing...");
  const feeRes = await fetch("/api/launch-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "configure-fees",
      data: { mint: tokenMint, payer: walletPublicKey, feeClaimers: allFeeClaimers },
    }),
  });

  let configKey: string | undefined;
  if (feeRes.ok) {
    const feeResult = await feeRes.json();
    configKey = feeResult.configId;

    if (feeResult.needsCreation && feeResult.transactions?.length > 0) {
      onStatus("Creating fee share config on-chain...");
      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://rpc.ankr.com/solana"
      );

      for (let i = 0; i < feeResult.transactions.length; i++) {
        const txData = feeResult.transactions[i];
        onStatus(`Signing fee config transaction ${i + 1}/${feeResult.transactions.length}...`);

        const transaction = deserializeTransaction(txData.transaction, `fee-config-tx-${i + 1}`);
        const preSigned = checkExistingSignatures(transaction);

        let blockhash: string;
        let lastValidBlockHeight: number;

        if (!preSigned) {
          const latest = await connection.getLatestBlockhash("confirmed");
          blockhash = latest.blockhash;
          lastValidBlockHeight = latest.lastValidBlockHeight;
          if (transaction instanceof VersionedTransaction) {
            transaction.message.recentBlockhash = blockhash;
          } else {
            transaction.recentBlockhash = blockhash;
          }
        } else {
          blockhash =
            transaction instanceof VersionedTransaction
              ? transaction.message.recentBlockhash
              : transaction.recentBlockhash!;
          const latest = await connection.getLatestBlockhash("confirmed");
          lastValidBlockHeight = latest.lastValidBlockHeight;
        }

        try {
          await preSimulateTransaction(connection, transaction);
        } catch {
          // Non-fatal for pre-signed txs
        }

        let txid: string;
        if (preSigned) {
          const signedTx = await signTransaction(transaction);
          onStatus(`Broadcasting fee config ${i + 1}/${feeResult.transactions.length}...`);
          txid = await sendSignedTransaction(connection, signedTx, { maxRetries: 5 });
        } else {
          txid = await signAndSend(transaction, { maxRetries: 5 });
        }

        onStatus(`Confirming fee config ${i + 1}/${feeResult.transactions.length}...`);
        await connection.confirmTransaction(
          { signature: txid, blockhash, lastValidBlockHeight },
          "confirmed"
        );
      }
    }
  } else {
    const feeError = await feeRes.json();
    const errorMsg = feeError.error || "Failed to configure fee sharing";
    if (errorMsg.toLowerCase().includes("could not find wallet")) {
      throw new Error(
        `${errorMsg}. The user needs to link their wallet at bags.fm/settings first.`
      );
    }
    throw new Error(errorMsg);
  }

  if (!configKey) throw new Error("Fee configuration failed - no config key received");

  // 3. Create launch transaction
  onStatus("Creating launch transaction...");
  const initialBuyLamports = Math.floor(initialBuySOL * 1_000_000_000);

  const launchTxRes = await fetch("/api/launch-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "create-launch-tx",
      data: {
        ipfs: tokenMetadata,
        tokenMint,
        wallet: walletPublicKey,
        initialBuyLamports,
        configKey,
      },
    }),
  });

  if (!launchTxRes.ok) {
    const err = await launchTxRes.json();
    throw new Error(err.error || "Failed to create launch transaction");
  }

  const launchResult = await launchTxRes.json();
  let txBase64 = launchResult.transaction;
  if (txBase64 && typeof txBase64 === "object" && "transaction" in txBase64) {
    txBase64 = txBase64.transaction;
  }
  if (!txBase64 || typeof txBase64 !== "string") {
    throw new Error("No valid transaction received from API.");
  }

  const transaction = deserializeTransaction(txBase64, "launch-transaction");
  const connection = new Connection(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://rpc.ankr.com/solana"
  );
  const preSigned = checkExistingSignatures(transaction);

  let blockhash: string;
  let lastValidBlockHeight: number;

  if (!preSigned) {
    const latest = await connection.getLatestBlockhash("confirmed");
    blockhash = latest.blockhash;
    lastValidBlockHeight = latest.lastValidBlockHeight;
    if (transaction instanceof VersionedTransaction) {
      transaction.message.recentBlockhash = blockhash;
    } else {
      transaction.recentBlockhash = blockhash;
    }
  } else {
    blockhash =
      transaction instanceof VersionedTransaction
        ? transaction.message.recentBlockhash
        : transaction.recentBlockhash!;
    const latest = await connection.getLatestBlockhash("confirmed");
    lastValidBlockHeight = latest.lastValidBlockHeight;
  }

  onStatus("Validating transaction...");
  try {
    await preSimulateTransaction(connection, transaction);
  } catch {
    // Non-fatal for pre-signed txs
  }

  onStatus("Please sign the transaction in your wallet...");
  const signedTx = await signTransaction(transaction);

  onStatus("Broadcasting to Solana...");
  const txid = await sendSignedTransaction(connection, signedTx, { maxRetries: 5 });

  onStatus("Confirming transaction...");
  await connection.confirmTransaction(
    { signature: txid, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  // 4. Save token to registry
  const launchedToken: LaunchedToken = {
    mint: tokenMint,
    name: formData.name,
    symbol: formData.symbol,
    description: formData.description,
    imageUrl: imageDataUrl,
    creator: walletPublicKey,
    createdAt: Date.now(),
    feeShares: validFeeShares.map((f) => ({
      provider: f.provider,
      username: f.username.replace(/@/g, "").toLowerCase().trim(),
      bps: f.bps,
    })),
  };

  saveLaunchedToken(launchedToken);

  onStatus("Saving to global database...");
  const globalSaved = await saveTokenGlobally(launchedToken);

  window.dispatchEvent(new CustomEvent("bagsworld-token-update"));

  return { success: true, mint: tokenMint, globalSaved };
}
