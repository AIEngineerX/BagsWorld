// agentContext Provider
// Provides cross-agent awareness - lets agents know about each other

import type { Provider, IAgentRuntime, Memory, State, ProviderResult } from '../types/elizaos.js';
import { characters, getCharacterDisplayName } from '../characters/index.js';

interface AgentInfo {
  id: string;
  name: string;
  username: string;
  role: string;
  expertise: string[];
}

const agentRoles: Record<string, { role: string; expertise: string[] }> = {
  toly: {
    role: 'Solana Co-Founder',
    expertise: ['blockchain technology', 'Solana architecture', 'proof of history', 'consensus mechanisms'],
  },
  finn: {
    role: 'Bags.fm Founder & CEO',
    expertise: ['bags.fm platform', 'tokenomics', 'creator fees', 'product vision'],
  },
  ash: {
    role: 'Ecosystem Guide',
    expertise: ['onboarding', 'explaining concepts', 'community support', 'pokemon analogies'],
  },
  ghost: {
    role: 'The Dev / DaddyGhost',
    expertise: ['rewards system', 'on-chain verification', 'smart contracts', 'fee mechanics'],
  },
  neo: {
    role: 'Scout Agent',
    expertise: ['chain scanning', 'new launches', 'pattern detection', 'data analysis'],
  },
  cj: {
    role: 'Community OG',
    expertise: ['market survival', 'street wisdom', 'community vibes', 'keeping it real'],
  },
  shaw: {
    role: 'ElizaOS Creator',
    expertise: ['agent architecture', 'multi-agent systems', 'character design', 'AI frameworks'],
  },
  'bags-bot': {
    role: 'Main Guide',
    expertise: ['bags.fm basics', 'getting started', 'community culture', 'CT vibes'],
  },
  bagsbot: {
    role: 'Main Guide',
    expertise: ['bags.fm basics', 'getting started', 'community culture', 'CT vibes'],
  },
  dev: {
    role: 'The Dev / DaddyGhost',
    expertise: ['rewards system', 'on-chain verification', 'smart contracts', 'fee mechanics'],
  },
  ramo: {
    role: 'Co-Founder & CTO',
    expertise: ['smart contracts', 'fee-share system', 'Solana SDK', 'security audits'],
  },
  sincara: {
    role: 'Frontend Engineer',
    expertise: ['UI/UX design', 'frontend development', 'mobile app', 'animations'],
  },
  stuu: {
    role: 'Operations & Support',
    expertise: ['user support', 'troubleshooting', 'platform operations', 'documentation'],
  },
  sam: {
    role: 'Growth & Marketing',
    expertise: ['marketing strategy', 'growth metrics', 'social media', 'community growth'],
  },
  alaa: {
    role: 'Skunk Works / R&D',
    expertise: ['prototyping', 'experimental features', 'innovation', 'proof of concepts'],
  },
  carlo: {
    role: 'Community Ambassador',
    expertise: ['community building', 'onboarding newcomers', 'events', 'vibes curation'],
  },
  bnn: {
    role: 'Bags News Network',
    expertise: ['ecosystem news', 'launch coverage', 'announcements', 'market updates'],
  },
  'professor-oak': {
    role: 'Token Launch Wizard',
    expertise: ['token launching', 'DexScreener listings', 'launch guidance', 'creator mentoring'],
  },
  bagsy: {
    role: 'BagsWorld Mascot & Hype Bot',
    expertise: ['fee reminders', 'BagsWorld features', 'hype generation', 'community vibes'],
  },
};

