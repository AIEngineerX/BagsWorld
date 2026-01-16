import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "BagsWorld - Living Pixel Art Crypto World",
  description:
    "A self-evolving pixel art game world that lives and dies based on real Bags.fm on-chain activity. Launch tokens, watch buildings grow, and earn fees from trading.",
  keywords: ["Solana", "crypto", "game", "Bags.fm", "DeFi", "pixel art", "token launch", "fee share"],
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "BagsWorld - Living Pixel Art Crypto World",
    description: "A self-evolving pixel art game powered by real Solana trading data. Launch tokens, watch buildings grow based on market cap, and earn fees.",
    type: "website",
    siteName: "BagsWorld",
  },
  twitter: {
    card: "summary_large_image",
    title: "BagsWorld - Living Pixel Art Crypto World",
    description: "A self-evolving pixel art game powered by real Solana trading data. Built on Bags.fm.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bags-darker antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
