import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Meet the Agents | BagsWorld",
  description:
    "Meet the 16+ AI agents that power BagsWorld. Chat with Ghost, Neo, Finn, and more. Real-time status from Railway, Ghost trading stats, scheduled tasks.",
  openGraph: {
    title: "Meet the Agents | BagsWorld",
    description: "The AI crew that powers BagsWorld - chat with 16+ agents",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Meet the Agents | BagsWorld",
    description: "The AI crew that powers BagsWorld - chat with 16+ agents",
  },
};

export default function AgentsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
