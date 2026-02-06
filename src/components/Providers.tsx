"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useMemo, useEffect, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";
import { useDeepLinks } from "@/hooks/useDeepLinks";
import { isNativePlatform } from "@/lib/platform";

// Import wallet adapter styles
import "@solana/wallet-adapter-react-ui/styles.css";

/** Initialize Capacitor plugins when running in native shell */
function useCapacitorInit() {
  useEffect(() => {
    if (!isNativePlatform()) return;

    async function init() {
      try {
        // Hide splash screen once the app is loaded
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide({ fadeOutDuration: 300 });

        // Configure status bar for dark theme
        const { StatusBar, Style } = await import("@capacitor/status-bar");
        await StatusBar.setStyle({ style: Style.Dark });
      } catch {
        // Plugins not available, running in browser
      }
    }

    init();
  }, []);
}

/** Inner component that uses hooks requiring the wallet context */
function CapacitorBridge({ children }: { children: ReactNode }) {
  useDeepLinks();
  useCapacitorInit();
  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30000,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  // Solana connection endpoint
  // Priority: env var > Ankr public (more reliable for txs) > Solana public
  const endpoint = useMemo(() => {
    if (process.env.NEXT_PUBLIC_SOLANA_RPC_URL) {
      return process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    }
    // Ankr public RPC - allows transaction sending unlike Solana's public endpoint
    return "https://rpc.ankr.com/solana";
  }, []);

  // Supported wallets — Phantom deep-link is handled separately for native iOS
  // The standard PhantomWalletAdapter works on web and inside Phantom's in-app browser
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <QueryClientProvider client={queryClient}>
            <CapacitorBridge>{children}</CapacitorBridge>
          </QueryClientProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
