"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  colyseusManager,
  getColyseusServerUrl,
  PlayerState,
  ChatMessageState,
} from "@/lib/colyseus-client";
import type { ZoneType } from "@/lib/types";

interface UseMultiplayerOptions {
  walletAddress: string | null;
  displayName?: string;
  skinVariant?: number;
  autoConnect?: boolean;
}

interface UseMultiplayerReturn {
  isConnected: boolean;
  isConnecting: boolean;
  localPlayer: PlayerState | null;
  players: PlayerState[];
  messages: ChatMessageState[];
  sessionId: string | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  joinZone: (zone: ZoneType) => Promise<void>;
  sendChat: (message: string) => void;
}

export function useMultiplayer(options: UseMultiplayerOptions): UseMultiplayerReturn {
  const { walletAddress, displayName, skinVariant = 0, autoConnect = false } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localPlayer, setLocalPlayer] = useState<PlayerState | null>(null);
  const [players, setPlayers] = useState<PlayerState[]>([]);
  const [messages, setMessages] = useState<ChatMessageState[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentZoneRef = useRef<ZoneType>("main_city");
  const hasConnectedRef = useRef(false);

  // Connect to server
  const connect = useCallback(async () => {
    if (!walletAddress || isConnecting || isConnected) return;

    setIsConnecting(true);
    setError(null);

    try {
      const serverUrl = getColyseusServerUrl();
      colyseusManager.connect(serverUrl);

      await colyseusManager.joinZone(currentZoneRef.current, {
        walletAddress,
        displayName,
        skinVariant,
      });

      setIsConnected(true);
      setSessionId(colyseusManager.getSessionId());
      hasConnectedRef.current = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect");
      setIsConnected(false);
    } finally {
      setIsConnecting(false);
    }
  }, [walletAddress, displayName, skinVariant, isConnecting, isConnected]);

  // Disconnect from server
  const disconnect = useCallback(async () => {
    await colyseusManager.disconnect();
    setIsConnected(false);
    setLocalPlayer(null);
    setPlayers([]);
    setSessionId(null);
    hasConnectedRef.current = false;
  }, []);

  // Join a different zone
  const joinZone = useCallback(
    async (zone: ZoneType) => {
      if (!walletAddress) return;

      currentZoneRef.current = zone;

      if (isConnected) {
        setIsConnecting(true);
        try {
          await colyseusManager.joinZone(zone, {
            walletAddress,
            displayName,
            skinVariant,
          });
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to join zone");
        } finally {
          setIsConnecting(false);
        }
      }
    },
    [walletAddress, displayName, skinVariant, isConnected]
  );

  // Send chat message
  const sendChat = useCallback((message: string) => {
    colyseusManager.sendChat(message);
  }, []);

  // Set up event listeners
  useEffect(() => {
    const handlePlayerJoin = ({
      player,
      sessionId: sid,
      isLocal,
    }: {
      player: PlayerState;
      sessionId: string;
      isLocal: boolean;
    }) => {
      if (isLocal) {
        setLocalPlayer(player);
      }
      setPlayers((prev) => {
        const filtered = prev.filter((p) => p.sessionId !== sid);
        return [...filtered, player];
      });
    };

    const handlePlayerLeave = ({ sessionId: sid }: { sessionId: string }) => {
      setPlayers((prev) => prev.filter((p) => p.sessionId !== sid));
    };

    const handlePlayerUpdate = ({
      player,
      sessionId: sid,
      isLocal,
    }: {
      player: PlayerState;
      sessionId: string;
      isLocal: boolean;
    }) => {
      if (isLocal) {
        setLocalPlayer(player);
      }
      setPlayers((prev) => {
        const index = prev.findIndex((p) => p.sessionId === sid);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = player;
          return updated;
        }
        return [...prev, player];
      });
    };

    const handleChatMessage = (message: ChatMessageState) => {
      setMessages((prev) => [...prev.slice(-49), message]); // Keep last 50
    };

    const handleConnected = () => {
      setIsConnected(true);
      setSessionId(colyseusManager.getSessionId());
    };

    const handleDisconnected = () => {
      setIsConnected(false);
      setLocalPlayer(null);
      setPlayers([]);
    };

    const handleError = ({ message }: { message: string }) => {
      setError(message);
    };

    colyseusManager.on("playerJoin", handlePlayerJoin);
    colyseusManager.on("playerLeave", handlePlayerLeave);
    colyseusManager.on("playerUpdate", handlePlayerUpdate);
    colyseusManager.on("chatMessage", handleChatMessage);
    colyseusManager.on("connected", handleConnected);
    colyseusManager.on("disconnected", handleDisconnected);
    colyseusManager.on("error", handleError);

    return () => {
      colyseusManager.off("playerJoin", handlePlayerJoin);
      colyseusManager.off("playerLeave", handlePlayerLeave);
      colyseusManager.off("playerUpdate", handlePlayerUpdate);
      colyseusManager.off("chatMessage", handleChatMessage);
      colyseusManager.off("connected", handleConnected);
      colyseusManager.off("disconnected", handleDisconnected);
      colyseusManager.off("error", handleError);
    };
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && walletAddress && !hasConnectedRef.current && !isConnecting) {
      connect();
    }
  }, [autoConnect, walletAddress, connect, isConnecting]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't disconnect on unmount - let the connection persist
      // across component re-renders
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    localPlayer,
    players,
    messages,
    sessionId,
    error,
    connect,
    disconnect,
    joinZone,
    sendChat,
  };
}
