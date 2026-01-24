"use client";

import { useState, useCallback } from "react";
import { docsContent } from "@/lib/docs-content";
import { DocsSection } from "@/components/docs/DocsSection";
import { DocsSidebar, MobileDocsSidebar } from "@/components/docs/DocsSidebar";

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("launch-tokens");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavigate = useCallback((sectionId: string, itemId?: string) => {
    setActiveSection(itemId || sectionId);

    // Scroll to section/item
    const targetId = itemId || sectionId;
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  return (
    <div className="flex h-[calc(100vh-5.5rem)]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 bg-bags-dark border-r-4 border-bags-green flex-shrink-0">
        <DocsSidebar activeSection={activeSection} onNavigate={handleNavigate} />
      </aside>

      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="lg:hidden fixed bottom-4 left-4 z-30 btn-retro flex items-center gap-2"
        aria-label="Open navigation"
      >
        <span className="font-pixel text-[8px]">MENU</span>
      </button>

      {/* Mobile Sidebar */}
      <MobileDocsSidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        activeSection={activeSection}
        onNavigate={handleNavigate}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Welcome Section */}
          <div className="mb-8 bg-gradient-to-r from-bags-green/10 to-bags-gold/10 border-2 border-bags-green p-4">
            <h1 className="font-pixel text-sm text-bags-green mb-2">BAGSWORLD DOCUMENTATION</h1>
            <p className="font-pixel text-[9px] text-gray-300 leading-relaxed">
              Welcome to BagsWorld! This guide covers everything you need to know about launching
              tokens, understanding the world mechanics, and integrating with Bags.fm. Use the
              sidebar to navigate between sections.
            </p>
          </div>

          {/* Quick Links */}
          <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              onClick={() => handleNavigate("launch-tokens", "getting-started")}
              className="bg-bags-dark border-2 border-bags-green/50 p-3 hover:border-bags-green transition-colors text-left"
            >
              <span className="font-pixel text-[10px] text-bags-gold block mb-1">
                LAUNCH TOKENS
              </span>
              <span className="font-pixel text-[8px] text-gray-400">Create your first token</span>
            </button>
            <button
              onClick={() => handleNavigate("world-mechanics", "health-system")}
              className="bg-bags-dark border-2 border-bags-green/50 p-3 hover:border-bags-green transition-colors text-left"
            >
              <span className="font-pixel text-[10px] text-bags-gold block mb-1">
                WORLD MECHANICS
              </span>
              <span className="font-pixel text-[8px] text-gray-400">How the world works</span>
            </button>
            <button
              onClick={() => handleNavigate("bags-integration", "fee-claims")}
              className="bg-bags-dark border-2 border-bags-green/50 p-3 hover:border-bags-green transition-colors text-left"
            >
              <span className="font-pixel text-[10px] text-bags-gold block mb-1">BAGS.FM</span>
              <span className="font-pixel text-[8px] text-gray-400">Platform integration</span>
            </button>
          </div>

          {/* Documentation Sections */}
          {docsContent.map((section) => (
            <DocsSection key={section.id} section={section} />
          ))}

          {/* Footer Help */}
          <div className="mt-8 mb-4 bg-bags-dark border-2 border-bags-green/30 p-4 text-center">
            <p className="font-pixel text-[10px] text-gray-400 mb-2">NEED MORE HELP?</p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href="https://bags.fm"
                target="_blank"
                rel="noopener noreferrer"
                className="font-pixel text-[8px] text-bags-green hover:underline"
              >
                BAGS.FM
              </a>
              <span className="font-pixel text-[8px] text-gray-600">|</span>
              <a
                href="https://twitter.com/bagsfm"
                target="_blank"
                rel="noopener noreferrer"
                className="font-pixel text-[8px] text-bags-green hover:underline"
              >
                @BAGSFM
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
