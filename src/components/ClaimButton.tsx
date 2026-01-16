"use client";

import { useState } from "react";
import { FeeClaimModal } from "./FeeClaimModal";

export function ClaimButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="font-pixel text-[10px] px-3 py-2 border-2 border-bags-gold bg-bags-gold/10 text-bags-gold hover:bg-bags-gold/20 transition-colors flex items-center gap-2"
      >
        <span className="text-sm">$</span>
        CLAIM FEES
      </button>

      {isOpen && <FeeClaimModal onClose={() => setIsOpen(false)} />}
    </>
  );
}
