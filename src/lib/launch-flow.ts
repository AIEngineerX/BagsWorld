import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import type { PublicKey } from "@solana/web3.js";
import {
  deserializeTransaction,
  hasExistingSignatures as checkExistingSignatures,
  preSimulateTransaction,
} from "@/lib/transaction-utils";
import { saveLaunchedToken, saveTokenGlobally, type LaunchedToken } from "@/lib/token-registry";
import { getEcosystemFeeShare } from "@/lib/config";
import { getWriteRpcUrl } from "@/lib/env-utils";

export interface LaunchFlowParams {
  tokenData: {
    name: string;
    symbol: string;
    description: string;
    image: string; // data URL
    twitter?: string;
    telegram?: string;
    website?: string;
  };
  feeShares: { provider: string; providerUsername: string; bps: number }[];
  initialBuySOL: string;
  walletPublicKey: PublicKey;
  signAndSendTransaction: (
    tx: Transaction | VersionedTransaction,
    opts?: { maxRetries?: number }
  ) => Promise<string>;
  onStatus: (message: string) => void;
}

export interface LaunchFlowResult {
  success: boolean;
  tokenMint?: string;
  globalSaveSuccess?: boolean;
  error?: string;
}

/**
 * Execute the full token launch flow on Bags.fm.
 *
 * Steps:
 * 1. Create token info (upload metadata to IPFS)
 * 2. Configure fee sharing on-chain
 * 3. Create, sign, and broadcast the launch transaction
 * 4. Save to local registry and global database
 *
 * This function has no React dependencies and can be called from any context.
 */
