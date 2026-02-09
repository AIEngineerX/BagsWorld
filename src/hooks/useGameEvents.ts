"use client";

import { useEffect } from "react";

/**
 * Bulk-register window event listeners for Phaser game events.
 * Automatically removes all listeners on cleanup.
 *
 * @param events - Map of event names to handler functions
 * @param deps - Dependency array (like useEffect deps)
 */
export function useGameEvents(events: Record<string, EventListener>, deps: React.DependencyList) {
  useEffect(() => {
    const entries = Object.entries(events);
    for (const [name, handler] of entries) {
      window.addEventListener(name, handler);
    }
    return () => {
      for (const [name, handler] of entries) {
        window.removeEventListener(name, handler);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
