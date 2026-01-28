"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  elizaApi,
  type AlertFilters,
  type GhostConfig,
  type AgentStatus,
  type GhostTradingStatus,
  type GhostPosition,
  type ScheduledTask,
  type AutonomousAlert,
  type TwitterStatus,
  type Tweet,
  type SharedContext,
  type ServerHealth,
} from "@/lib/eliza-api";

// ============================================================================
// Query Keys
// ============================================================================

export const elizaKeys = {
  all: ["eliza"] as const,
  health: () => [...elizaKeys.all, "health"] as const,
  agents: () => [...elizaKeys.all, "agents"] as const,
  agentStatuses: () => [...elizaKeys.all, "agentStatuses"] as const,
  sharedContext: () => [...elizaKeys.all, "sharedContext"] as const,
  ghost: () => [...elizaKeys.all, "ghost"] as const,
  ghostStatus: () => [...elizaKeys.ghost(), "status"] as const,
  ghostPositions: () => [...elizaKeys.ghost(), "positions"] as const,
  ghostOpenPositions: () => [...elizaKeys.ghost(), "openPositions"] as const,
  tasks: () => [...elizaKeys.all, "tasks"] as const,
  alerts: (filters?: AlertFilters) =>
    [...elizaKeys.all, "alerts", filters] as const,
  twitter: () => [...elizaKeys.all, "twitter"] as const,
  twitterStatus: () => [...elizaKeys.twitter(), "status"] as const,
  twitterHistory: (limit?: number) =>
    [...elizaKeys.twitter(), "history", limit] as const,
};

// ============================================================================
// Health
// ============================================================================

export function useElizaHealth() {
  return useQuery({
    queryKey: elizaKeys.health(),
    queryFn: () => elizaApi.getHealth(),
    refetchInterval: 30000,
    staleTime: 25000,
    retry: 1,
  });
}

// ============================================================================
// Agent Coordination
// ============================================================================

export function useAgentStatuses() {
  return useQuery({
    queryKey: elizaKeys.agentStatuses(),
    queryFn: async () => {
      const result = await elizaApi.getAgentStatuses();
      return result;
    },
    refetchInterval: 10000,
    staleTime: 8000,
    retry: 1,
  });
}

export function useSharedContext() {
  return useQuery({
    queryKey: elizaKeys.sharedContext(),
    queryFn: async () => {
      const result = await elizaApi.getSharedContext();
      return result;
    },
    refetchInterval: 30000,
    staleTime: 25000,
    retry: 1,
  });
}

export function useBroadcastMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      from,
      content,
      type,
      data,
    }: {
      from: string;
      content: string;
      type?: string;
      data?: Record<string, unknown>;
    }) => elizaApi.broadcastMessage(from, content, type, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: elizaKeys.sharedContext() });
    },
  });
}

// ============================================================================
// Ghost Trading
// ============================================================================

export function useGhostStatus() {
  return useQuery({
    queryKey: elizaKeys.ghostStatus(),
    queryFn: async () => {
      const result = await elizaApi.getGhostStatus();
      return result;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      return data?.trading?.enabled ? 5000 : 30000;
    },
    staleTime: 4000,
    retry: 1,
  });
}

export function useGhostPositions() {
  return useQuery({
    queryKey: elizaKeys.ghostPositions(),
    queryFn: async () => {
      const result = await elizaApi.getGhostPositions();
      return result;
    },
    refetchInterval: 15000,
    staleTime: 10000,
    retry: 1,
  });
}

export function useGhostOpenPositions() {
  const ghostStatus = useGhostStatus();

  return useQuery({
    queryKey: elizaKeys.ghostOpenPositions(),
    queryFn: async () => {
      const result = await elizaApi.getGhostOpenPositions();
      return result;
    },
    refetchInterval: ghostStatus.data?.trading?.enabled ? 10000 : 60000,
    staleTime: 8000,
    retry: 1,
    enabled: ghostStatus.isSuccess,
  });
}

export function useEnableGhostTrading() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (confirmPhrase: string) =>
      elizaApi.enableGhostTrading(confirmPhrase),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: elizaKeys.ghostStatus() });
      const previous = queryClient.getQueryData(elizaKeys.ghostStatus());
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(elizaKeys.ghostStatus(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: elizaKeys.ghost() });
      queryClient.invalidateQueries({ queryKey: elizaKeys.sharedContext() });
    },
  });
}