export async function executeLaunchFlow(params: LaunchFlowParams): Promise<LaunchFlowResult> {
  const {
    tokenData,
    feeShares,
    initialBuySOL,
    walletPublicKey,
    signAndSendTransaction,
    onStatus,
  } = params;

  const ecosystemFee = getEcosystemFeeShare();

  const connection = new Connection(getWriteRpcUrl());

  try {
    // -----------------------------------------------------------------------
    // 1. Create token info via API
    // -----------------------------------------------------------------------
    onStatus("Uploading token metadata to IPFS...");
    const tokenInfoResponse = await fetch("/api/launch-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create-info",
        data: {
          name: tokenData.name,
          symbol: tokenData.symbol,
          description: tokenData.description,
          image: tokenData.image,
          twitter: tokenData.twitter || undefined,
          telegram: tokenData.telegram || undefined,
          website: tokenData.website || undefined,
        },
      }),
    });

    if (!tokenInfoResponse.ok) {
      const err = await tokenInfoResponse.json();
      throw new Error(err.error || "Failed to create token info");
    }

    const { tokenMint, tokenMetadata } = await tokenInfoResponse.json();

    // -----------------------------------------------------------------------
    // 2. Configure fee sharing (always includes ecosystem fee)
    // -----------------------------------------------------------------------
    // Build fee claimers array
    // All usernames should be lowercase (Bags API is case-insensitive but normalized)
    const userFeeClaimers = feeShares.map((f) => ({
      provider: f.provider,
      providerUsername: f.providerUsername.replace(/@/g, "").toLowerCase().trim(),
      bps: f.bps,
    }));

    // Include ecosystem fee if configured
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

    // Bags.fm API requires total BPS to equal exactly 10000 (100%)
    const userDefinedBps = userFeeClaimers.reduce((sum, f) => sum + f.bps, 0);
    const totalAllocatedBps = ecosystemFee.bps + userDefinedBps;
    if (totalAllocatedBps !== 10000) {
      throw new Error(
        `Fee shares must total exactly 100%. Currently ${(totalAllocatedBps / 100).toFixed(1)}%. Add fee claimers to allocate the remaining ${((10000 - totalAllocatedBps) / 100).toFixed(1)}% to Twitter/GitHub/Kick accounts.`
      );
    }

    onStatus("Configuring fee sharing...");

    let configKey: string | undefined;
    const feeConfigResponse = await fetch("/api/launch-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "configure-fees",
        data: {
          mint: tokenMint,
          payer: walletPublicKey.toBase58(),
          feeClaimers: allFeeClaimers,
        },
      }),
    });

    if (feeConfigResponse.ok) {
      const feeResult = await feeConfigResponse.json();
      configKey = feeResult.configId;

      // If the fee share config needs to be created on-chain, sign and submit the transactions
      if (feeResult.needsCreation && feeResult.transactions?.length > 0) {
        onStatus("Creating fee share config on-chain...");

        for (let i = 0; i < feeResult.transactions.length; i++) {
          const txData = feeResult.transactions[i];
          onStatus(`Signing fee config transaction ${i + 1}/${feeResult.transactions.length}...`);

          // Decode and sign the transaction (handles both versioned and legacy formats)
          const transaction = deserializeTransaction(txData.transaction, `fee-config-tx-${i + 1}`);

          const preSigned = checkExistingSignatures(transaction);

          // Only refresh blockhash if no existing signatures
          let blockhash: string;
          let lastValidBlockHeight: number;

          if (!preSigned) {
            const latestBlockhash = await connection.getLatestBlockhash("confirmed");
            blockhash = latestBlockhash.blockhash;
            lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;

            if (transaction instanceof VersionedTransaction) {
              transaction.message.recentBlockhash = blockhash;
            } else {
              transaction.recentBlockhash = blockhash;
            }
          } else {
            // Preserve the API's blockhash - changing it would invalidate existing signatures
            if (transaction instanceof VersionedTransaction) {
              blockhash = transaction.message.recentBlockhash;
            } else {
              blockhash = transaction.recentBlockhash!;
            }
            const latestBlockhash = await connection.getLatestBlockhash("confirmed");
            lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
          }

          // Pre-simulate with sigVerify:false to catch errors before wallet popup
          try {
            await preSimulateTransaction(connection, transaction);
          } catch (simError) {
            console.warn(`Fee config tx ${i + 1} simulation warning:`, simError);
            // Non-fatal: partially-signed txs may fail simulation - continue to wallet
          }

          let txid: string;
          try {
            // Use signAndSendTransaction for all cases — Phantom preferred
            // method that avoids Blowfish "malicious dapp" warning.
            // Phantom preserves existing signatures on pre-signed transactions.
            txid = await signAndSendTransaction(transaction, {
              maxRetries: 5,
            });
          } catch (signError: unknown) {
            const signErrorMsg = signError instanceof Error ? signError.message : String(signError);
            if (
              signErrorMsg.includes("User rejected") ||
              signErrorMsg.includes("rejected") ||
              signErrorMsg.includes("closed")
            ) {
              throw new Error(
                "Transaction cancelled. Please try again and approve all transactions in your wallet."
              );
            }
            throw new Error(`Transaction failed: ${signErrorMsg}`);
          }

          onStatus(
            `Confirming fee config transaction ${i + 1}/${feeResult.transactions.length}...`
          );

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

    // -----------------------------------------------------------------------
    // 3. Create launch transaction, sign it, and send to blockchain
    // -----------------------------------------------------------------------
    {
      onStatus("Creating launch transaction...");

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
            wallet: walletPublicKey.toBase58(),
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

      // Decode transaction (handles both versioned and legacy formats)
      const transaction = deserializeTransaction(txBase64, "launch-transaction");

      const preSigned = checkExistingSignatures(transaction);

      // Only refresh blockhash if there are no existing signatures
      // Otherwise we'd invalidate the API's signatures
      let blockhash: string;
      let lastValidBlockHeight: number;

      if (!preSigned) {
        const latestBlockhash = await connection.getLatestBlockhash("confirmed");
        blockhash = latestBlockhash.blockhash;
        lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;

        if (transaction instanceof VersionedTransaction) {
          transaction.message.recentBlockhash = blockhash;
        } else {
          transaction.recentBlockhash = blockhash;
        }
      } else {
        // Preserve the API's blockhash - changing it would invalidate existing signatures
        if (transaction instanceof VersionedTransaction) {
          blockhash = transaction.message.recentBlockhash;
        } else {
          blockhash = transaction.recentBlockhash!;
        }
        const latestBlockhash = await connection.getLatestBlockhash("confirmed");
        lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
      }

      // Pre-simulate with sigVerify:false to catch errors before wallet popup
      onStatus("Validating transaction...");
      try {
        await preSimulateTransaction(connection, transaction);
      } catch (simError) {
        console.warn("Launch tx simulation warning:", simError);
        // Non-fatal for pre-signed txs - Phantom will run its own simulation
      }

      onStatus("Please approve the transaction in your wallet...");

      // Use signAndSendTransaction (Phantom preferred) — avoids Blowfish
      // "malicious dapp" warning that signTransaction triggers.
      // Phantom preserves existing signatures (API's mint keypair) and
      // adds the user's signature before sending.
      let txid: string;
      try {
        txid = await signAndSendTransaction(transaction, { maxRetries: 5 });
      } catch (signError: unknown) {
        const signErrorMsg = signError instanceof Error ? signError.message : String(signError);
        console.error("Transaction failed:", signErrorMsg);

        if (signErrorMsg.includes("User rejected") || signErrorMsg.includes("rejected")) {
          throw new Error(
            "Transaction cancelled. Please try again and approve the transaction in your wallet."
          );
        }
        if (signErrorMsg.includes("Popup closed") || signErrorMsg.includes("closed")) {
          throw new Error("Wallet popup was closed. Please try again and complete the approval.");
        }
        if (signErrorMsg.includes("simulation") || signErrorMsg.includes("Simulation")) {
          throw new Error(
            `Transaction simulation failed: ${signErrorMsg}. This may be a temporary network issue - please try again.`
          );
        }
        throw new Error(`Transaction failed: ${signErrorMsg}`);
      }

      onStatus("Broadcasting to Solana...");

      onStatus("Confirming transaction...");

      // Wait for confirmation
      await connection.confirmTransaction(
        {
          signature: txid,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed"
      );
    }

    // -----------------------------------------------------------------------
    // 4. Save token to registry for the world to display
    // -----------------------------------------------------------------------
    const validFeeShares = feeShares.filter((f) => f.providerUsername.trim() !== "");

    const launchedToken: LaunchedToken = {
      mint: tokenMint,
      name: tokenData.name,
      symbol: tokenData.symbol,
      description: tokenData.description,
      imageUrl: tokenData.image || undefined,
      creator: walletPublicKey.toBase58(),
      createdAt: Date.now(),
      feeShares: [
        // Include ecosystem fee in saved data
        ...(ecosystemFee.bps > 0
          ? [
              {
                provider: "ecosystem",
                username: ecosystemFee.providerUsername,
                bps: ecosystemFee.bps,
              },
            ]
          : []),
        ...validFeeShares.map((f) => ({
          provider: f.provider,
          username: f.providerUsername.replace(/@/g, "").toLowerCase().trim(),
          bps: f.bps,
        })),
      ],
    };

    // Save to local storage (fast, offline-capable)
    saveLaunchedToken(launchedToken);

    // Save to global database (so everyone sees it)
    onStatus("Saving to global database...");
    const globalSaveSuccess = await saveTokenGlobally(launchedToken);

    // Dispatch custom event to notify useWorldState hook
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("bagsworld-token-update"));
    }

    onStatus("");
    return { success: true, tokenMint, globalSaveSuccess };
  } catch (err) {
    onStatus("");
    const errorMessage = err instanceof Error ? err.message : "Failed to launch token";

    // Provide user-friendly error messages for common issues
    if (errorMessage.toLowerCase().includes("internal server error")) {
      return {
        success: false,
        error:
          "Bags.fm API is temporarily unavailable. Please try again in a few minutes. If this persists, check bags.fm status.",
      };
    } else if (errorMessage.toLowerCase().includes("rate limit")) {
      return {
        success: false,
        error: "Too many requests. Please wait a minute before trying again.",
      };
    } else if (
      errorMessage.toLowerCase().includes("api key") ||
      errorMessage.toLowerCase().includes("unauthorized")
    ) {
      return {
        success: false,
        error: "API configuration issue. Please contact support.",
      };
    } else if (
      errorMessage.toLowerCase().includes("insufficient") ||
      errorMessage.toLowerCase().includes("balance")
    ) {
      return {
        success: false,
        error: "Insufficient SOL balance in your wallet. Please add more SOL and try again.",
      };
    } else if (
      errorMessage.toLowerCase().includes("user rejected") ||
      errorMessage.toLowerCase().includes("cancelled")
    ) {
      return {
        success: false,
        error: "Transaction was cancelled. Click Launch to try again.",
      };
    } else {
      return { success: false, error: errorMessage };
    }
  }
}
