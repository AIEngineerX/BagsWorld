// Knowledge aggregator for BagsWorld ElizaOS agents
// Merges shared knowledge with agent-specific knowledge for injection into agent system prompts

import { sharedKnowledge } from './shared.js';
import { tolyKnowledge } from './toly.js';
import { finnKnowledge } from './finn.js';
import { ashKnowledge } from './ash.js';
import { ghostKnowledge } from './ghost.js';
import { neoKnowledge } from './neo.js';
import { cjKnowledge } from './cj.js';
import { shawKnowledge } from './shaw.js';
import { bagsBotKnowledge } from './bags-bot.js';
import { ramoKnowledge } from './ramo.js';
import { sincaraKnowledge } from './sincara.js';
import { stuuKnowledge } from './stuu.js';
import { samKnowledge } from './sam.js';
import { alaaKnowledge } from './alaa.js';
import { carloKnowledge } from './carlo.js';
import { bnnKnowledge } from './bnn.js';
import { professorOakKnowledge } from './professor-oak.js';
import { bagsyKnowledge } from './bagsy.js';

/** Agent-specific knowledge arrays keyed by normalized agent ID */
const agentKnowledge: Record<string, string[]> = {
  'toly': tolyKnowledge,
  'finn': finnKnowledge,
  'ash': ashKnowledge,
  'ghost': ghostKnowledge,
  'neo': neoKnowledge,
  'cj': cjKnowledge,
  'shaw': shawKnowledge,
  'bags-bot': bagsBotKnowledge,
  'ramo': ramoKnowledge,
  'sincara': sincaraKnowledge,
  'stuu': stuuKnowledge,
  'sam': samKnowledge,
  'alaa': alaaKnowledge,
  'carlo': carloKnowledge,
  'bnn': bnnKnowledge,
  'professor-oak': professorOakKnowledge,
  'bagsy': bagsyKnowledge,
};

/** Aliases that map alternate IDs to canonical agent IDs */
const aliases: Record<string, string> = {
  'bagsbot': 'bags-bot',
  'professoroak': 'professor-oak',
  'oak': 'professor-oak',
  'dev': 'ghost',
};

/** Returns shared + agent-specific knowledge merged for the given agent ID. */
export function getKnowledgeForAgent(agentId: string): string[] {
  const normalizedId = agentId.toLowerCase().replace(/[\s_]/g, '-');
  const resolvedId = aliases[normalizedId] || normalizedId;
  const specific = agentKnowledge[resolvedId] || [];
  return [...sharedKnowledge, ...specific];
}
