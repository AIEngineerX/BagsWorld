"use client";

import { useState } from "react";
import { LaunchModal } from "./LaunchModal";
import { RocketIcon } from "./icons";

export function LaunchButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)} className="btn-retro group flex items-center gap-2">
        <span className="group-hover:animate-bounce inline-block">
          <RocketIcon size={14} />
        </span>
        LAUNCH TOKEN
      </button>

      {isOpen && <LaunchModal onClose={() => setIsOpen(false)} />}
    </>
  );
}
