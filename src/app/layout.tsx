import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "BagsWorld",
  description:
    "A gamified world powered by real Bags.fm trading on Solana. Launch tokens, watch buildings grow, and earn fees.",
  keywords: ["Solana", "crypto", "game", "Bags.fm", "DeFi", "pixel art", "token launch", "fee share"],
  manifest: "/manifest.json",
  themeColor: "#4ade80",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  icons: {
    icon: [
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/icon-128.png", sizes: "128x128", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BagsWorld",
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
