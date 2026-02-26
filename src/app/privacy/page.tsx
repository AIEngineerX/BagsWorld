import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | BagsWorld",
  description: "Privacy policy for BagsWorld — a pixel art game on Solana.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen flex flex-col bg-bags-darker">
      <header className="sticky top-0 z-50 h-14 bg-bags-dark border-b-4 border-bags-green flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="font-pixel text-[10px] text-gray-400 hover:text-bags-green transition-colors flex items-center gap-2"
          >
            <span>&lt;-</span>
            <span className="hidden sm:inline">BACK TO WORLD</span>
            <span className="sm:hidden">BACK</span>
          </Link>
        </div>
        <h1 className="font-pixel text-sm text-bags-green">PRIVACY</h1>
        <div className="w-24" />
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <h1 className="font-pixel text-xl text-bags-green mb-6">PRIVACY POLICY</h1>
          <p className="font-pixel text-[9px] text-gray-500 mb-8">
            Last updated: February 25, 2026
          </p>

          <div className="space-y-8 font-pixel text-[10px] text-gray-300 leading-relaxed">
            <section>
              <h2 className="text-sm text-bags-green mb-3">1. OVERVIEW</h2>
              <p>
                BagsWorld (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) is a pixel art game that
                visualizes real on-chain activity from Bags.fm on the Solana blockchain. This
                privacy policy explains what information we collect, how we use it, and your rights
                regarding your data.
              </p>
            </section>

            <section>
              <h2 className="text-sm text-bags-green mb-3">2. INFORMATION WE COLLECT</h2>

              <h3 className="text-bags-green/80 mb-2 mt-4">2.1 Wallet Address</h3>
              <p>
                When you connect a Solana wallet (such as Phantom), we receive your public wallet
                address. This is a public blockchain address and is not considered private
                information. We use it to display your token holdings, enable transactions, and
                provide personalized game features like token gating.
              </p>

              <h3 className="text-bags-green/80 mb-2 mt-4">2.2 On-Chain Data</h3>
              <p>
                BagsWorld reads publicly available on-chain data from the Solana blockchain and
                Bags.fm APIs, including token prices, market caps, fee claims, and trading activity.
                This data is already public and we do not collect or store it in association with
                individual users.
              </p>

              <h3 className="text-bags-green/80 mb-2 mt-4">2.3 Local Storage</h3>
              <p>
                We use browser localStorage to save your preferences and registered tokens locally
                on your device. This data never leaves your browser unless you explicitly take an
                action that sends it to our servers (such as registering a token).
              </p>

              <h3 className="text-bags-green/80 mb-2 mt-4">2.4 AI Chat Conversations</h3>
              <p>
                When you interact with AI characters in the game, your messages are sent to our
                server and processed via Anthropic&apos;s Claude API to generate responses.
                Conversations are not permanently stored and are discarded after the session ends.
                We do not use your chat messages to train AI models.
              </p>

              <h3 className="text-bags-green/80 mb-2 mt-4">2.5 X (Twitter) Authentication</h3>
              <p>
                If you choose to connect your X account via OAuth, we receive your X user ID and
                display name. This is used solely for authentication and posting daily reports. We
                do not access your X direct messages, followers, or other private account data.
              </p>
            </section>

            <section>
              <h2 className="text-sm text-bags-green mb-3">3. INFORMATION WE DO NOT COLLECT</h2>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Private keys or seed phrases (we never have access to these)</li>
                <li>Personal identifying information (name, email, phone number)</li>
                <li>Device identifiers or advertising IDs</li>
                <li>Location data</li>
                <li>Cookies for tracking or analytics</li>
              </ul>
            </section>

            <section>
              <h2 className="text-sm text-bags-green mb-3">4. HOW WE USE INFORMATION</h2>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Display your token holdings and game state</li>
                <li>Enable on-chain transactions you initiate (launches, trades, claims)</li>
                <li>Provide AI character conversations</li>
                <li>Enforce token gates (Casino, Oracle, Ballers Valley)</li>
                <li>Generate world state based on aggregate on-chain activity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-sm text-bags-green mb-3">5. DATA STORAGE AND SECURITY</h2>
              <p>
                We use Neon serverless PostgreSQL to store global token registry data and aggregate
                game state. Individual user data is minimal — primarily wallet addresses used during
                active sessions. All communication between your browser and our servers uses HTTPS
                encryption.
              </p>
            </section>

            <section>
              <h2 className="text-sm text-bags-green mb-3">6. THIRD-PARTY SERVICES</h2>
              <p className="mb-2">BagsWorld integrates with the following third-party services:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>
                  <span className="text-bags-green">Bags.fm API</span> — Token data, fee claims, and
                  launch transactions
                </li>
                <li>
                  <span className="text-bags-green">DexScreener / GeckoTerminal</span> — Market data
                  and chart embeds
                </li>
                <li>
                  <span className="text-bags-green">Anthropic Claude API</span> — AI character
                  conversations and name generation
                </li>
                <li>
                  <span className="text-bags-green">Replicate</span> — AI image generation for token
                  logos and banners
                </li>
                <li>
                  <span className="text-bags-green">Solana RPC (Helius)</span> — Blockchain
                  transaction submission and state queries
                </li>
                <li>
                  <span className="text-bags-green">Sol Incinerator</span> — Token burn and account
                  close operations
                </li>
              </ul>
              <p className="mt-2">
                Each third-party service has its own privacy policy. We recommend reviewing their
                policies for details on how they handle data.
              </p>
            </section>

            <section>
              <h2 className="text-sm text-bags-green mb-3">7. BLOCKCHAIN TRANSACTIONS</h2>
              <p>
                All Solana blockchain transactions (token launches, trades, fee claims, burns) are
                permanent and publicly visible. Once a transaction is submitted to the Solana
                network, it cannot be deleted or modified. You are responsible for reviewing
                transaction details before signing with your wallet.
              </p>
            </section>

            <section>
              <h2 className="text-sm text-bags-green mb-3">8. CHILDREN&apos;S PRIVACY</h2>
              <p>
                BagsWorld is not directed at children under 13. We do not knowingly collect
                information from children. If you believe a child has provided us with personal
                information, please contact us and we will delete it.
              </p>
            </section>

            <section>
              <h2 className="text-sm text-bags-green mb-3">9. YOUR RIGHTS</h2>
              <p>
                Since we collect minimal personal data, most privacy rights are automatically
                satisfied. You can disconnect your wallet at any time to stop sharing your address.
                You can clear your browser&apos;s localStorage to remove all locally stored
                preferences. For any data deletion requests, contact us at the email below.
              </p>
            </section>

            <section>
              <h2 className="text-sm text-bags-green mb-3">10. CHANGES TO THIS POLICY</h2>
              <p>
                We may update this privacy policy from time to time. Changes will be reflected on
                this page with an updated date. Continued use of BagsWorld after changes constitutes
                acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-sm text-bags-green mb-3">11. CONTACT</h2>
              <p>
                For privacy-related questions or concerns, reach us through the BagsWorld community
                channels at{" "}
                <a
                  href="https://bags.fm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bags-green hover:underline"
                >
                  bags.fm
                </a>{" "}
                or visit{" "}
                <a
                  href="https://bagsworld.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bags-green hover:underline"
                >
                  bagsworld.app
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>

      <footer className="h-8 bg-bags-dark border-t-4 border-bags-green flex items-center justify-center px-4">
        <div className="font-pixel text-[8px] text-gray-400">
          <span>POWERED BY </span>
          <a
            href="https://bags.fm"
            target="_blank"
            rel="noopener noreferrer"
            className="text-bags-green hover:underline"
          >
            BAGS.FM
          </a>
        </div>
      </footer>
    </div>
  );
}
