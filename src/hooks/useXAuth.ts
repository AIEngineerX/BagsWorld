"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface XUser {
  username: string;
  name?: string;
  profileImage?: string;
}

interface XAuthState {
  user: XUser | null;
  isLoading: boolean;
  error: string | null;
}

interface XAuthResult {
  type: "x-auth-success" | "x-auth-error";
  username?: string;
  name?: string;
  profileImage?: string;
  error?: string;
}

export function useXAuth() {
  const [state, setState] = useState<XAuthState>({
    user: null,
    isLoading: false,
    error: null,
  });
  const popupRef = useRef<Window | null>(null);

  // Listen for postMessage from callback popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verify origin
      if (event.origin !== window.location.origin) {
        return;
      }

      const data = event.data as XAuthResult;

      if (data.type === "x-auth-success" && data.username) {
        setState({
          user: {
            username: data.username,
            name: data.name,
            profileImage: data.profileImage,
          },
          isLoading: false,
          error: null,
        });
      } else if (data.type === "x-auth-error") {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: data.error || "Authentication failed",
        }));
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const signIn = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Get authorization URL from API
      const response = await fetch("/api/auth/x");
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to initialize OAuth");
      }

      const { authUrl } = await response.json();

      // Calculate popup position (center of screen)
      const width = 500;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      // Open popup
      popupRef.current = window.open(
        authUrl,
        "x-oauth-popup",
        `width=${width},height=${height},left=${left},top=${top},popup=1`
      );

      if (!popupRef.current) {
        // Popup was blocked - fall back to redirect
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Popup blocked. Please allow popups and try again.",
        }));
        return;
      }

      // Check if popup was closed without completing auth
      const checkPopup = setInterval(() => {
        if (popupRef.current?.closed) {
          clearInterval(checkPopup);
          setState((prev) => {
            // Only set loading to false if still loading (not already handled by message)
            if (prev.isLoading) {
              return { ...prev, isLoading: false };
            }
            return prev;
          });
        }
      }, 500);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to sign in",
      }));
    }
  }, []);

  const signOut = useCallback(() => {
    setState({
      user: null,
      isLoading: false,
      error: null,
    });
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    user: state.user,
    isLoading: state.isLoading,
    error: state.error,
    signIn,
    signOut,
    clearError,
  };
}
