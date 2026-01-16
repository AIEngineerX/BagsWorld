import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "BagsWorld - Living Crypto Game",
  description:
    "A self-evolving pixel art world powered by Bags.fm on-chain activity",
  icons: {
    icon: "/favicon.ico",
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