export const agentContextProvider: Provider = {
  name: 'agentContext',
  description: 'Provides awareness of other BagsWorld agents and their capabilities',

  get: async (runtime: IAgentRuntime, message: Memory, state: State): Promise<ProviderResult> => {
    const currentAgentName = runtime.character?.name?.toLowerCase() || '';
    const messageText = message.content?.text?.toLowerCase() || '';

    const allAgents: AgentInfo[] = Object.entries(characters).map(([id, char]) => {
      const roleInfo = agentRoles[id] || { role: 'Agent', expertise: [] };
      return {
        id,
        name: char.name,
        username: char.username || id,
        role: roleInfo.role,
        expertise: roleInfo.expertise,
      };
    });

    const otherAgents = allAgents.filter(a => a.name.toLowerCase() !== currentAgentName);

    const mentionedAgents = otherAgents.filter(agent => {
      const nameLower = agent.name.toLowerCase();
      const usernameLower = agent.username.toLowerCase();
      return messageText.includes(nameLower) ||
        messageText.includes(usernameLower) ||
        messageText.includes(`@${usernameLower}`);
    });

    const agentSummary = otherAgents.map(a => {
      return `- ${a.name} (@${a.username}): ${a.role} - knows about ${a.expertise.slice(0, 2).join(', ')}`;
    }).join('\n');

    let contextText = `OTHER BAGSWORLD AGENTS:\n${agentSummary}`;

    if (mentionedAgents.length > 0) {
      const mentionedDetails = mentionedAgents.map(a => {
        return `${a.name} is the ${a.role}. Their expertise: ${a.expertise.join(', ')}.`;
      }).join('\n');
      contextText += `\n\nMENTIONED AGENTS:\n${mentionedDetails}`;
    }

    const shouldRefer = checkShouldReferToOther(messageText, currentAgentName, otherAgents);
    if (shouldRefer) {
      contextText += `\n\nREFERRAL SUGGESTION: Consider mentioning ${shouldRefer.name} (@${shouldRefer.username}) ` +
        `who specializes in ${shouldRefer.expertise[0]}`;
    }

    contextText += `\n\nNOTE: You can reference other agents naturally when relevant. ` +
      `Don't constantly redirect - only suggest other agents when their expertise is specifically needed.`;

    return {
      text: contextText,
      values: {
        otherAgentCount: otherAgents.length,
        mentionedAgentCount: mentionedAgents.length,
        hasReferralSuggestion: !!shouldRefer,
      },
      data: {
        currentAgent: currentAgentName,
        otherAgents,
        mentionedAgents,
        referralSuggestion: shouldRefer,
      },
    };
  },
};

function checkShouldReferToOther(
  messageText: string,
  currentAgentName: string,
  otherAgents: AgentInfo[]
): AgentInfo | null {
  const topicToAgent: Record<string, string> = {
    'solana': 'toly',
    'blockchain': 'toly',
    'proof of history': 'toly',
    'consensus': 'toly',
    'bags.fm': 'finn',
    'launch token': 'finn',
    'creator fee': 'finn',
    'tokenomics': 'finn',
    'how do i': 'ash',
    'what is': 'ash',
    'explain': 'ash',
    'help me understand': 'ash',
    'rewards': 'ghost',
    'verify': 'ghost',
    'on-chain': 'ghost',
    'contract': 'ghost',
    'new launch': 'neo',
    'scan': 'neo',
    'detect': 'neo',
    'pattern': 'neo',
    'elizaos': 'shaw',
    'agent': 'shaw',
    'character': 'shaw',
    'multi-agent': 'shaw',
    'smart contract': 'ramo',
    'sdk': 'ramo',
    'audit': 'ramo',
    'fee share': 'ramo',
    'frontend': 'sincara',
    'ui': 'sincara',
    'ux': 'sincara',
    'design': 'sincara',
    'mobile app': 'sincara',
    'support': 'stuu',
    'help': 'stuu',
    'bug': 'stuu',
    'issue': 'stuu',
    'troubleshoot': 'stuu',
    'marketing': 'sam',
    'growth': 'sam',
    'referral': 'sam',
    'promote': 'sam',
    'experiment': 'alaa',
    'prototype': 'alaa',
    'innovation': 'alaa',
    'skunk works': 'alaa',
    'community': 'carlo',
    'welcome': 'carlo',
    'onboard': 'carlo',
    'event': 'carlo',
    'news': 'bnn',
    'announcement': 'bnn',
    'update': 'bnn',
    'breaking': 'bnn',
    'launch guide': 'professor-oak',
    'dexscreener': 'professor-oak',
    'token name': 'professor-oak',
    'logo': 'professor-oak',
    'unclaimed': 'bagsy',
    'claim fees': 'bagsy',
    'bagsworld': 'bagsy',
  };

  for (const [topic, agentId] of Object.entries(topicToAgent)) {
    if (messageText.includes(topic)) {
      const matchedAgent = otherAgents.find(a => a.id === agentId);
      if (matchedAgent && matchedAgent.name.toLowerCase() !== currentAgentName) {
        return matchedAgent;
      }
    }
  }

  return null;
}

export default agentContextProvider;
