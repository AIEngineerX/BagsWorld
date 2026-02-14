"use client";

import React, { useCallback, useEffect } from "react";

interface GameBoyFrameProps {
  children: React.ReactNode;
  onClose?: () => void;
}

export function GameBoyFrame({ children, onClose }: GameBoyFrameProps) {
  // Disable pointer events on the game canvas while the wizard is open.
  // On mobile, touch events can leak through the overlay to Phaser's canvas
  // even though the overlay has a higher z-index.
  useEffect(() => {
    const gameCanvas = document.querySelector("canvas") as HTMLCanvasElement | null;
    const gameContainer = document.querySelector(".game-canvas-wrapper") as HTMLElement | null;

    if (gameCanvas) gameCanvas.style.pointerEvents = "none";
    if (gameContainer) gameContainer.style.pointerEvents = "none";

    return () => {
      if (gameCanvas) gameCanvas.style.pointerEvents = "";
      if (gameContainer) gameContainer.style.pointerEvents = "";
    };
  }, []);

  // Stop click/touch propagation on the backdrop so nothing leaks to elements below
  const handleBackdropEvent = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  // For touch events on the backdrop itself (not children), also preventDefault
  // to block any residual gesture handling by the browser
  const handleBackdropTouch = useCallback((e: React.TouchEvent) => {
    // Only preventDefault if the touch landed directly on the backdrop,
    // not when it bubbled up from a child (button, input, etc.)
    if (e.target === e.currentTarget) {
      e.preventDefault();
    }
    e.stopPropagation();
  }, []);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 z-[110] bg-black flex items-center justify-center"
      style={{ touchAction: "manipulation" }}
      onClick={handleBackdropEvent}
      onPointerDown={handleBackdropEvent}
      onTouchStart={handleBackdropTouch}
      onTouchMove={handleBackdropTouch}
      onTouchEnd={handleBackdropTouch}
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className="w-screen h-[100dvh] rounded-none p-0 sm:w-[480px] sm:h-[640px] sm:rounded-lg sm:p-3 bg-gray-700 border border-gray-600 shadow-2xl relative"
        onClick={handleBackdropEvent}
        onKeyDown={handleBackdropEvent}
      >
        {/* Screen area */}
        <div className="bg-black w-full h-full relative overflow-hidden">
          {/* Content */}
          {children}

          {/* Scanline overlay */}
          <div
            className="pointer-events-none absolute inset-0 z-10 opacity-10"
            style={{
              background:
                "repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.15) 0px, rgba(0, 0, 0, 0.15) 1px, transparent 1px, transparent 2px)",
            }}
          />

          {/* Skip button */}
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-2 right-2 font-pixel text-[8px] text-gray-600 hover:text-gray-400 cursor-pointer z-20"
              type="button"
            >
              [SKIP]
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
