/**
 * MansionModal Component Tests
 *
 * Tests the mansion holder info modal with:
 * - Display of landmark names and holder info
 * - Placeholder vs real address handling
 * - Solscan link visibility
 * - Balance formatting
 * - Close functionality
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MansionModal } from "@/components/MansionModal";

describe("MansionModal Component", () => {
  const mockOnClose = jest.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  describe("Landmark name display", () => {
    it("should display provided name in header", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="Wallet1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          holderBalance={10000000}
        />
      );
      expect(screen.getByText("Grand Palace")).toBeInTheDocument();
    });

    it("should display all landmark names correctly", () => {
      const landmarks = [
        { name: "Grand Palace", rank: 1 },
        { name: "Obsidian Tower", rank: 2 },
        { name: "Amethyst Chateau", rank: 3 },
        { name: "Platinum Estate", rank: 4 },
        { name: "Emerald Manor", rank: 5 },
      ];

      landmarks.forEach(({ name, rank }) => {
        const { unmount } = render(
          <MansionModal
            onClose={mockOnClose}
            name={name}
            holderRank={rank}
            holderAddress="WalletXxx"
            holderBalance={1000000}
          />
        );
        expect(screen.getByText(name)).toBeInTheDocument();
        unmount();
      });
    });

    it("should fallback to MANSION #X when name not provided", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          holderRank={3}
          holderAddress="WalletXxx"
          holderBalance={1000000}
        />
      );
      expect(screen.getByText("MANSION #3")).toBeInTheDocument();
    });
  });

  describe("Rank display", () => {
    it("should display rank number in badge", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="Wallet1"
          holderBalance={10000000}
        />
      );
      expect(screen.getByText("#1")).toBeInTheDocument();
    });

    it("should display ? when rank not provided", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Test Mansion"
          holderAddress="Wallet1"
          holderBalance={10000000}
        />
      );
      expect(screen.getByText("#?")).toBeInTheDocument();
    });

    it("should display correct rank titles", () => {
      const rankTitles = [
        { rank: 1, title: "Top Holder" },
        { rank: 2, title: "2nd Largest" },
        { rank: 3, title: "3rd Largest" },
        { rank: 4, title: "4th Largest" },
        { rank: 5, title: "5th Largest" },
      ];

      rankTitles.forEach(({ rank, title }) => {
        const { unmount } = render(
          <MansionModal
            onClose={mockOnClose}
            name={`Mansion ${rank}`}
            holderRank={rank}
            holderAddress="WalletXxx"
            holderBalance={1000000}
          />
        );
        // Use getAllByText since title appears in multiple places
        const matches = screen.getAllByText(new RegExp(title));
        expect(matches.length).toBeGreaterThan(0);
        unmount();
      });
    });

    it("should display Holder for undefined rank title", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Test Mansion"
          holderRank={10}
          holderAddress="Wallet1"
          holderBalance={10000000}
        />
      );
      expect(screen.getByText(/Holder of \$BagsWorld/)).toBeInTheDocument();
    });
  });

  describe("Address display", () => {
    it("should truncate real wallet addresses", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="ABCDqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqWXYZ"
          holderBalance={10000000}
        />
      );
      expect(screen.getByText("ABCD...WXYZ")).toBeInTheDocument();
    });

    it("should display Unclaimed for placeholder addresses", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="BaGs1WhaLeHoLderxxxxxxxxxxxxxxxxxxxxxxxxx"
          holderBalance={10000000}
        />
      );
      expect(screen.getByText("Unclaimed")).toBeInTheDocument();
    });

    it("should display Unknown when address is empty", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress=""
          holderBalance={10000000}
        />
      );
      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });

    it("should display Unknown when address is undefined", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderBalance={10000000}
        />
      );
      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });
  });

  describe("Balance formatting", () => {
    it("should format millions with M suffix", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="Wallet1"
          holderBalance={12500000}
        />
      );
      expect(screen.getByText(/12\.50M \$BAGSWORLD/)).toBeInTheDocument();
    });

    it("should format thousands with K suffix", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="Wallet1"
          holderBalance={500000}
        />
      );
      expect(screen.getByText(/500\.00K \$BAGSWORLD/)).toBeInTheDocument();
    });

    it("should format small amounts without suffix", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="Wallet1"
          holderBalance={999}
        />
      );
      expect(screen.getByText(/999\.00 \$BAGSWORLD/)).toBeInTheDocument();
    });

    it("should display 0 when balance is undefined", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="Wallet1"
        />
      );
      expect(screen.getByText(/0 \$BAGSWORLD/)).toBeInTheDocument();
    });

    it("should display 0 when balance is zero", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="Wallet1"
          holderBalance={0}
        />
      );
      expect(screen.getByText(/0 \$BAGSWORLD/)).toBeInTheDocument();
    });
  });

  describe("Solscan link", () => {
    it("should show Solscan button for real addresses", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="RealWallet123abcdefghijklmnopqrstuvwxyz12"
          holderBalance={10000000}
        />
      );
      expect(screen.getByText("VIEW ON SOLSCAN")).toBeInTheDocument();
    });

    it("should have correct Solscan URL for real addresses", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="RealWallet123"
          holderBalance={10000000}
        />
      );
      const link = screen.getByText("VIEW ON SOLSCAN").closest("a");
      expect(link).toHaveAttribute(
        "href",
        "https://solscan.io/account/RealWallet123"
      );
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("should NOT show Solscan button for placeholder addresses", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="BaGs1WhaLeHoLderxxxxxxxxxxxxxxxxxxxxxxxxx"
          holderBalance={10000000}
        />
      );
      expect(screen.queryByText("VIEW ON SOLSCAN")).not.toBeInTheDocument();
    });

    it("should NOT show Solscan button when address contains xxxx", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="Somexxxxplaceholder"
          holderBalance={10000000}
        />
      );
      expect(screen.queryByText("VIEW ON SOLSCAN")).not.toBeInTheDocument();
    });

    it("should NOT show Solscan button when address is empty", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress=""
          holderBalance={10000000}
        />
      );
      expect(screen.queryByText("VIEW ON SOLSCAN")).not.toBeInTheDocument();
    });
  });

  describe("Close functionality", () => {
    it("should call onClose when X button clicked", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="Wallet1"
          holderBalance={10000000}
        />
      );

      const closeButton = screen.getByLabelText("Close");
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when CLOSE button clicked", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="Wallet1"
          holderBalance={10000000}
        />
      );

      const closeButton = screen.getByText("CLOSE");
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("should call onClose when backdrop clicked", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="Wallet1"
          holderBalance={10000000}
        />
      );

      // Click on the backdrop (the outer div)
      const backdrop = screen.getByText("Grand Palace").closest(".fixed");
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
      }
    });

    it("should NOT close when modal content clicked", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="Wallet1"
          holderBalance={10000000}
        />
      );

      // Click on the modal content (inner div)
      const content = screen.getByText("HOLDER INFO");
      fireEvent.click(content);
      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe("Static content", () => {
    it("should display HOLDER INFO section", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="Wallet1"
          holderBalance={10000000}
        />
      );
      expect(screen.getByText("HOLDER INFO")).toBeInTheDocument();
    });

    it("should display BALLERS VALLEY section", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="Wallet1"
          holderBalance={10000000}
        />
      );
      expect(screen.getByText("BALLERS VALLEY")).toBeInTheDocument();
    });

    it("should display informational text about top 5 holders", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="Wallet1"
          holderBalance={10000000}
        />
      );
      expect(
        screen.getByText(/top 5 holders of \$BagsWorld token/i)
      ).toBeInTheDocument();
    });

    it("should display Wallet label", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="Wallet1"
          holderBalance={10000000}
        />
      );
      expect(screen.getByText("Wallet")).toBeInTheDocument();
    });

    it("should display Balance label", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="Wallet1"
          holderBalance={10000000}
        />
      );
      expect(screen.getByText("Balance")).toBeInTheDocument();
    });

    it("should display Rank label", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="Wallet1"
          holderBalance={10000000}
        />
      );
      expect(screen.getByText("Rank")).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("should handle very long addresses", () => {
      const longAddress = "A".repeat(100);
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress={longAddress}
          holderBalance={10000000}
        />
      );
      // Should truncate to first 4 and last 4 characters
      expect(screen.getByText("AAAA...AAAA")).toBeInTheDocument();
    });

    it("should handle very large balance", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="Wallet1"
          holderBalance={999999999999}
        />
      );
      // 999999999999 / 1000000 = 999999.999999, which rounds to 1000000.00M
      expect(screen.getByText(/1000000\.00M \$BAGSWORLD/)).toBeInTheDocument();
    });

    it("should handle negative balance gracefully", () => {
      render(
        <MansionModal
          onClose={mockOnClose}
          name="Grand Palace"
          holderRank={1}
          holderAddress="Wallet1"
          holderBalance={-1000}
        />
      );
      // Should still render (behavior depends on implementation)
      expect(screen.getByText(/\$BAGSWORLD/)).toBeInTheDocument();
    });

    it("should handle all props undefined", () => {
      render(<MansionModal onClose={mockOnClose} />);
      expect(screen.getByText("MANSION #undefined")).toBeInTheDocument();
      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });
  });
});
