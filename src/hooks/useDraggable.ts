"use client";

import { useState, useEffect, useCallback, RefObject } from "react";

interface Position {
  x: number;
  y: number;
}

interface UseDraggableOptions {
  initialPosition?: Position;
  minY?: number;
  padding?: number;
  elementWidth?: number;
  elementHeight?: number;
}

interface UseDraggableReturn {
  position: Position;
  isDragging: boolean;
  handlePointerDown: (e: React.PointerEvent) => void;
}

/**
 * Hook for making elements draggable with pointer events (touch + mouse).
 * Shared across all chat components to eliminate code duplication.
 */
export function useDraggable(
  ref: RefObject<HTMLElement | null>,
  options: UseDraggableOptions = {}
): UseDraggableReturn {
  const {
    initialPosition = { x: 16, y: -1 },
    minY = 60,
    padding = 8,
    elementWidth = 320,
    elementHeight = 300,
  } = options;

  const [position, setPosition] = useState<Position>(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button, input, textarea")) return;
    const rect = ref.current?.getBoundingClientRect();
    if (rect) {
      setIsDragging(true);
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    }
  }, [ref]);

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      const chatWidth = Math.min(elementWidth, window.innerWidth - 32);
      const maxX = window.innerWidth - chatWidth;
      const maxY = window.innerHeight - elementHeight;

      setPosition({
        x: Math.max(padding, Math.min(newX, maxX - padding)),
        y: Math.max(minY, Math.min(newY, maxY)),
      });
    };

    const handlePointerUp = () => setIsDragging(false);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [isDragging, dragOffset, minY, padding, elementWidth, elementHeight]);

  return { position, isDragging, handlePointerDown };
}
