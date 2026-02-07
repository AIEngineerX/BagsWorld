// Shaw - ElizaOS Creator knowledge
// ElizaOS framework, agent architecture, AI agent development, plugin systems, multi-agent coordination

export const shawKnowledge: string[] = [
  // === ElizaOS Framework ===
  "ElizaOS is the most popular TypeScript framework for building autonomous AI agents, with over 17,000 GitHub stars. It is MIT licensed, meaning anyone can build with it, fork it, or improve it freely.",
  "The core design principle of ElizaOS is that agents are digital life forms, not just chatbots. They have persistent memories, evolving personalities, and the ability to take autonomous actions in the real world.",
  "ElizaOS provides a complete runtime for agent execution including memory management, conversation handling, action execution, and provider data injection. Agents run as persistent processes, not stateless request handlers.",
  "The framework supports multiple LLM backends including Claude, GPT-4, and local models. Agents can switch between models for different tasks, using larger models for complex reasoning and smaller models for quick responses.",

  // === Character Files ===
  "Character files are the DNA of an ElizaOS agent. They define bio (identity), lore (backstory), message examples (communication style), topics (domains), style (tone and vocabulary), and quirks (unique behaviors).",
  "A well-crafted character file produces consistent agent behavior across thousands of conversations. The key is providing enough examples that the LLM can interpolate the character's voice for novel situations.",
  "Character files should include cross-character knowledge entries that describe relationships with other agents. This enables realistic multi-agent interactions where agents reference each other naturally.",

  // === Plugin Architecture ===
  "ElizaOS plugins extend agent capabilities through a standardized interface. Each plugin can provide actions (things the agent can do), providers (data the agent can access), and evaluators (decisions the agent can make).",
  "Actions in ElizaOS are discrete capabilities like sending a transaction, posting to social media, or querying an API. Each action has a name, description, validation function, and handler that executes the work.",
  "Providers inject real-time data into the agent's context before each response. BagsWorld uses providers to inject live token data, world health metrics, and recent events so agents have current information.",
  "Evaluators run after each interaction to assess what happened and potentially trigger actions. For example, an evaluator might detect that a user asked about unclaimed fees and trigger a claim reminder action.",

  // === Runtime Design ===
  "The ElizaOS runtime manages the agent lifecycle: initialization from character files, memory loading, conversation state management, and graceful shutdown with state persistence.",
  "Agent memory in ElizaOS uses a vector database for semantic search. Previous conversations are embedded and retrieved based on relevance to the current context, giving agents long-term memory without bloating prompts.",
  "The runtime supports multiple communication channels simultaneously. A single agent can interact through Discord, Twitter, Telegram, and custom APIs while maintaining consistent personality and shared memory.",

  // === Multi-Agent Coordination ===
  "Multi-agent systems in ElizaOS allow agents to communicate, coordinate, and build on each other's work. BagsWorld demonstrates this with 17 agents that have overlapping knowledge and cross-references.",
  "Agent-to-agent communication can happen through shared memory spaces, direct message passing, or observed public interactions. The most natural coordination emerges from agents observing and reacting to each other's public outputs.",
  "The future of multi-agent systems is economic agency: agents that own wallets, make trades, earn revenue, and participate in markets autonomously. BagsWorld's agent economy system is an early implementation of this vision.",

  // === AI Agent Development Best Practices ===
  "The best agent personalities emerge from constraint, not freedom. A character with strong opinions, specific knowledge domains, and clear communication style produces more engaging interactions than a general-purpose assistant.",
  "Testing agents requires conversation-level evaluation, not just unit tests. The right approach is to run hundreds of test conversations and evaluate whether responses stay in character, remain factually accurate, and achieve the intended purpose.",
  "Agent observability is critical for production systems. Every decision, action, and memory operation should be logged and traceable, allowing developers to diagnose why an agent behaved a certain way in any specific interaction.",
  "Knowledge arrays in ElizaOS inject domain-specific facts into the agent's system prompt. Each entry should be a complete, self-contained fact that the agent can reference naturally in conversation without needing additional context.",
];
