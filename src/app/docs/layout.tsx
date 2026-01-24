import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Documentation | BagsWorld",
  description:
    "Learn how to launch tokens, understand world mechanics, and integrate with Bags.fm in BagsWorld.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-bags-darker">
      {/* Header */}
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
        <h1 className="font-pixel text-sm text-bags-green">DOCS</h1>
        <div className="w-24" /> {/* Spacer for centering */}
      </header>

      {/* Main content area */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
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
