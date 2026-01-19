"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { VersionedTransaction, Transaction } from "@solana/web3.js";
import bs58 from "bs58";

/**
 * MINIMAL TEST LAUNCH BUTTON
 *
 * This is a simplified token launch flow that follows the Bags API docs exactly:
 * 1. Create token info (upload metadata + image to IPFS)
 * 2. Configure fee sharing (single claimer - your Twitter)
 * 3. Create and sign launch transaction
 *
 * No ecosystem fees, no complexity - just the bare minimum to test the API.
 */

function deserializeTransaction(encoded: string): VersionedTransaction | Transaction {
  console.log("[TEST] Deserializing transaction, length:", encoded?.length);
  console.log("[TEST] First 100 chars:", encoded?.substring(0, 100));

  if (!encoded || typeof encoded !== "string" || encoded.length < 50) {
    throw new Error(`Invalid transaction data: ${typeof encoded}, length: ${encoded?.length}`);
  }

  // Detect encoding: base58 uses alphanumeric chars (no + or /), base64 may have + / =
  const isLikelyBase64 = encoded.includes("+") || encoded.includes("/") || encoded.endsWith("=");

  let buffer: Uint8Array;

  if (isLikelyBase64) {
    console.log("[TEST] Detected base64 encoding");
    buffer = Buffer.from(encoded, "base64");
  } else {
    console.log("[TEST] Detected base58 encoding");
    try {
      buffer = bs58.decode(encoded);
    } catch (e) {
      console.log("[TEST] base58 decode failed, trying base64:", e);
      buffer = Buffer.from(encoded, "base64");
    }
  }

  console.log("[TEST] Buffer size:", buffer.length, "bytes");

  try {
    const tx = VersionedTransaction.deserialize(buffer);
    console.log("[TEST] Deserialized as VersionedTransaction");
    return tx;
  } catch (e1) {
    console.log("[TEST] VersionedTransaction failed:", e1);
    try {
      const tx = Transaction.from(buffer);
      console.log("[TEST] Deserialized as legacy Transaction");
      return tx;
    } catch (e2) {
      console.log("[TEST] Legacy Transaction failed:", e2);
      throw new Error(`Failed to deserialize: buffer ${buffer.length} bytes. Both VersionedTransaction and legacy Transaction parsing failed.`);
    }
  }
}

