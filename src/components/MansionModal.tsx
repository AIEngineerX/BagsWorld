"use client";

interface MansionModalProps {
  onClose: () => void;
  name?: string;
  holderRank?: number;
  holderAddress?: string;
  holderBalance?: number;
}

export function MansionModal({
  onClose,
  name,
  holderRank,
  holderAddress,
  holderBalance,
}: MansionModalProps) {
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Truncate address for display (show "Unclaimed" for placeholders)
  const isPlaceholder = holderAddress?.includes("xxxx");
  const truncatedAddress = !holderAddress
    ? "Unknown"
    : isPlaceholder
      ? "Unclaimed"
      : `${holderAddress.slice(0, 4)}...${holderAddress.slice(-4)}`;

  // Format balance
  const formattedBalance = holderBalance
    ? holderBalance >= 1000000
      ? `${(holderBalance / 1000000).toFixed(2)}M`
      : holderBalance >= 1000
        ? `${(holderBalance / 1000).toFixed(2)}K`
        : holderBalance.toFixed(2)
    : "0";

  // Rank title
  const getRankTitle = (rank: number | undefined) => {
    switch (rank) {
      case 1:
        return "Top Holder";
      case 2:
        return "2nd Largest";
      case 3:
        return "3rd Largest";
      case 4:
        return "4th Largest";
      case 5:
        return "5th Largest";
      default:
        return "Holder";
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 safe-area-bottom"
      onClick={handleBackdropClick}
    >
      <div className="bg-bags-dark border-2 border-yellow-400 w-full sm:max-w-sm max-h-[85vh] sm:max-h-[90vh] overflow-y-auto rounded-t-xl sm:rounded-lg">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-600 to-amber-500 p-3 sm:p-4 flex justify-between items-center">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded flex items-center justify-center">
              <span className="font-pixel text-lg sm:text-xl text-white">#{holderRank || "?"}</span>
            </div>
            <div>
              <h2 className="font-pixel text-white text-xs sm:text-sm">{name || `MANSION #${holderRank}`}</h2>
              <p className="font-pixel text-yellow-200 text-[7px] sm:text-[8px]">
                {getRankTitle(holderRank)} of $BagsWorld
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-yellow-200 font-pixel text-sm p-2 touch-target"
            aria-label="Close"
          >
            [X]
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Holder Info */}
          <div className="bg-bags-darker border border-yellow-400/30 rounded-lg p-4">
            <h3 className="font-pixel text-yellow-400 text-xs mb-3">HOLDER INFO</h3>

            <div className="space-y-3">
              {/* Wallet Address */}
              <div className="flex justify-between items-center">
                <span className="font-pixel text-gray-400 text-[10px]">Wallet</span>
                <span className="font-pixel text-white text-xs">{truncatedAddress}</span>
              </div>

              {/* Balance */}
              <div className="flex justify-between items-center">
                <span className="font-pixel text-gray-400 text-[10px]">Balance</span>
                <span className="font-pixel text-yellow-400 text-xs">
                  {formattedBalance} $BAGSWORLD
                </span>
              </div>

              {/* Rank */}
              <div className="flex justify-between items-center">
                <span className="font-pixel text-gray-400 text-[10px]">Rank</span>
                <span className="font-pixel text-yellow-400 text-xs">
                  #{holderRank} {getRankTitle(holderRank)}
                </span>
              </div>
            </div>
          </div>

          {/* Ballers Valley Info */}
          <div className="bg-bags-darker border border-gray-700 rounded-lg p-4">
            <h3 className="font-pixel text-gray-400 text-xs mb-2">BALLERS VALLEY</h3>
            <p className="font-pixel text-gray-500 text-[9px] leading-relaxed">
              The top 5 holders of $BagsWorld token are granted exclusive mansions in Ballers
              Valley. Hold more tokens to claim a spot!
            </p>
          </div>

          {/* View on Solscan - only show for real addresses */}
          {holderAddress && !holderAddress.includes("xxxx") && (
            <a
              href={`https://solscan.io/account/${holderAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-yellow-500 hover:bg-yellow-400 text-bags-dark font-pixel text-xs py-3 px-4 rounded text-center transition-colors"
            >
              VIEW ON SOLSCAN
            </a>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="w-full bg-bags-darker border border-gray-600 hover:border-gray-500 text-gray-400 font-pixel text-xs py-2 px-4 rounded transition-colors"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
