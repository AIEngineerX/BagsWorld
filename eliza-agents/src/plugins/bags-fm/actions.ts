// Actions for Bags.fm - Define what agents can DO
import type { Action, ActionResult, IAgentRuntime, Memory, State, HandlerCallback } from '../../types/elizaos';
import { BagsFmService } from './bags-service';

/**
 * Scan Tokens Action - Agent scans for new or trending tokens
 */
export const scanTokensAction: Action = {
  name: 'SCAN_TOKENS',
  description: 'Scan BagsWorld for trending tokens, new launches, or specific token data',
  similes: ['check tokens', 'scan chain', 'find tokens', 'token scan', 'what\'s trending'],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';
    return (
      text.includes('scan') ||
      text.includes('token') ||
      text.includes('trending') ||
      text.includes('launch') ||
      text.includes('what\'s hot') ||
      text.includes('alpha')
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: HandlerCallback
  ): Promise<ActionResult> => {
    const service = runtime.getService<BagsFmService>('bags-fm');

    if (!service) {
      await callback({
        text: 'Unable to connect to BagsWorld data feed.',
        action: 'SCAN_TOKENS',
      });
      return { success: false, error: new Error('Service unavailable') };
    }

    try {
      const topTokens = await service.getTopTokens(5);
      const worldState = await service.getWorldState();

      let responseText = `*scanning the chain...*\n\n`;
      responseText += `World Health: ${worldState.health}% | Weather: ${worldState.weather}\n\n`;

      if (topTokens.length > 0) {
        responseText += `**Top Tokens Right Now:**\n`;
        topTokens.forEach((token, i) => {
          const trend = token.priceChange24h >= 0 ? '📈' : '📉';
          responseText += `${i + 1}. $${token.symbol} ${trend} ${token.priceChange24h >= 0 ? '+' : ''}${token.priceChange24h.toFixed(1)}% | ${token.holders} holders\n`;
        });
      } else {
        responseText += `No tokens tracked yet. The chain is quiet.`;
      }

      await callback({
        text: responseText,
        action: 'SCAN_TOKENS',
      });

      return {
        success: true,
        text: 'Token scan complete',
        values: {
          tokenCount: topTokens.length,
          worldHealth: worldState.health,
        },
        data: { topTokens, worldState },
      };
    } catch (error) {
      await callback({
        text: 'Scan failed. The chain is unreadable right now.',
        action: 'SCAN_TOKENS',
        error: true,
      });
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },
};

/**
 * Check Creator Action - Look up creator stats
 */
export const checkCreatorAction: Action = {
  name: 'CHECK_CREATOR',
  description: 'Look up creator statistics and rankings',
  similes: ['check creator', 'who created', 'creator stats', 'top creators'],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';
    return (
      text.includes('creator') ||
      text.includes('who made') ||
      text.includes('who created') ||
      text.includes('top builders')
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: HandlerCallback
  ): Promise<ActionResult> => {
    const service = runtime.getService<BagsFmService>('bags-fm');

    if (!service) {
      await callback({
        text: 'Creator data unavailable.',
        action: 'CHECK_CREATOR',
      });
      return { success: false, error: new Error('Service unavailable') };
    }

    try {
      const creators = await service.getTopCreators(5);

      let responseText = `**Top Creators in BagsWorld:**\n\n`;

      if (creators.length > 0) {
        creators.forEach((creator, i) => {
          const name = creator.username || `${creator.wallet.slice(0, 6)}...${creator.wallet.slice(-4)}`;
          responseText += `${i + 1}. **${name}**\n`;
          responseText += `   Tokens: ${creator.tokensCreated} | Earned: ${creator.totalFeesEarned.toFixed(2)} SOL\n`;
        });
      } else {
        responseText += `No creator data available yet.`;
      }

      await callback({
        text: responseText,
        action: 'CHECK_CREATOR',
      });

      return {
        success: true,
        text: 'Creator lookup complete',
        values: { creatorCount: creators.length },
        data: { creators },
      };
    } catch (error) {
      await callback({
        text: 'Failed to fetch creator data.',
        action: 'CHECK_CREATOR',
        error: true,
      });
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },
};

/**
 * Report World State Action - Give a full status report
 */
export const reportWorldStateAction: Action = {
  name: 'REPORT_WORLD',
  description: 'Generate a full BagsWorld status report',
  similes: ['world status', 'how is bagsworld', 'status report', 'ecosystem health'],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text?.toLowerCase() || '';
    return (
      text.includes('world') ||
      text.includes('status') ||
      text.includes('health') ||
      text.includes('how is') ||
      text.includes('report')
    );
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: HandlerCallback
  ): Promise<ActionResult> => {
    const service = runtime.getService<BagsFmService>('bags-fm');

    if (!service) {
      await callback({
        text: 'Cannot access world state.',
        action: 'REPORT_WORLD',
      });
      return { success: false, error: new Error('Service unavailable') };
    }

    try {
      const worldState = await service.getWorldState();
      const recentEvents = service.getRecentEvents(3);

      const healthEmoji = worldState.health >= 80 ? '🌟' :
                         worldState.health >= 60 ? '☀️' :
                         worldState.health >= 40 ? '🌤️' :
                         worldState.health >= 20 ? '⛈️' : '🌋';

      let responseText = `**BagsWorld Status Report** ${healthEmoji}\n\n`;
      responseText += `Health: ${worldState.health}%\n`;
      responseText += `Weather: ${worldState.weather}\n`;
      responseText += `Active Tokens: ${worldState.activeTokens}\n`;
      responseText += `24h Volume: $${(worldState.totalVolume / 1000000).toFixed(2)}M\n`;
      responseText += `Total Fees: $${(worldState.totalFees / 1000).toFixed(2)}K\n`;

      if (recentEvents.length > 0) {
        responseText += `\n**Recent Activity:**\n`;
        recentEvents.forEach(e => {
          if (e.type === 'token_launch') {
            responseText += `• New launch: $${e.token.symbol}\n`;
          } else if (e.type === 'price_pump') {
            responseText += `• $${e.token.symbol} pumped ${e.changePercent.toFixed(1)}%\n`;
          }
        });
      }

      await callback({
        text: responseText,
        action: 'REPORT_WORLD',
      });

      return {
        success: true,
        text: 'World report generated',
        values: { health: worldState.health },
        data: { worldState, recentEvents },
      };
    } catch (error) {
      await callback({
        text: 'World report unavailable.',
        action: 'REPORT_WORLD',
        error: true,
      });
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },
};

/**
 * Analyze Token Action - Deep dive on a specific token
 */
export const analyzeTokenAction: Action = {
  name: 'ANALYZE_TOKEN',
  description: 'Perform deep analysis on a specific token',
  similes: ['analyze', 'look at', 'check out', 'tell me about', 'what about'],

  validate: async (runtime: IAgentRuntime, message: Memory): Promise<boolean> => {
    const text = message.content?.text || '';
    // Look for token symbols like $SYMBOL
    return /\$[A-Z]{2,10}/i.test(text);
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: HandlerCallback
  ): Promise<ActionResult> => {
    const service = runtime.getService<BagsFmService>('bags-fm');

    if (!service) {
      await callback({
        text: 'Token analysis unavailable.',
        action: 'ANALYZE_TOKEN',
      });
      return { success: false, error: new Error('Service unavailable') };
    }

    const text = message.content?.text || '';
    const symbolMatch = text.match(/\$([A-Z]{2,10})/i);

    if (!symbolMatch) {
      await callback({
        text: 'Specify a token symbol like $SYMBOL to analyze.',
        action: 'ANALYZE_TOKEN',
      });
      return { success: false, error: new Error('No symbol provided') };
    }

    const symbol = symbolMatch[1].toUpperCase();

    try {
      const results = await service.searchTokens(symbol);
      const token = results.find(t => t.symbol.toUpperCase() === symbol);

      if (!token) {
        await callback({
          text: `$${symbol} not found in BagsWorld. It may not be tracked yet.`,
          action: 'ANALYZE_TOKEN',
        });
        return { success: false, error: new Error('Token not found') };
      }

      const trend = token.priceChange24h >= 0 ? '📈' : '📉';
      let responseText = `**$${token.symbol} Analysis**\n\n`;
      responseText += `Name: ${token.name}\n`;
      responseText += `Market Cap: $${(token.marketCap / 1000).toFixed(1)}K\n`;
      responseText += `24h Volume: $${(token.volume24h / 1000).toFixed(1)}K\n`;
      responseText += `24h Change: ${trend} ${token.priceChange24h >= 0 ? '+' : ''}${token.priceChange24h.toFixed(2)}%\n`;
      responseText += `Holders: ${token.holders}\n`;
      responseText += `Fees Generated: ${token.feesGenerated.toFixed(3)} SOL\n`;
      responseText += `\nMint: \`${token.mint}\``;

      await callback({
        text: responseText,
        action: 'ANALYZE_TOKEN',
      });

      return {
        success: true,
        text: `Analyzed ${symbol}`,
        values: { symbol, marketCap: token.marketCap },
        data: { token },
      };
    } catch (error) {
      await callback({
        text: `Failed to analyze $${symbol}.`,
        action: 'ANALYZE_TOKEN',
        error: true,
      });
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  },
};

export const bagsActions = [
  scanTokensAction,
  checkCreatorAction,
  reportWorldStateAction,
  analyzeTokenAction,
];
