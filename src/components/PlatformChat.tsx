"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface PlatformChatProps {
  tokenName: string;
  tokenSymbol: string;
  tokenMint: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function PlatformChat({ tokenName, tokenSymbol, tokenMint }: PlatformChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsStreaming(true);

    // Add empty assistant message that we'll stream into
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/platform-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenName,
          symbol: tokenSymbol,
          message: text,
          history: messages,
        }),
      });

      if (!response.ok) {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "Hmm, I can't talk right now. Try again later!",
          };
          return updated;
        });
        setIsStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setIsStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: [DONE]")) continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6);
          try {
            const event = JSON.parse(jsonStr);
            if (
              event.type === "content_block_delta" &&
              event.delta?.type === "text_delta" &&
              event.delta.text
            ) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + event.delta.text,
                };
                return updated;
              });
            }
          } catch {
            // Non-JSON data line, skip
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Connection lost. Try again!",
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, messages, tokenName, tokenSymbol]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[340px] sm:h-[400px]">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <p className="font-pixel text-[10px] text-purple-400 mb-1">{tokenName} AI</p>
            <p className="font-pixel text-[8px] text-gray-500">
              Chat with the AI guardian of ${tokenSymbol}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] px-2.5 py-1.5 ${
                msg.role === "user"
                  ? "bg-bags-green/20 border border-bags-green/40 text-bags-green"
                  : "bg-purple-900/30 border border-purple-500/30 text-gray-200"
              }`}
            >
              {msg.role === "assistant" && (
                <p className="font-pixel text-[7px] text-purple-400 mb-0.5">{tokenName}</p>
              )}
              <p className="font-pixel text-[9px] sm:text-[8px] whitespace-pre-wrap break-words">
                {msg.content}
                {isStreaming && i === messages.length - 1 && msg.role === "assistant" && (
                  <span className="inline-block w-1.5 h-2.5 bg-purple-400 ml-0.5 animate-pulse" />
                )}
              </p>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-2 border-t border-bags-green/30">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage();
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Talk to ${tokenName}...`}
            disabled={isStreaming}
            className="flex-1 bg-bags-darker border border-purple-500/30 px-2 py-1.5 font-pixel text-[10px] sm:text-[8px] text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="px-3 py-1.5 bg-purple-600 text-white font-pixel text-[8px] hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isStreaming ? "..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
