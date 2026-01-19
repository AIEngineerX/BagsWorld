"use client";

import { useState } from "react";
import { docsNavigation } from "@/lib/docs-content";

interface DocsSidebarProps {
  activeSection: string;
  onNavigate: (sectionId: string, itemId?: string) => void;
}

export function DocsSidebar({ activeSection, onNavigate }: DocsSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<string[]>(
    docsNavigation.map((s) => s.id)
  );

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  return (
    <nav className="h-full overflow-y-auto py-4 px-3">
      <div className="space-y-4">
        {docsNavigation.map((section) => (
          <div key={section.id}>
            <button
              onClick={() => {
                toggleSection(section.id);
                onNavigate(section.id);
              }}
              className={`w-full flex items-center justify-between font-pixel text-[10px] p-2 transition-colors ${
                activeSection === section.id
                  ? "text-bags-gold bg-bags-green/20"
                  : "text-bags-green hover:bg-bags-green/10"
              }`}
            >
              <span>{section.title}</span>
              <span className="text-[8px]">
                {expandedSections.includes(section.id) ? "[-]" : "[+]"}
              </span>
            </button>

            {expandedSections.includes(section.id) && (
              <div className="ml-2 mt-1 space-y-1 border-l-2 border-bags-green/30 pl-2">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(section.id, item.id)}
                    className={`w-full text-left font-pixel text-[8px] p-1.5 transition-colors ${
                      activeSection === item.id
                        ? "text-bags-gold bg-bags-green/10"
                        : "text-gray-400 hover:text-gray-200 hover:bg-bags-green/5"
                    }`}
                  >
                    {item.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </nav>
  );
}

// Mobile sidebar drawer
interface MobileDocsSidebarProps extends DocsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileDocsSidebar({
  isOpen,
  onClose,
  activeSection,
  onNavigate,
}: MobileDocsSidebarProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed left-0 top-0 bottom-0 w-64 bg-bags-dark border-r-4 border-bags-green z-50 lg:hidden">
        <div className="flex items-center justify-between p-3 border-b-2 border-bags-green/50">
          <span className="font-pixel text-[10px] text-bags-green">
            NAVIGATION
          </span>
          <button
            onClick={onClose}
            className="font-pixel text-sm p-2 text-gray-400 hover:text-white"
            aria-label="Close menu"
          >
            X
          </button>
        </div>
        <DocsSidebar
          activeSection={activeSection}
          onNavigate={(sectionId, itemId) => {
            onNavigate(sectionId, itemId);
            onClose();
          }}
        />
      </div>
    </>
  );
}
