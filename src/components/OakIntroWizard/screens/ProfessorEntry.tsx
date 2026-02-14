"use client";

import React, { useState, useEffect } from "react";
import type { ScreenProps } from "../types";
import { DIALOGUE } from "../constants";
import { DialogueBox } from "../DialogueBox";
import { OakSprite } from "../PixelSprites";

export function ProfessorEntry({ onAdvance }: ScreenProps) {
  const [entered, setEntered] = useState(false);
  const [showDialogue, setShowDialogue] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);

  // Fade from black, then slide Oak in
  useEffect(() => {
    const fadeTimer = requestAnimationFrame(() => setFadeIn(true));
    const enterTimer = setTimeout(() => setEntered(true), 300);
    return () => {
      cancelAnimationFrame(fadeTimer);
      clearTimeout(enterTimer);
    };
  }, []);

  // Show dialogue after sprite finishes sliding in
  useEffect(() => {
    if (!entered) return;
    const dialogueTimer = setTimeout(() => {
      setShowDialogue(true);
    }, 1500);
    return () => clearTimeout(dialogueTimer);
  }, [entered]);

  return (
    <div
      className="absolute inset-0 bg-gray-900 flex flex-col items-center overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
      style={{
        opacity: fadeIn ? 1 : 0,
        transition: "opacity 0.4s ease-out",
      }}
    >
      {/* Lab background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900 to-gray-800" />

      {/* Subtle spotlight behind Oak */}
      <div
        className="absolute z-[3] opacity-20"
        style={{
          top: "15%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 200,
          height: 200,
          background: "radial-gradient(circle, rgba(34,197,94,0.4) 0%, transparent 70%)",
        }}
      />

      {/* Professor Oak sliding up — positioned higher in frame */}
      <div
        className="relative z-[5] mt-[15%] sm:mt-[12%]"
        style={{
          transform: entered ? "translateY(0)" : "translateY(100vh)",
          transition: "transform 1.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        }}
      >
        <OakSprite className="scale-[2] sm:scale-[2.5]" />
      </div>

      {/* Dialogue box after entry animation completes */}
      {showDialogue && (
        <DialogueBox lines={DIALOGUE.welcome} speakerName="PROF. OAK" onComplete={onAdvance} />
      )}
    </div>
  );
}
