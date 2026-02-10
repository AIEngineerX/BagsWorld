import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dashboard | BagsWorld",
  description: "Central hub for BagsWorld - browse characters, zones, and features.",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-bags-darker">
      <header className="sticky top-0 z-50 h-14 bg-bags-dark border-b-4 border-bags-green flex items-center justify-between px-4">
        <Link
          href="/"
          className="font-pixel text-[10px] px-3 py-1.5 bg-bags-green/10 border border-bags-green/40 text-bags-green hover:bg-bags-green/20 hover:text-white transition-all flex items-center gap-2"
        >
          <span>&lt;-</span>
          <span className="hidden sm:inline">BACK TO WORLD</span>
          <span className="sm:hidden">BACK</span>
        </Link>
        <h1 className="font-pixel text-sm text-bags-green">DASHBOARD</h1>
        <Link
          href="/"
          className="font-pixel text-[10px] px-3 py-1.5 bg-black/60 border border-red-500/40 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all"
          title="Exit dashboard"
        >
          [X] EXIT
        </Link>
      </header>
      <main className="flex-1">{children}</main>
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
