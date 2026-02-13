import { useState, useEffect, useCallback, useRef } from "react";

interface UseTypewriterOptions {
  text: string;
  speed?: number;
  fastSpeed?: number;
  pauseDuration?: number;
  onComplete?: () => void;
}

interface UseTypewriterReturn {
  displayText: string;
  isComplete: boolean;
  isTyping: boolean;
  skip: () => void;
}

const PAUSE_TOKEN = "{PAUSE}";

function cleanText(text: string): string {
  return text.replaceAll(PAUSE_TOKEN, "");
}

export function useTypewriter({
  text,
  speed = 35,
  fastSpeed = 8,
  pauseDuration = 500,
  onComplete,
}: UseTypewriterOptions): UseTypewriterReturn {
  const [displayText, setDisplayText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const charIndexRef = useRef(0);
  const lastTimestampRef = useRef(0);
  const pauseUntilRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const isSpaceHeldRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const hasCompletedRef = useRef(false);

  onCompleteRef.current = onComplete;

  const skip = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    const cleaned = cleanText(text);
    setDisplayText(cleaned);
    setIsComplete(true);
    setIsTyping(false);
    if (!hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onCompleteRef.current?.();
    }
  }, [text]);

  // Reset when text changes
  useEffect(() => {
    charIndexRef.current = 0;
    lastTimestampRef.current = 0;
    pauseUntilRef.current = 0;
    hasCompletedRef.current = false;
    setDisplayText("");
    setIsComplete(false);
    setIsTyping(true);

    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    if (!text || text.length === 0) {
      setIsTyping(false);
      setIsComplete(true);
      return;
    }

    const animate = (timestamp: number) => {
      // Handle pause
      if (pauseUntilRef.current > 0) {
        if (timestamp < pauseUntilRef.current) {
          rafIdRef.current = requestAnimationFrame(animate);
          return;
        }
        pauseUntilRef.current = 0;
      }

      const currentSpeed = isSpaceHeldRef.current ? fastSpeed : speed;

      if (timestamp - lastTimestampRef.current < currentSpeed) {
        rafIdRef.current = requestAnimationFrame(animate);
        return;
      }

      lastTimestampRef.current = timestamp;
      const idx = charIndexRef.current;

      if (idx >= text.length) {
        setIsTyping(false);
        setIsComplete(true);
        if (!hasCompletedRef.current) {
          hasCompletedRef.current = true;
          onCompleteRef.current?.();
        }
        return;
      }

      // Check for pause token at current position
      if (text.substring(idx, idx + PAUSE_TOKEN.length) === PAUSE_TOKEN) {
        charIndexRef.current = idx + PAUSE_TOKEN.length;
        pauseUntilRef.current = timestamp + pauseDuration;
        rafIdRef.current = requestAnimationFrame(animate);
        return;
      }

      charIndexRef.current = idx + 1;
      const rawText = text.substring(0, charIndexRef.current);
      setDisplayText(cleanText(rawText));

      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [text, speed, fastSpeed, pauseDuration]);

  // Track spacebar hold state
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        isSpaceHeldRef.current = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        isSpaceHeldRef.current = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  return { displayText, isComplete, isTyping, skip };
}
