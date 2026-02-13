"use client";

import React from "react";
import type { ScreenProps } from "../types";
import { DIALOGUE } from "../constants";
import { DialogueBox } from "../DialogueBox";
import { OakSprite } from "../PixelSprites";

export function EducationScreens({ state, onAdvance }: ScreenProps) {
  const isFees = state.currentScreen === "education_fees";

  const lines = isFees ? DIALOGUE.education_fees : DIALOGUE.education_world;

  return (
    <div
      className="absolute inset-0 bg-gray-900 flex flex-col items-center overflow-hidden"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="presentation"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-black via-gray-900 to-gray-800" />

      {/* Oak sprite */}
      <div className="relative z-[5] mt-[15%] sm:mt-[10%]">
        <OakSprite className="scale-[2] sm:scale-[2.5]" />
      </div>

      {/* Info badge */}
      <div className="relative z-[5] mt-4 px-4">
        <div className="bg-black/60 border border-gray-700 rounded px-3 py-1">
          <p className="font-pixel text-[8px] text-bags-gold text-center">
            {isFees ? "FEE EDUCATION" : "WORLD EDUCATION"}
          </p>
        </div>
      </div>

      {/* Dialogue */}
      <DialogueBox lines={lines} speakerName="PROF. OAK" onComplete={onAdvance} />
    </div>
  );
}
