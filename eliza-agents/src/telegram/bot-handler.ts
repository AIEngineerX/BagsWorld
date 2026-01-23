// Telegram Bot Handler for BagsWorld Agents
// Provides external access to agents via Telegram

import { getAgentBus } from '../coordination/agent-bus';
import { getSharedContext } from '../coordination/shared-context';
import { getDialogueManager } from '../coordination/dialogue-manager';
import { getCharacter, getCharacterIds, allCharacters } from '../characters';
import { createLogger } from '../utils/logger';
import type { Character } from '../types/elizaos';

// Configuration type for bot initialization
export interface TelegramConfig {
  botToken?: string;
  allowedChats?: number[];
}

const log = createLogger('TelegramBot');

// Telegram API types
interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  date: number;
  text?: string;
  entities?: TelegramMessageEntity[];
}

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
}

interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
}

interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

// User session tracking
interface UserSession {
  userId: number;
  chatId: number;
  currentAgent: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  lastActive: number;
}

export class TelegramBotHandler {
  private botToken: string;
  private apiBase: string;
  private sessions: Map<string, UserSession> = new Map();
  private allowedChats: Set<number> = new Set();
  private bus = getAgentBus();
  private context = getSharedContext();
  private dialogue = getDialogueManager();

  // Session timeout (30 minutes)
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000;
  private readonly MAX_HISTORY = 20;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is required');
    }
    this.botToken = token;
    this.apiBase = `https://api.telegram.org/bot${token}`;

    // Parse allowed chats if specified
    const allowedChatsEnv = process.env.TELEGRAM_ALLOWED_CHATS;
    if (allowedChatsEnv) {
      allowedChatsEnv.split(',').forEach(id => {
        const chatId = parseInt(id.trim(), 10);
        if (!isNaN(chatId)) {
          this.allowedChats.add(chatId);
        }
      });
      log.info(`Restricted to ${this.allowedChats.size} allowed chats`);
    }
  }

  // ==================== Telegram API Methods ====================

  private async callApi(method: string, body?: Record<string, unknown>): Promise<unknown> {
    const response = await fetch(`${this.apiBase}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();
    if (!data.ok) {
      log.error(`Telegram API error: ${data.description}`);
      throw new Error(data.description);
    }

    return data.result;
  }

  async sendMessage(chatId: number, text: string, options?: {
    replyToMessageId?: number;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    replyMarkup?: unknown;
  }): Promise<TelegramMessage> {
    return await this.callApi('sendMessage', {
      chat_id: chatId,
      text,
      reply_to_message_id: options?.replyToMessageId,
      parse_mode: options?.parseMode,
      reply_markup: options?.replyMarkup,
    }) as TelegramMessage;
  }

  async sendTypingAction(chatId: number): Promise<void> {
    await this.callApi('sendChatAction', {
      chat_id: chatId,
      action: 'typing',
    });
  }

  async answerCallbackQuery(queryId: string, text?: string): Promise<void> {
    await this.callApi('answerCallbackQuery', {
      callback_query_id: queryId,
      text,
    });
  }

  // ==================== Session Management ====================

  private getSessionKey(userId: number, chatId: number): string {
    return `${userId}:${chatId}`;
  }

  private getSession(userId: number, chatId: number): UserSession {
    const key = this.getSessionKey(userId, chatId);
    let session = this.sessions.get(key);

    if (!session) {
      session = {
        userId,
        chatId,
        currentAgent: 'bags-bot', // Default agent
        conversationHistory: [],
        lastActive: Date.now(),
      };
      this.sessions.set(key, session);
    }

    // Check for timeout
    if (Date.now() - session.lastActive > this.SESSION_TIMEOUT) {
      session.conversationHistory = [];
      session.currentAgent = 'bags-bot';
    }

    session.lastActive = Date.now();
    return session;
  }

  private clearSession(userId: number, chatId: number): void {
    const key = this.getSessionKey(userId, chatId);
    this.sessions.delete(key);
  }

  // ==================== Update Handling ====================

  async handleUpdate(update: TelegramUpdate): Promise<void> {
    if (update.message) {
      await this.handleMessage(update.message);
    } else if (update.callback_query) {
      await this.handleCallbackQuery(update.callback_query);
    }
  }

  private async handleMessage(message: TelegramMessage): Promise<void> {
    const { chat, from, text } = message;

    if (!from || !text) return;

    // Check if chat is allowed (if restriction is enabled)
    if (this.allowedChats.size > 0 && !this.allowedChats.has(chat.id)) {
      log.debug(`Ignoring message from unauthorized chat: ${chat.id}`);
      return;
    }

    log.info(`Message from ${from.username || from.first_name} in ${chat.type}: ${text.slice(0, 50)}...`);

    const session = this.getSession(from.id, chat.id);

    // Handle commands
    if (text.startsWith('/')) {
      await this.handleCommand(message, session);
      return;
    }

    // Handle regular message
    await this.handleRegularMessage(message, session);
  }

  private async handleCommand(message: TelegramMessage, session: UserSession): Promise<void> {
    const text = message.text!;
    const parts = text.split(/\s+/);
    const command = parts[0].toLowerCase().replace(/^\//, '').replace(/@.*$/, '');
    const args = parts.slice(1).join(' ');

    switch (command) {
      case 'start':
        await this.handleStartCommand(message, session);
        break;

      case 'help':
        await this.handleHelpCommand(message);
        break;

      case 'agents':
        await this.handleAgentsCommand(message);
        break;

      case 'switch':
        await this.handleSwitchCommand(message, session, args);
        break;

      case 'world':
        await this.handleWorldCommand(message);
        break;

      case 'dialogue':
        await this.handleDialogueCommand(message, args);
        break;

      case 'clear':
        await this.handleClearCommand(message, session);
        break;

      // Character shortcuts
      case 'neo':
      case 'cj':
      case 'finn':
      case 'ash':
      case 'toly':
      case 'shaw':
      case 'ghost':
      case 'bot':
        await this.handleAgentShortcut(message, session, command === 'bot' ? 'bags-bot' : command, args);
        break;

      default:
        await this.sendMessage(message.chat.id,
          `Unknown command. Use /help to see available commands.`,
          { replyToMessageId: message.message_id }
        );
    }
  }

  // ==================== Command Handlers ====================

  private async handleStartCommand(message: TelegramMessage, session: UserSession): Promise<void> {
    const welcomeText = `🌐 *Welcome to BagsWorld!*

I'm connected to the BagsWorld AI agents. You can chat with:

🤖 *Bags Bot* - Your friendly guide (default)
👁️ *Neo* - The chain scanner
🎮 *CJ* - Hood wisdom
🚀 *Finn* - Platform founder
🎓 *Ash* - Ecosystem educator
⚡ *Toly* - Solana expert
🏗️ *Shaw* - Agent architect
👻 *Ghost* - Rewards wizard

*Quick Commands:*
/neo - Talk to Neo
/finn - Talk to Finn
/agents - Show all agents
/switch [name] - Switch agent
/world - Check world status
/dialogue [topic] - Multi-agent chat
/clear - Reset conversation

Just send a message to chat with ${session.currentAgent}!`;

    await this.sendMessage(message.chat.id, welcomeText, {
      parseMode: 'Markdown',
      replyMarkup: {
        inline_keyboard: [
          [
            { text: '🤖 Bags Bot', callback_data: 'switch:bags-bot' },
            { text: '👁️ Neo', callback_data: 'switch:neo' },
          ],
          [
            { text: '🎮 CJ', callback_data: 'switch:cj' },
            { text: '🚀 Finn', callback_data: 'switch:finn' },
          ],
          [
            { text: '🌍 World Status', callback_data: 'world' },
          ],
        ],
      },
    });
  }

  private async handleHelpCommand(message: TelegramMessage): Promise<void> {
    const helpText = `📚 *BagsWorld Bot Help*

*Chat Commands:*
/start - Welcome message
/help - This help message
/agents - List all agents
/switch [agent] - Switch to agent
/clear - Clear conversation

*Agent Shortcuts:*
/neo [msg] - Ask Neo
/cj [msg] - Ask CJ
/finn [msg] - Ask Finn
/ash [msg] - Ask Ash
/toly [msg] - Ask Toly
/shaw [msg] - Ask Shaw
/ghost [msg] - Ask Ghost
/bot [msg] - Ask Bags Bot

*World Commands:*
/world - Current world status
/dialogue [topic] - Start multi-agent dialogue

*Tips:*
• Just type to chat with current agent
• Mention agents by name for handoffs
• Use @ to switch agents mid-chat`;

    await this.sendMessage(message.chat.id, helpText, { parseMode: 'Markdown' });
  }

  private async handleAgentsCommand(message: TelegramMessage): Promise<void> {
    const agents = allCharacters;
    let text = '🤖 *Available Agents:*\n\n';

    const agentEmojis: Record<string, string> = {
      'Bags Bot': '🤖',
      'Neo': '👁️',
      'CJ': '🎮',
      'Finn': '🚀',
      'Ash': '🎓',
      'Toly': '⚡',
      'Shaw': '🏗️',
      'Ghost': '👻',
    };

    for (const agent of agents) {
      const emoji = agentEmojis[agent.name] || '🤖';
      const bio = Array.isArray(agent.bio) ? agent.bio[0] : agent.bio;
      text += `${emoji} *${agent.name}*\n${bio?.slice(0, 100)}...\n\n`;
    }

    await this.sendMessage(message.chat.id, text, {
      parseMode: 'Markdown',
      replyMarkup: {
        inline_keyboard: [
          [
            { text: '🤖 Bags Bot', callback_data: 'switch:bags-bot' },
            { text: '👁️ Neo', callback_data: 'switch:neo' },
            { text: '🎮 CJ', callback_data: 'switch:cj' },
          ],
          [
            { text: '🚀 Finn', callback_data: 'switch:finn' },
            { text: '🎓 Ash', callback_data: 'switch:ash' },
            { text: '⚡ Toly', callback_data: 'switch:toly' },
          ],
          [
            { text: '🏗️ Shaw', callback_data: 'switch:shaw' },
            { text: '👻 Ghost', callback_data: 'switch:ghost' },
          ],
        ],
      },
    });
  }

  private async handleSwitchCommand(message: TelegramMessage, session: UserSession, agentName: string): Promise<void> {
    if (!agentName) {
      await this.handleAgentsCommand(message);
      return;
    }

    const normalizedName = agentName.toLowerCase().replace(/[\s-]/g, '-');
    const character = getCharacter(normalizedName);

    if (!character) {
      await this.sendMessage(message.chat.id,
        `Agent "${agentName}" not found. Use /agents to see available agents.`
      );
      return;
    }

    session.currentAgent = normalizedName;
    session.conversationHistory = []; // Clear history on switch

    await this.sendMessage(message.chat.id,
      `✅ Switched to *${character.name}*. Send a message to start chatting!`,
      { parseMode: 'Markdown' }
    );
  }

  private async handleWorldCommand(message: TelegramMessage): Promise<void> {
    const worldState = this.context.getWorldState();

    if (!worldState) {
      await this.sendMessage(message.chat.id,
        '⚠️ World state unavailable. Try again later.'
      );
      return;
    }

    const healthEmoji = worldState.health >= 80 ? '🌟' :
                        worldState.health >= 60 ? '☀️' :
                        worldState.health >= 40 ? '🌤️' :
                        worldState.health >= 20 ? '⛈️' : '🌋';

    const weatherEmoji: Record<string, string> = {
      'sunny': '☀️',
      'cloudy': '☁️',
      'rain': '🌧️',
      'storm': '⛈️',
      'apocalypse': '🌋',
    };

    let text = `🌐 *BagsWorld Status* ${healthEmoji}\n\n`;
    text += `Health: ${worldState.health}%\n`;
    text += `Weather: ${weatherEmoji[worldState.weather] || ''} ${worldState.weather}\n`;
    text += `Buildings: ${worldState.buildingCount}\n`;
    text += `Citizens: ${worldState.populationCount}\n\n`;
    text += `💰 24h Volume: $${this.formatNumber(worldState.totalVolume24h)}\n`;
    text += `💸 24h Fees: $${this.formatNumber(worldState.totalFees24h)}\n`;

    if (worldState.topTokens.length > 0) {
      text += '\n*Top Tokens:*\n';
      worldState.topTokens.slice(0, 3).forEach((token, i) => {
        const trend = token.priceChange24h >= 0 ? '📈' : '📉';
        text += `${i + 1}. ${token.symbol} ${trend} ${token.priceChange24h >= 0 ? '+' : ''}${token.priceChange24h.toFixed(1)}%\n`;
      });
    }

    await this.sendMessage(message.chat.id, text, { parseMode: 'Markdown' });
  }

  private async handleDialogueCommand(message: TelegramMessage, topic: string): Promise<void> {
    if (!topic) {
      await this.sendMessage(message.chat.id,
        'Usage: /dialogue [topic]\n\nExample: /dialogue "best time to launch a token"'
      );
      return;
    }

    await this.sendTypingAction(message.chat.id);

    const result = await this.dialogue.generateDialogue({
      topic,
      participants: ['neo', 'finn', 'ash'],
      initiator: 'neo',
      maxTurns: 4,
      style: 'casual',
    });

    if (result.turns.length === 0) {
      await this.sendMessage(message.chat.id, '⚠️ Failed to generate dialogue. Try again.');
      return;
    }

    const agentEmojis: Record<string, string> = {
      'neo': '👁️',
      'cj': '🎮',
      'finn': '🚀',
      'ash': '🎓',
      'toly': '⚡',
      'shaw': '🏗️',
      'ghost': '👻',
      'bags-bot': '🤖',
    };

    let text = `💬 *Multi-Agent Dialogue*\n_Topic: ${topic}_\n\n`;

    for (const turn of result.turns) {
      const emoji = agentEmojis[turn.speaker.toLowerCase()] || '🤖';
      text += `${emoji} *${turn.speaker}*: ${turn.message}\n\n`;
    }

    await this.sendMessage(message.chat.id, text, { parseMode: 'Markdown' });
  }

  private async handleClearCommand(message: TelegramMessage, session: UserSession): Promise<void> {
    session.conversationHistory = [];
    await this.sendMessage(message.chat.id,
      '🧹 Conversation cleared. Start fresh!'
    );
  }

  private async handleAgentShortcut(
    message: TelegramMessage,
    session: UserSession,
    agentId: string,
    messageText: string
  ): Promise<void> {
    // Switch to agent
    session.currentAgent = agentId;

    // If there's a message, process it
    if (messageText.trim()) {
      await this.processAgentMessage(message, session, messageText);
    } else {
      const character = getCharacter(agentId);
      await this.sendMessage(message.chat.id,
        `Now chatting with *${character?.name || agentId}*. Send a message!`,
        { parseMode: 'Markdown' }
      );
    }
  }

  // ==================== Message Processing ====================

  private async handleRegularMessage(message: TelegramMessage, session: UserSession): Promise<void> {
    const text = message.text!;

    // Check for agent mention
    const mention = this.bus.detectMention(text);
    if (mention && mention.agentId !== session.currentAgent) {
      // User mentioned a different agent, suggest switching
      const character = getCharacter(mention.agentId);
      if (character) {
        await this.sendMessage(message.chat.id,
          `💡 You mentioned ${character.name}. Would you like to switch?`,
          {
            replyMarkup: {
              inline_keyboard: [[
                { text: `Yes, switch to ${character.name}`, callback_data: `switch:${mention.agentId}` },
                { text: 'No, keep current', callback_data: 'dismiss' },
              ]],
            },
          }
        );
      }
    }

    await this.processAgentMessage(message, session, text);
  }

  private async processAgentMessage(
    message: TelegramMessage,
    session: UserSession,
    text: string
  ): Promise<void> {
    await this.sendTypingAction(message.chat.id);

    // Add user message to history
    session.conversationHistory.push({ role: 'user', content: text });

    // Trim history if too long
    if (session.conversationHistory.length > this.MAX_HISTORY) {
      session.conversationHistory = session.conversationHistory.slice(-this.MAX_HISTORY);
    }

    // Generate response
    const { response, shouldHandoff } = await this.dialogue.generateResponse(
      session.currentAgent,
      text,
      session.conversationHistory
    );

    // Add response to history
    session.conversationHistory.push({ role: 'assistant', content: response });

    // Send response
    const character = getCharacter(session.currentAgent);
    const agentEmojis: Record<string, string> = {
      'neo': '👁️', 'cj': '🎮', 'finn': '🚀', 'ash': '🎓',
      'toly': '⚡', 'shaw': '🏗️', 'ghost': '👻', 'bags-bot': '🤖',
    };
    const emoji = agentEmojis[session.currentAgent] || '🤖';

    await this.sendMessage(message.chat.id,
      `${emoji} *${character?.name || 'Agent'}*:\n${response}`,
      {
        parseMode: 'Markdown',
        replyToMessageId: message.message_id,
      }
    );

    // Suggest handoff if detected
    if (shouldHandoff && shouldHandoff !== session.currentAgent) {
      const handoffChar = getCharacter(shouldHandoff);
      if (handoffChar) {
        await this.sendMessage(message.chat.id,
          `💡 ${character?.name} suggested talking to ${handoffChar.name}. Switch?`,
          {
            replyMarkup: {
              inline_keyboard: [[
                { text: `Switch to ${handoffChar.name}`, callback_data: `switch:${shouldHandoff}` },
                { text: 'Stay', callback_data: 'dismiss' },
              ]],
            },
          }
        );
      }
    }
  }

  // ==================== Callback Query Handling ====================

  private async handleCallbackQuery(query: TelegramCallbackQuery): Promise<void> {
    const { from, message, data } = query;

    if (!data || !message) {
      await this.answerCallbackQuery(query.id);
      return;
    }

    const session = this.getSession(from.id, message.chat.id);

    if (data === 'dismiss') {
      await this.answerCallbackQuery(query.id);
      return;
    }

    if (data === 'world') {
      await this.answerCallbackQuery(query.id, 'Loading world status...');
      await this.handleWorldCommand(message);
      return;
    }

    if (data.startsWith('switch:')) {
      const agentId = data.replace('switch:', '');
      session.currentAgent = agentId;
      session.conversationHistory = [];

      const character = getCharacter(agentId);
      await this.answerCallbackQuery(query.id, `Switched to ${character?.name || agentId}`);

      await this.sendMessage(message.chat.id,
        `✅ Now chatting with *${character?.name}*. Send a message!`,
        { parseMode: 'Markdown' }
      );
      return;
    }

    await this.answerCallbackQuery(query.id);
  }

  // ==================== Webhook Setup ====================

  async setWebhook(url: string): Promise<void> {
    await this.callApi('setWebhook', {
      url,
      allowed_updates: ['message', 'callback_query'],
    });
    log.info(`Webhook set to: ${url}`);
  }

  async deleteWebhook(): Promise<void> {
    await this.callApi('deleteWebhook');
    log.info('Webhook deleted');
  }

  async getWebhookInfo(): Promise<unknown> {
    return await this.callApi('getWebhookInfo');
  }

  // ==================== Utilities ====================

  private formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toFixed(2);
  }
}

// Factory function
export function createTelegramBot(): TelegramBotHandler {
  return new TelegramBotHandler();
}

// Singleton instance
let botInstance: TelegramBotHandler | null = null;

// Get or create singleton bot instance
export function getTelegramBot(config?: Partial<TelegramConfig>): TelegramBotHandler {
  if (!botInstance) {
    // Apply config to environment if provided
    if (config?.botToken) {
      process.env.TELEGRAM_BOT_TOKEN = config.botToken;
    }
    if (config?.allowedChats) {
      process.env.TELEGRAM_ALLOWED_CHATS = config.allowedChats.join(',');
    }
    botInstance = new TelegramBotHandler();
  }
  return botInstance;
}

export default TelegramBotHandler;
