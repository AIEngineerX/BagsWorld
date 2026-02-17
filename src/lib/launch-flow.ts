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
  const { tokenData, feeShares, initialBuySOL, walletPublicKey, signAndSendTransaction, onStatus } =
    params;

  const ecosystemFee = getEcosystemFeeShare();

  const connection = new Connection(getWriteRpcUrl());

  try {
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
      let errMsg = "Failed to create token info";
      try {
        const err = await tokenInfoResponse.json();
        errMsg = err.error || errMsg;
      } catch {
        errMsg = `API error ${tokenInfoResponse.status}: ${tokenInfoResponse.statusText}`;
      }
      throw new Error(errMsg);
    }

    const { tokenMint, tokenMetadata } = await tokenInfoResponse.json();

    const userFeeClaimers = feeShares.map((f) => ({
      provider: f.provider,
      providerUsername: f.providerUsername.replace(/@/g, "").toLowerCase().trim(),
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

      if (feeResult.needsCreation && feeResult.transactions?.length > 0) {
        onStatus("Creating fee share config on-chain...");

        for (let i = 0; i < feeResult.transactions.length; i++) {
          const txData = feeResult.transactions[i];
          onStatus(`Signing fee config transaction ${i + 1}/${feeResult.transactions.length}...`);

          const transaction = deserializeTransaction(txData.transaction, `fee-config-tx-${i + 1}`);

          const preSigned = checkExistingSignatures(transaction);

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
            if (transaction instanceof VersionedTransaction) {
              blockhash = transaction.message.recentBlockhash;
            } else {
              blockhash = transaction.recentBlockhash!;
            }
            const latestBlockhash = await connection.getLatestBlockhash("confirmed");
            lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
          }

          try {
            await preSimulateTransaction(connection, transaction);
          } catch (simError) {
            console.warn(`Fee config tx ${i + 1} simulation warning:`, simError);
          }

          let txid: string;
          try {
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
            if (
              signErrorMsg.includes("Blockhash not found") ||
              signErrorMsg.includes("block height exceeded") ||
              signErrorMsg.includes("BlockhashNotFound") ||
              signErrorMsg.includes("TransactionExpired")
            ) {
              throw new Error(
                "Transaction expired. This happens when signing takes too long. Please try again."
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
      let errorMsg = "Failed to configure fee sharing";
      try {
        const feeError = await feeConfigResponse.json();
        errorMsg = feeError.error || errorMsg;
      } catch {
        errorMsg = `Fee config API error ${feeConfigResponse.status}: ${feeConfigResponse.statusText}`;
      }
      console.error("Fee config error:", errorMsg);
      console.error("Fee claimers sent:", JSON.stringify(allFeeClaimers, null, 2));

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

    {
      onStatus("Creating launch transaction...");
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
        let errMsg = "Failed to create launch transaction";
        try {
          const err = await launchTxResponse.json();
          errMsg = err.error || errMsg;
        } catch {
          errMsg = `API error ${launchTxResponse.status}: ${launchTxResponse.statusText}`;
        }
        throw new Error(errMsg);
      }

      const launchResult = await launchTxResponse.json();

      let txEncoded = launchResult.transaction;

      if (txEncoded && typeof txEncoded === "object" && "transaction" in txEncoded) {
        txEncoded = txEncoded.transaction;
      }

      if (!txEncoded || typeof txEncoded !== "string") {
        console.error("Invalid transaction response:", launchResult);
        throw new Error(
          "No valid transaction received from API. The token may already exist or there was a server error."
        );
      }

      const transaction = deserializeTransaction(txEncoded, "launch-transaction");

      const preSigned = checkExistingSignatures(transaction);

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

      onStatus("Validating transaction...");
      try {
        await preSimulateTransaction(connection, transaction);
      } catch (simError) {
        console.warn("Launch tx simulation warning:", simError);
      }

      onStatus("Please approve the transaction in your wallet...");

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
        if (
          signErrorMsg.includes("Blockhash not found") ||
          signErrorMsg.includes("block height exceeded") ||
          signErrorMsg.includes("BlockhashNotFound") ||
          signErrorMsg.includes("TransactionExpired")
        ) {
          throw new Error(
            "Transaction expired. This happens when signing takes too long. Please try again."
          );
        }
        if (signErrorMsg.includes("simulation") || signErrorMsg.includes("Simulation")) {
          throw new Error(
            `Transaction simulation failed: ${signErrorMsg}. This may be a temporary network issue - please try again.`
          );
        }
        throw new Error(`Transaction failed: ${signErrorMsg}`);
      }

      onStatus("Confirming transaction...");
      await connection.confirmTransaction(
        {
          signature: txid,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed"
      );
    }

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

    saveLaunchedToken(launchedToken);

    onStatus("Saving to global database...");
    const globalSaveSuccess = await saveTokenGlobally(launchedToken);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("bagsworld-token-update"));
    }

    onStatus("");
    return { success: true, tokenMint, globalSaveSuccess };
  } catch (err) {
    onStatus("");
    const errorMessage = err instanceof Error ? err.message : "Failed to launch token";

    const lowerError = errorMessage.toLowerCase();
    if (lowerError.includes("internal server error")) {
      console.error("Launch flow error (API unavailable):", errorMessage);
      return {
        success: false,
        error:
          "Bags.fm API is temporarily unavailable. Please try again in a few minutes. If this persists, check bags.fm status.",
      };
    } else if (lowerError.includes("rate limit")) {
      return {
        success: false,
        error: "Too many requests. Please wait a minute before trying again.",
      };
    } else if (lowerError.includes("api key") || lowerError.includes("unauthorized")) {
      console.error("Launch flow error (auth):", errorMessage);
      return {
        success: false,
        error: "API configuration issue. Please contact support.",
      };
    } else if (
      lowerError.includes("insufficient") &&
      (lowerError.includes("sol") ||
        lowerError.includes("balance") ||
        lowerError.includes("lamport"))
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
