"use client";

import { useRef, useCallback } from "react";

export function useActionGuard(cooldownMs = 1000) {
  const lastAction = useRef(0);

  const guard = useCallback(
    (fn: () => void | Promise<void>) => {
      const now = Date.now();
      if (now - lastAction.current < cooldownMs) return;
      lastAction.current = now;
      fn();
    },
    [cooldownMs]
  );

  return guard;
}
