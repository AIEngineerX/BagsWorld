"use client";

import { useState, useEffect, useRef } from "react";
import { ECOSYSTEM_CONFIG } from "@/lib/config";
import { useGameStore } from "@/lib/store";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Connection, VersionedTransaction } from "@solana/web3.js";

interface DevMessage {
  id: string;
  type: "dev" | "user" | "trade" | "error" | "success";
  message: string;
  timestamp: number;
  tradeData?: {
    action: "quote" | "buy" | "sell";
    token?: string;
    amount?: number;
    quote?: any;
    inputMint?: string;
    outputMint?: string;
  };
}

interface Position {
  x: number;
  y: number;
}

const DEV_QUOTES = ECOSYSTEM_CONFIG.dev.quotes;

// SOL mint address
const SOL_MINT = "So11111111111111111111111111111111111111112";

const TRADING_TOPICS = [
  {
    title: "Quick Trade",
    icon: "⚡",
    description: "Fast trade execution"
  },
  {
    title: "Get Quote",
    icon: "📊",
    description: "Check a token price"
  },
  {
    title: "Trenches",
    icon: "⛏️",
    description: "Ask about the market"
  },
  {
    title: "Alpha",
    icon: "🔥",
    description: "Get some insights"
  },
];

export function DevChat() {
  const [messages, setMessages] = useState<DevMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [position, setPosition] = useState<Position>({ x: -1, y: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [pendingTrade, setPendingTrade] = useState<DevMessage["tradeData"] | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { worldState } = useGameStore();
  const { publicKey, connected, signTransaction } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();

  // Listen for Dev click events
  useEffect(() => {
    const handleDevClick = () => {
      setIsOpen(true);
      if (messages.length === 0) {
        const randomQuote = DEV_QUOTES[Math.floor(Math.random() * DEV_QUOTES.length)];
        addMessage({
          id: `${Date.now()}-dev`,
          type: "dev",
          message: randomQuote,
          timestamp: Date.now(),
        });
      }
    };

    window.addEventListener("bagsworld-dev-click", handleDevClick);
    return () => {
      window.removeEventListener("bagsworld-dev-click", handleDevClick);
    };
  }, [messages.length]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    const rect = chatRef.current?.getBoundingClientRect();
    if (rect) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      const maxX = window.innerWidth - 320;
      const maxY = window.innerHeight - 400;

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const addMessage = (message: DevMessage) => {
    setMessages((prev) => [...prev.slice(-30), message]);
  };

  // Check if string looks like a Solana address (32-44 base58 chars)
  const isValidCA = (str: string): boolean => {
    const cleaned = str.trim();
    return cleaned.length >= 32 && cleaned.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(cleaned);
  };

  // Get quote for a token
  const getQuote = async (tokenCA: string, amountSol: number = 0.1): Promise<any> => {
    const response = await fetch("/api/trade", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "quote",
        data: {
          inputMint: SOL_MINT,
          outputMint: tokenCA,
          amount: amountSol,
          slippageBps: 100,
        },
      }),
    });
    return response.json();
  };

  // Execute a trade
  const executeTrade = async (tradeData: DevMessage["tradeData"]) => {
    if (!connected || !publicKey || !signTransaction) {
      setWalletModalVisible(true);
      addMessage({
        id: `${Date.now()}-dev`,
        type: "dev",
        message: "yo connect your wallet first. cant trade without it fam 👻",
        timestamp: Date.now(),
      });
      return;
    }

    if (!tradeData?.quote) {
      addMessage({
        id: `${Date.now()}-error`,
        type: "error",
        message: "no quote to execute. get a quote first.",
        timestamp: Date.now(),
      });
      return;
    }

    setIsExecuting(true);
    addMessage({
      id: `${Date.now()}-dev`,
      type: "dev",
      message: "aight lets do this. preparing your transaction... 🔄",
      timestamp: Date.now(),
    });

    try {
      // Get swap transaction
      const swapResponse = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "swap",
          data: {
            quoteResponse: tradeData.quote,
            userPublicKey: publicKey.toString(),
          },
        }),
      });

      const swapData = await swapResponse.json();

      if (!swapData.success || !swapData.transaction) {
        throw new Error(swapData.error || "Failed to create swap transaction");
      }

      // Decode and sign transaction
      const txBuffer = Buffer.from(swapData.transaction, "base64");
      const transaction = VersionedTransaction.deserialize(txBuffer);

      addMessage({
        id: `${Date.now()}-dev`,
        type: "dev",
        message: "transaction ready. sign it in your wallet 📝",
        timestamp: Date.now(),
      });

      const signedTx = await signTransaction(transaction);

      // Send transaction
      const connection = new Connection(
        process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com"
      );

      addMessage({
        id: `${Date.now()}-dev`,
        type: "dev",
        message: "sending to the chain... 🚀",
        timestamp: Date.now(),
      });

      const txid = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      // Wait for confirmation
      await connection.confirmTransaction(txid, "confirmed");

      addMessage({
        id: `${Date.now()}-success`,
        type: "success",
        message: `TRADE EXECUTED! 🎉\n\nTx: ${txid.slice(0, 8)}...${txid.slice(-8)}\n\nView on Solscan: solscan.io/tx/${txid}`,
        timestamp: Date.now(),
      });

      setPendingTrade(null);

    } catch (error: any) {
      console.error("Trade error:", error);
      addMessage({
        id: `${Date.now()}-error`,
        type: "error",
        message: `trade failed: ${error.message || "unknown error"}. try again or check your wallet.`,
        timestamp: Date.now(),
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleTopicClick = async (topic: typeof TRADING_TOPICS[0]) => {
    if (topic.title === "Quick Trade") {
      if (!connected) {
        addMessage({
          id: `${Date.now()}-dev`,
          type: "dev",
          message: "connect wallet first, then paste a contract address and ill handle the rest 👻",
          timestamp: Date.now(),
        });
        setWalletModalVisible(true);
      } else {
        addMessage({
          id: `${Date.now()}-dev`,
          type: "dev",
          message: `wallet ready: ${publicKey?.toString().slice(0, 6)}...${publicKey?.toString().slice(-4)}\n\npaste a CA or type "buy 0.1 SOL [CA]" and ill execute it for you. one click lfg 🚀`,
          timestamp: Date.now(),
        });
      }
    } else if (topic.title === "Get Quote") {
      addMessage({
        id: `${Date.now()}-dev`,
        type: "dev",
        message: "drop a contract address and ill check the price. you can also type:\n• quote [CA]\n• buy [amount] SOL [CA]",
        timestamp: Date.now(),
      });
    } else if (topic.title === "Trenches") {
      const trenchTalk = [
        "been in these trenches since 2021 fam. seen it all. rugs, pumps, the whole 9 yards. what you wanna know?",
        "the trenches are wild rn. lot of new tokens dropping. gotta stay sharp.",
        "real ones know - its not about timing the market, its about time IN the market. unless its a shitcoin then maybe dont hold lmao",
        "ngl the memecoin meta is strong rn. but always DYOR. i can help you check stuff.",
      ];
      addMessage({
        id: `${Date.now()}-dev`,
        type: "dev",
        message: trenchTalk[Math.floor(Math.random() * trenchTalk.length)],
        timestamp: Date.now(),
      });
    } else if (topic.title === "Alpha") {
      const alphaDrops = [
        "ok real talk - the best alpha is building. launch something. earn fees forever. thats the bags way.",
        "alpha: look for tokens with strong communities and actual utility. memes are fun but community is everything.",
        "here's some alpha: volume matters more than price. look for consistent trading activity, not just pumps.",
        "not financial advice but... builders get paid. check out the fee share system on bags.fm",
      ];
      addMessage({
        id: `${Date.now()}-dev`,
        type: "dev",
        message: alphaDrops[Math.floor(Math.random() * alphaDrops.length)],
        timestamp: Date.now(),
      });
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    const userMsg = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    addMessage({
      id: `${Date.now()}-user`,
      type: "user",
      message: userMsg,
      timestamp: Date.now(),
    });

    // Check for trade commands
    const buyMatch = userMsg.match(/^buy\s+([\d.]+)\s*sol\s+(.+)/i);
    const quoteMatch = userMsg.match(/^quote\s+(.+)/i);

    // Auto-detect if user just pasted a CA
    if (isValidCA(userMsg)) {
      addMessage({
        id: `${Date.now()}-dev`,
        type: "dev",
        message: "looks like a contract address. checking it out... 👀",
        timestamp: Date.now(),
      });

      try {
        const data = await getQuote(userMsg, 0.1);
        if (data.success && data.quote) {
          const outAmount = (parseInt(data.quote.outAmount) / 1e9).toFixed(4);
          const tradeData = {
            action: "quote" as const,
            token: userMsg,
            amount: 0.1,
            quote: data.quote,
            inputMint: SOL_MINT,
            outputMint: userMsg,
          };
          setPendingTrade(tradeData);
          addMessage({
            id: `${Date.now()}-trade`,
            type: "trade",
            message: `found it! 0.1 SOL = ~${outAmount} tokens\nPrice impact: ${data.quote.priceImpactPct}%`,
            timestamp: Date.now(),
            tradeData,
          });
          addMessage({
            id: `${Date.now()}-dev`,
            type: "dev",
            message: connected
              ? "want me to ape? type 'buy [amount] SOL' or hit the button below 👇"
              : "connect wallet to execute trades 👻",
            timestamp: Date.now(),
          });
        } else {
          addMessage({
            id: `${Date.now()}-error`,
            type: "error",
            message: "couldnt find that token or no liquidity. double check the CA fam.",
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        addMessage({
          id: `${Date.now()}-error`,
          type: "error",
          message: "api hiccup. try again.",
          timestamp: Date.now(),
        });
      }
      setIsLoading(false);
      return;
    }

    // Handle buy command with CA
    if (buyMatch) {
      const amount = parseFloat(buyMatch[1]);
      const tokenQuery = buyMatch[2].trim();

      if (isValidCA(tokenQuery)) {
        addMessage({
          id: `${Date.now()}-dev`,
          type: "dev",
          message: `checking ${amount} SOL -> token... 🔍`,
          timestamp: Date.now(),
        });

        try {
          const data = await getQuote(tokenQuery, amount);
          if (data.success && data.quote) {
            const outAmount = (parseInt(data.quote.outAmount) / 1e9).toFixed(4);
            const tradeData = {
              action: "buy" as const,
              token: tokenQuery,
              amount,
              quote: data.quote,
              inputMint: SOL_MINT,
              outputMint: tokenQuery,
            };
            setPendingTrade(tradeData);
            addMessage({
              id: `${Date.now()}-trade`,
              type: "trade",
              message: `${amount} SOL = ~${outAmount} tokens\nPrice impact: ${data.quote.priceImpactPct}%\nSlippage: 1%`,
              timestamp: Date.now(),
              tradeData,
            });

            if (connected) {
              addMessage({
                id: `${Date.now()}-dev`,
                type: "dev",
                message: "ready to execute. hit the button or type 'execute' 🚀",
                timestamp: Date.now(),
              });
            } else {
              addMessage({
                id: `${Date.now()}-dev`,
                type: "dev",
                message: "connect wallet to send this trade 👻",
                timestamp: Date.now(),
              });
            }
          } else {
            addMessage({
              id: `${Date.now()}-error`,
              type: "error",
              message: `couldnt get quote. ${data.error || "check the CA"}`,
              timestamp: Date.now(),
            });
          }
        } catch (error) {
          addMessage({
            id: `${Date.now()}-error`,
            type: "error",
            message: "api error - try again",
            timestamp: Date.now(),
          });
        }
        setIsLoading(false);
        return;
      } else {
        addMessage({
          id: `${Date.now()}-dev`,
          type: "dev",
          message: "need a valid contract address fam. paste the full CA.",
          timestamp: Date.now(),
        });
        setIsLoading(false);
        return;
      }
    }

    // Handle execute command
    if (userMsg.toLowerCase() === "execute" || userMsg.toLowerCase() === "send" || userMsg.toLowerCase() === "ape") {
      if (pendingTrade) {
        executeTrade(pendingTrade);
        setIsLoading(false);
        return;
      } else {
        addMessage({
          id: `${Date.now()}-dev`,
          type: "dev",
          message: "no trade queued. get a quote first by pasting a CA or using 'buy [amount] SOL [CA]'",
          timestamp: Date.now(),
        });
        setIsLoading(false);
        return;
      }
    }

    // Quote command
    if (quoteMatch) {
      const tokenCA = quoteMatch[1].trim();
      if (isValidCA(tokenCA)) {
        try {
          const data = await getQuote(tokenCA, 0.1);
          if (data.success && data.quote) {
            const outAmount = (parseInt(data.quote.outAmount) / 1e9).toFixed(4);
            const tradeData = {
              action: "quote" as const,
              token: tokenCA,
              amount: 0.1,
              quote: data.quote,
              inputMint: SOL_MINT,
              outputMint: tokenCA,
            };
            setPendingTrade(tradeData);
            addMessage({
              id: `${Date.now()}-trade`,
              type: "trade",
              message: `0.1 SOL = ~${outAmount} tokens\nPrice impact: ${data.quote.priceImpactPct}%`,
              timestamp: Date.now(),
              tradeData,
            });
          } else {
            addMessage({
              id: `${Date.now()}-error`,
              type: "error",
              message: `couldnt get quote for that token.`,
              timestamp: Date.now(),
            });
          }
        } catch (error) {
          addMessage({
            id: `${Date.now()}-error`,
            type: "error",
            message: `api error - try again`,
            timestamp: Date.now(),
          });
        }
        setIsLoading(false);
        return;
      }
    }

    // Regular chat - send to Claude API
    try {
      const response = await fetch("/api/character-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: "dev",
          userMessage: userMsg,
          chatHistory: messages.slice(-6).map((m) => ({
            role: m.type === "user" ? "user" : "assistant",
            content: m.message,
          })),
          worldState: worldState ? {
            health: worldState.health,
            weather: worldState.weather,
            buildingCount: worldState.buildings.length,
            populationCount: worldState.population.length,
          } : undefined,
        }),
      });

      const data = await response.json();
      addMessage({
        id: `${Date.now()}-dev`,
        type: "dev",
        message: data.message || "ngl having a brain fart rn. try again?",
        timestamp: Date.now(),
      });
    } catch (error) {
      addMessage({
        id: `${Date.now()}-dev`,
        type: "dev",
        message: "connection issues fam. wifi acting up.",
        timestamp: Date.now(),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const chatStyle: React.CSSProperties = position.x >= 0 && position.y >= 0
    ? { left: position.x, top: position.y, right: 'auto', bottom: 'auto' }
    : { right: 20, bottom: 80 };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={chatRef}
      style={chatStyle}
      className={`fixed z-50 w-80 bg-bags-dark border-4 border-purple-500 shadow-lg ${isDragging ? 'cursor-grabbing' : ''}`}
    >
      {/* Header - Draggable */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between p-2 border-b-4 border-purple-500 cursor-grab active:cursor-grabbing select-none bg-gradient-to-r from-purple-600/20 to-cyan-500/20"
      >
        <div className="flex items-center gap-2">
          <span className="font-pixel text-sm">👻</span>
          <div>
            <p className="font-pixel text-[10px] text-purple-400">
              THE DEV&apos;S TRADING DESK
            </p>
            <p className="font-pixel text-[8px] text-gray-400">
              @DaddyGhost • drag to move
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="font-pixel text-xs text-gray-400 hover:text-white px-2"
        >
          [X]
        </button>
      </div>

      {/* Topic Buttons */}
      <div className="p-2 border-b border-purple-500/30 bg-bags-darker">
        <div className="flex flex-wrap gap-1">
          {TRADING_TOPICS.map((topic, i) => (
            <button
              key={i}
              onClick={() => handleTopicClick(topic)}
              className="px-2 py-1 bg-purple-500/10 border border-purple-500/30 font-pixel text-[7px] text-purple-300 hover:bg-purple-500/20 hover:text-purple-200 transition-colors"
              title={topic.description}
            >
              {topic.icon} {topic.title}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="h-44 overflow-y-auto p-2 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center py-4">
            <p className="font-pixel text-[10px] text-purple-400 mb-1">
              👻 yo, im the dev
            </p>
            <p className="font-pixel text-[8px] text-gray-400">
              paste a contract address and ill trade for you
            </p>
            <p className="font-pixel text-[7px] text-gray-500 mt-2">
              commands: buy [SOL] [CA] | quote [CA] | execute
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`p-2 border-l-2 ${
                msg.type === "dev"
                  ? "bg-purple-500/10 border-purple-500"
                  : msg.type === "user"
                  ? "bg-cyan-500/10 border-cyan-500 ml-4"
                  : msg.type === "trade"
                  ? "bg-green-500/10 border-green-500"
                  : msg.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500"
                  : "bg-red-500/10 border-red-500"
              }`}
            >
              {msg.type === "dev" && (
                <p className="font-pixel text-[6px] text-purple-400 mb-1">The Dev:</p>
              )}
              {msg.type === "user" && (
                <p className="font-pixel text-[6px] text-cyan-400 mb-1">You:</p>
              )}
              {msg.type === "trade" && (
                <p className="font-pixel text-[6px] text-green-400 mb-1">📊 Quote Ready:</p>
              )}
              {msg.type === "success" && (
                <p className="font-pixel text-[6px] text-emerald-400 mb-1">✅ Success:</p>
              )}
              {msg.type === "error" && (
                <p className="font-pixel text-[6px] text-red-400 mb-1">⚠️ Error:</p>
              )}
              <p className="font-pixel text-[8px] text-white whitespace-pre-wrap">
                {msg.message}
              </p>
            </div>
          ))
        )}
        {isLoading && (
          <div className="p-2 border-l-2 bg-purple-500/10 border-purple-500">
            <p className="font-pixel text-[8px] text-purple-300 animate-pulse">checking...</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Execute Trade Button - shows when there's a pending trade */}
      {pendingTrade && connected && (
        <div className="px-2 pb-2">
          <button
            onClick={() => executeTrade(pendingTrade)}
            disabled={isExecuting}
            className="w-full py-2 bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-pixel text-[10px] hover:from-purple-500 hover:to-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isExecuting ? "🔄 EXECUTING..." : `⚡ EXECUTE TRADE (${pendingTrade.amount || 0.1} SOL)`}
          </button>
        </div>
      )}

      {/* Chat Input */}
      <div className="p-2 border-t border-purple-500/30">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="paste CA or type command..."
            disabled={isLoading || isExecuting}
            className="flex-1 bg-bags-darker border border-purple-500/30 px-2 py-1 font-pixel text-[8px] text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || isExecuting || !inputValue.trim()}
            className="px-2 py-1 bg-purple-500 text-white font-pixel text-[8px] hover:bg-purple-400 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
      </div>

      {/* Footer with wallet status */}
      <div className="p-2 border-t border-purple-500/30 bg-bags-darker">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <p className="font-pixel text-[7px] text-gray-400">
              {connected
                ? `${publicKey?.toString().slice(0, 4)}...${publicKey?.toString().slice(-4)} | ready to trade`
                : 'connect wallet to trade'}
            </p>
          </div>
          <a
            href="https://x.com/DaddyGhost"
            target="_blank"
            rel="noopener noreferrer"
            className="font-pixel text-[7px] text-purple-400 hover:text-purple-300"
          >
            @DaddyGhost →
          </a>
        </div>
      </div>
    </div>
  );
}
