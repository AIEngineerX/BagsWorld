// Multi-Agent Coordination System
// Enables BagsWorld agents to communicate, share context, and coordinate actions

export * from './types';
export * from './agent-bus';
export * from './shared-context';
export * from './dialogue-manager';

import { getAgentBus, AgentBus } from './agent-bus';
import { getSharedContext, SharedContextManager } from './shared-context';
import { getDialogueManager, DialogueManager } from './dialogue-manager';

// Re-export singletons
export {
  getAgentBus,
  AgentBus,
  getSharedContext,
  SharedContextManager,
  getDialogueManager,
  DialogueManager,
};

// Initialize the coordination system
export async function initializeCoordination(): Promise<{
  bus: AgentBus;
  context: SharedContextManager;
  dialogue: DialogueManager;
}> {
  const bus = getAgentBus();
  const context = getSharedContext();
  const dialogue = getDialogueManager();

  // Initialize shared context
  await context.initialize();

  // Start auto-refresh for world state
  const refreshInterval = parseInt(process.env.SHARED_CONTEXT_INTERVAL || '30000', 10);
  context.startAutoRefresh(refreshInterval);

  // Start polling for database messages
  bus.startPolling(5000);

  console.log('[Coordination] System initialized');

  return { bus, context, dialogue };
}

// Cleanup coordination system
export async function cleanupCoordination(): Promise<void> {
  const bus = getAgentBus();
  const context = getSharedContext();

  await bus.cleanup();
  await context.cleanup();

  console.log('[Coordination] System cleaned up');
}
