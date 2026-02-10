"use client";

import { useState, useRef, useCallback } from "react";

export function useSwipeToDismiss(onDismiss: () => void, threshold = 100) {
  const [translateY, setTranslateY] = useState(0);
  const [isDismissing, setIsDismissing] = useState(false);
  const startY = useRef(0);
  const isDragging = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const target = e.currentTarget;
    if (target.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    isDragging.current = true;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      setTranslateY(dy);
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (translateY > threshold) {
      setIsDismissing(true);
      setTimeout(onDismiss, 200);
    } else {
      setTranslateY(0);
    }
  }, [translateY, threshold, onDismiss]);

  return { translateY, isDismissing, handlers: { onTouchStart, onTouchMove, onTouchEnd } };
}
