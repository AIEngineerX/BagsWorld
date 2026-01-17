import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "BagsWorld",
  description:
    "A gamified world powered by real Bags.fm trading on Solana. Launch tokens, watch buildings grow, and earn fees.",
  keywords: ["Solana", "crypto", "game", "Bags.fm", "DeFi", "pixel art", "token launch", "fee share"],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "32x32" },
    ],
    apple: "/favicon.svg",
  },
  openGraph: {
    title: "BagsWorld",
    description: "A gamified world powered by real Bags.fm trading on Solana. Launch tokens, watch buildings grow, and earn fees.",
    type: "website",
    siteName: "BagsWorld",
  },
  twitter: {
    card: "summary_large_image",
    title: "BagsWorld",
    description: "A gamified world powered by real Bags.fm trading on Solana. Built on Bags.fm.",
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
