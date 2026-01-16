"use client";

import { useState } from "react";
import { LaunchModal } from "./LaunchModal";

export function LaunchButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="btn-retro group">
        <span className="group-hover:animate-bounce inline-block">🚀</span> LAUNCH TOKEN
      </button>

      {isOpen && <LaunchModal onClose={() => setIsOpen(false)} />}
    </>
  );
}
