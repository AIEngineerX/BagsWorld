"use client";

import React, { useCallback } from "react";

interface GameBoyFrameProps {
  children: React.ReactNode;
  onClose?: () => void;
}

export function GameBoyFrame({ children, onClose }: GameBoyFrameProps) {
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div className="fixed inset-0 z-[110] bg-black flex items-center justify-center">
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className="w-screen h-[100dvh] rounded-none p-0 sm:w-[480px] sm:h-[640px] sm:rounded-lg sm:p-3 bg-gray-700 border border-gray-600 shadow-2xl relative"
        onClick={handleContainerClick}
        onKeyDown={handleKeyDown}
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
