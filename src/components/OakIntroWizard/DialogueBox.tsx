"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTypewriter } from "./useTypewriter";

interface DialogueBoxProps {
  lines: readonly string[];
  speakerName?: string;
  onComplete: () => void;
  autoAdvance?: boolean;
  autoAdvanceDelay?: number;
}

export function DialogueBox({
  lines,
  speakerName,
  onComplete,
  autoAdvance = false,
  autoAdvanceDelay = 1500,
}: DialogueBoxProps) {
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const onCompleteRef = useRef(onComplete);
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  onCompleteRef.current = onComplete;

  const currentLine = lines[currentLineIndex] ?? "";
  const isLastLine = currentLineIndex >= lines.length - 1;

  const handleLineComplete = useCallback(() => {
    // Line finished typing -- if autoAdvance, set a timer
    if (autoAdvance) {
      autoAdvanceTimerRef.current = setTimeout(() => {
        if (isLastLine) {
          onCompleteRef.current();
        } else {
          setCurrentLineIndex((prev) => prev + 1);
        }
      }, autoAdvanceDelay);
    }
  }, [autoAdvance, autoAdvanceDelay, isLastLine]);

  const { displayText, isComplete, isTyping, skip } = useTypewriter({
    text: currentLine,
    onComplete: handleLineComplete,
  });

  // Clean up auto-advance timer on unmount or line change
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current !== null) {
        clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, [currentLineIndex]);

  // Reset line index only when actual line content changes (not array reference)
  const linesKey = lines.join("\n");
  const prevLinesKeyRef = useRef(linesKey);
  useEffect(() => {
    if (linesKey !== prevLinesKeyRef.current) {
      prevLinesKeyRef.current = linesKey;
      setCurrentLineIndex(0);
    }
  }, [linesKey]);

  // Cooldown to prevent rapid-fire taps on mobile from blowing through dialogue
  const lastAdvanceRef = useRef(0);
  const ADVANCE_COOLDOWN_MS = 350;

  const handleInteraction = useCallback(() => {
    const now = Date.now();
    if (now - lastAdvanceRef.current < ADVANCE_COOLDOWN_MS) return;
    lastAdvanceRef.current = now;

    // Clear any pending auto-advance timer
    if (autoAdvanceTimerRef.current !== null) {
      clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }

    if (isTyping) {
      skip();
      return;
    }

    if (isComplete) {
      if (isLastLine) {
        onCompleteRef.current();
      } else {
        setCurrentLineIndex((prev) => prev + 1);
      }
    }
  }, [isTyping, isComplete, isLastLine, skip]);

  // Keyboard listener for Space/Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        handleInteraction();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleInteraction]);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-10">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="bg-black/95 border-t-4 border-bags-green p-4 min-h-[80px] cursor-pointer relative select-none"
        onClick={handleInteraction}
      >
        {/* Speaker name */}
        {speakerName && (
          <span className="text-bags-gold font-pixel text-xs mb-1 block">{speakerName}</span>
        )}

        {/* Dialogue text */}
        <p className="font-pixel text-sm text-white leading-relaxed pr-6">{displayText}</p>

        {/* Blinking advance indicator */}
        {isComplete && !isLastLine && (
          <span className="absolute bottom-2 right-3 font-pixel text-white animate-bounce">
            &#x25BC;
          </span>
        )}

        {/* Final line complete indicator */}
        {isComplete && isLastLine && (
          <span className="absolute bottom-2 right-3 font-pixel text-bags-green animate-bounce">
            &#x25BC;
          </span>
        )}
      </div>
    </div>
  );
}