export function TestLaunchButton() {
  const { publicKey, connected, signTransaction } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Form state
  const [name, setName] = useState("Test Token");
  const [symbol, setSymbol] = useState("TEST");
  const [description, setDescription] = useState("A test token launched via BagsWorld");
  const [twitterUsername, setTwitterUsername] = useState("");
  const [initialBuySOL, setInitialBuySOL] = useState("0");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  const addLog = (msg: string) => {
    console.log("[TEST]", msg);
    setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].split('.')[0]} - ${msg}`]);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        setImageDataUrl(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTestLaunch = async () => {
    setError(null);
    setLogs([]);
    setIsLoading(true);

    try {
      // Check wallet
      if (!connected || !publicKey) {
        setWalletModalVisible(true);
        throw new Error("Connect wallet first");
      }

      if (!twitterUsername.trim()) {
        throw new Error("Enter your Twitter username for fee claiming");
      }

      const cleanUsername = twitterUsername.replace(/@/g, "").toLowerCase().trim();
      const initialBuyLamports = Math.floor(parseFloat(initialBuySOL || "0") * 1_000_000_000);

      addLog(`Starting test launch for $${symbol}`);
      addLog(`Fee claimer: twitter/@${cleanUsername} (100%)`);
      addLog(`Wallet: ${publicKey.toBase58()}`);
      addLog(`Initial buy: ${initialBuySOL} SOL (${initialBuyLamports} lamports)`);
      addLog(`Image: ${imageDataUrl ? "Custom uploaded" : "Will use default"}`);

      // ========================================
      // STEP 1: Create Token Info
      // ========================================
      setStatus("Step 1/3: Creating token metadata...");
      addLog("Calling /api/test-launch action=create-info");

      const infoRes = await fetch("/api/test-launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-info",
          name,
          symbol,
          description,
          imageDataUrl, // Pass image if uploaded
        }),
      });

      const infoData = await infoRes.json();
      addLog(`create-info response: ${JSON.stringify(infoData).substring(0, 500)}`);

      if (!infoRes.ok || !infoData.tokenMint) {
        throw new Error(infoData.error || "Failed to create token info");
      }

      const { tokenMint, tokenMetadata } = infoData;
      addLog(`Token mint: ${tokenMint}`);
      addLog(`Metadata IPFS: ${tokenMetadata}`);

      // ========================================
      // STEP 2: Configure Fee Sharing
      // ========================================
      setStatus("Step 2/3: Configuring fee sharing...");
      addLog("Calling /api/test-launch action=configure-fees");

      const feeRes = await fetch("/api/test-launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "configure-fees",
          mint: tokenMint,
          payer: publicKey.toBase58(),
          twitterUsername: cleanUsername,
        }),
      });

      const feeData = await feeRes.json();
      addLog(`configure-fees response: ${JSON.stringify(feeData).substring(0, 500)}`);

      if (!feeRes.ok) {
        throw new Error(feeData.error || "Failed to configure fees");
      }

      const { configKey, needsCreation, transactions: feeTransactions } = feeData;
      addLog(`Config key: ${configKey}`);
      addLog(`Needs creation: ${needsCreation}`);

      if (!configKey) {
        throw new Error("No configKey returned from fee config API");
      }

      // If fee config needs on-chain creation, sign those transactions
      if (needsCreation && feeTransactions?.length > 0) {
        addLog(`Signing ${feeTransactions.length} fee config transaction(s)`);

        if (!signTransaction) {
          throw new Error("Wallet doesn't support signing");
        }

        for (let i = 0; i < feeTransactions.length; i++) {
          setStatus(`Step 2/3: Signing fee config tx ${i + 1}/${feeTransactions.length}...`);
          addLog(`Fee tx ${i + 1} data length: ${feeTransactions[i].transaction?.length}`);

          const tx = deserializeTransaction(feeTransactions[i].transaction);
          const signed = await signTransaction(tx);

          setStatus(`Step 2/3: Broadcasting fee config tx ${i + 1}...`);

          // Send via server-side API to keep RPC URL secret
          const sendRes = await fetch("/api/send-transaction", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              signedTransaction: Buffer.from(signed.serialize()).toString("base64"),
            }),
          });

          const sendData = await sendRes.json();
          if (!sendRes.ok) {
            throw new Error(sendData.error || "Failed to send fee config transaction");
          }

          addLog(`Fee tx ${i + 1} confirmed: ${sendData.txid}`);
        }
      }

      // ========================================
      // STEP 3: Create Launch Transaction
      // ========================================
      setStatus("Step 3/3: Creating launch transaction...");
      addLog("Calling /api/test-launch action=create-launch-tx");

      const launchRes = await fetch("/api/test-launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create-launch-tx",
          ipfs: tokenMetadata,
          tokenMint,
          wallet: publicKey.toBase58(),
          configKey,
          initialBuyLamports,
        }),
      });

      const launchData = await launchRes.json();
      addLog(`create-launch-tx response keys: ${Object.keys(launchData).join(", ")}`);
      addLog(`transaction type: ${typeof launchData.transaction}`);
      addLog(`transaction length: ${launchData.transaction?.length}`);

      if (!launchRes.ok) {
        throw new Error(launchData.error || "Failed to create launch transaction");
      }

      if (!launchData.transaction) {
        addLog(`Full response: ${JSON.stringify(launchData)}`);
        throw new Error("No transaction in response");
      }

      // Sign and send
      setStatus("Step 3/3: Please sign in your wallet...");
      addLog("Deserializing launch transaction...");

      const launchTx = deserializeTransaction(launchData.transaction);

      if (!signTransaction) {
        throw new Error("Wallet doesn't support signing");
      }

      const signedLaunchTx = await signTransaction(launchTx);

      setStatus("Step 3/3: Broadcasting to Solana...");
      addLog("Broadcasting transaction via server...");

      // Send via server-side API to keep RPC URL secret
      const sendRes = await fetch("/api/send-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedTransaction: Buffer.from(signedLaunchTx.serialize()).toString("base64"),
        }),
      });

      const sendData = await sendRes.json();
      if (!sendRes.ok) {
        throw new Error(sendData.error || "Failed to send launch transaction");
      }

      const txid = sendData.txid;
      addLog(`SUCCESS! TX: ${txid}`);
      setStatus(`Token launched! TX: ${txid.substring(0, 20)}...`);

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      addLog(`ERROR: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-1 bg-yellow-600 hover:bg-yellow-500 text-black font-pixel text-[8px] border-2 border-yellow-400"
      >
        TEST LAUNCH
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] p-4">
      <div className="bg-gray-900 border-2 border-yellow-500 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center p-3 border-b border-yellow-500/50">
          <div>
            <h2 className="font-pixel text-sm text-yellow-500">TEST LAUNCH</h2>
            <p className="font-pixel text-[8px] text-gray-400">Minimal API test - no ecosystem fees</p>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white text-xl">
            &times;
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Image Upload */}
          <div className="flex justify-center">
            <label className="cursor-pointer">
              <div className="w-20 h-20 bg-black border-2 border-dashed border-yellow-500/50 flex items-center justify-center overflow-hidden">
                {imagePreview ? (
                  <img src={imagePreview} alt="Token" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-pixel text-[7px] text-gray-500 text-center px-1">
                    CLICK TO UPLOAD
                  </span>
                )}
              </div>
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
          </div>
          <p className="font-pixel text-[7px] text-gray-500 text-center">
            {imagePreview ? "Image uploaded" : "Optional - will use default if not provided"}
          </p>

          {/* Form */}
          <div className="space-y-3">
            <div>
              <label className="block font-pixel text-[9px] text-gray-400 mb-1">TOKEN NAME *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-black border border-yellow-500/50 p-2 font-pixel text-xs text-white"
              />
            </div>
            <div>
              <label className="block font-pixel text-[9px] text-gray-400 mb-1">SYMBOL *</label>
              <input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                className="w-full bg-black border border-yellow-500/50 p-2 font-pixel text-xs text-white"
                maxLength={10}
              />
            </div>
            <div>
              <label className="block font-pixel text-[9px] text-gray-400 mb-1">DESCRIPTION *</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-black border border-yellow-500/50 p-2 font-pixel text-xs text-white h-16 resize-none"
              />
            </div>
            <div>
              <label className="block font-pixel text-[9px] text-gray-400 mb-1">
                YOUR TWITTER USERNAME * (for 100% fee share)
              </label>
              <input
                type="text"
                value={twitterUsername}
                onChange={(e) => setTwitterUsername(e.target.value)}
                placeholder="@yourusername"
                className="w-full bg-black border border-yellow-500/50 p-2 font-pixel text-xs text-white"
              />
              <p className="font-pixel text-[7px] text-gray-500 mt-1">
                Must have wallet linked at bags.fm/settings
              </p>
            </div>
            <div>
              <label className="block font-pixel text-[9px] text-gray-400 mb-1">
                INITIAL BUY (SOL) - Optional
              </label>
              <input
                type="number"
                value={initialBuySOL}
                onChange={(e) => setInitialBuySOL(e.target.value)}
                placeholder="0"
                min="0"
                step="0.1"
                className="w-full bg-black border border-yellow-500/50 p-2 font-pixel text-xs text-white"
              />
              <p className="font-pixel text-[7px] text-gray-500 mt-1">
                SOL to buy your token at launch (0 = no initial buy)
              </p>
            </div>
          </div>

          {/* Status */}
          {status && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 p-2">
              <p className="font-pixel text-[9px] text-yellow-400">{status}</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 p-2">
              <p className="font-pixel text-[9px] text-red-400">{error}</p>
            </div>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <div className="bg-black border border-gray-700 p-2 max-h-48 overflow-y-auto">
              <p className="font-pixel text-[8px] text-gray-500 mb-1">DEBUG LOG:</p>
              {logs.map((log, i) => (
                <p key={i} className="font-mono text-[8px] text-gray-400 break-all">{log}</p>
              ))}
            </div>
          )}

          {/* Launch Button */}
          <button
            onClick={handleTestLaunch}
            disabled={isLoading || !twitterUsername.trim() || !name.trim() || !symbol.trim()}
            className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-500 text-black font-pixel text-sm border-2 border-yellow-400 disabled:border-gray-600"
          >
            {isLoading ? "TESTING..." : "RUN TEST LAUNCH"}
          </button>

          <p className="font-pixel text-[7px] text-gray-500 text-center">
            This creates a real token on Bags.fm mainnet. Use for testing only.
          </p>
        </div>
      </div>
    </div>
  );
}