export function useDisableGhostTrading() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => elizaApi.disableGhostTrading(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: elizaKeys.ghostStatus() });
      const previous = queryClient.getQueryData(elizaKeys.ghostStatus());
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(elizaKeys.ghostStatus(), context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: elizaKeys.ghost() });
      queryClient.invalidateQueries({ queryKey: elizaKeys.sharedContext() });
    },
  });
}

export function useUpdateGhostConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Partial<GhostConfig>) =>
      elizaApi.updateGhostConfig(updates),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: elizaKeys.ghostStatus() });
    },
  });
}

export function useTriggerGhostEvaluate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => elizaApi.triggerGhostEvaluate(),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: elizaKeys.ghost() });
    },
  });
}

export function useTriggerGhostCheckPositions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => elizaApi.triggerGhostCheckPositions(),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: elizaKeys.ghost() });
    },
  });
}

// ============================================================================
// Autonomous Tasks
// ============================================================================

export function useAutonomousTasks() {
  return useQuery({
    queryKey: elizaKeys.tasks(),
    queryFn: async () => {
      const result = await elizaApi.getTaskStatus();
      return result;
    },
    refetchInterval: 30000,
    staleTime: 25000,
    retry: 1,
  });
}

export function useAlerts(filters?: AlertFilters) {
  return useQuery({
    queryKey: elizaKeys.alerts(filters),
    queryFn: async () => {
      const result = await elizaApi.getAlerts(filters);
      return result;
    },
    refetchInterval: 15000,
    staleTime: 10000,
    retry: 1,
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId: string) => elizaApi.acknowledgeAlert(alertId),
    onMutate: async (alertId) => {
      await queryClient.cancelQueries({ queryKey: elizaKeys.all });

      const previousAlerts = queryClient.getQueriesData({
        queryKey: [...elizaKeys.all, "alerts"],
      });

      queryClient.setQueriesData(
        { queryKey: [...elizaKeys.all, "alerts"] },
        (old: { success: boolean; alerts: AutonomousAlert[]; count: number } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            alerts: old.alerts.map((alert) =>
              alert.id === alertId ? { ...alert, acknowledged: true } : alert
            ),
          };
        }
      );

      return { previousAlerts };
    },
    onError: (_err, _alertId, context) => {
      if (context?.previousAlerts) {
        context.previousAlerts.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: [...elizaKeys.all, "alerts"],
      });
    },
  });
}

export function useTriggerTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskName: string) => elizaApi.triggerTask(taskName),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: elizaKeys.tasks() });
      queryClient.invalidateQueries({ queryKey: elizaKeys.sharedContext() });
    },
  });
}

// ============================================================================
// Twitter
// ============================================================================

export function useTwitterStatus() {
  return useQuery({
    queryKey: elizaKeys.twitterStatus(),
    queryFn: async () => {
      const result = await elizaApi.getTwitterStatus();
      return result;
    },
    refetchInterval: 60000,
    staleTime: 55000,
    retry: 1,
  });
}

export function useTwitterHistory(limit = 10) {
  return useQuery({
    queryKey: elizaKeys.twitterHistory(limit),
    queryFn: async () => {
      const result = await elizaApi.getTwitterHistory(limit);
      return result;
    },
    refetchInterval: 60000,
    staleTime: 55000,
    retry: 1,
  });
}

export function usePostTweet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => elizaApi.postTweet(content),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: elizaKeys.twitter() });
    },
  });
}

export function usePostThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => elizaApi.postThread(content),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: elizaKeys.twitter() });
    },
  });
}

export function useGenerateShillContent() {
  return useMutation({
    mutationFn: (params: { mint?: string; symbol?: string }) =>
      elizaApi.generateShillContent(params),
  });
}

// ============================================================================
// Agents List
// ============================================================================

export function useAgents() {
  return useQuery({
    queryKey: elizaKeys.agents(),
    queryFn: async () => {
      const result = await elizaApi.getAgents();
      return result;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - agents don't change often
    retry: 1,
  });
}

// ============================================================================
// Re-export types for convenience
// ============================================================================

export type {
  AgentStatus,
  GhostTradingStatus,
  GhostConfig,
  GhostPosition,
  ScheduledTask,
  AutonomousAlert,
  AlertFilters,
  TwitterStatus,
  Tweet,
  SharedContext,
  ServerHealth,
};
