/**
 * Trading Agent Plugin Template
 *
 * Provides:
 * - Price checking actions
 * - Wallet balance provider
 * - Trade execution (with confirmation)
 * - Market analysis tools
 *
 * Customize:
 * - Add your own trading strategies
 * - Integrate additional data sources
 * - Implement your risk management rules
 */

import {
  Plugin,
  Action,
  Provider,
  Evaluator,
  IAgentRuntime,
  Memory,
  State,
} from '@elizaos/core';

// ============ PROVIDERS ============

/**
 * Provides current token prices to agent context
 */
const priceProvider: Provider = {
  name: 'tokenPrices',

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const text = message.content.text.toLowerCase();

    // Extract token mentions (basic pattern - enhance as needed)
    const tokenPattern = /\$([a-zA-Z]+)/g;
    const matches = text.match(tokenPattern);

    if (!matches || matches.length === 0) {
      return { text: '', data: {} };
    }

    const tokens = matches.map(m => m.replace('$', '').toUpperCase());

    try {
      const prices = await Promise.all(
        tokens.map(async (token) => {
          const data = await fetchDexScreenerPrice(token);
          return {
            symbol: token,
            price: data?.priceUsd || 'N/A',
            change24h: data?.priceChange24h || 'N/A',
            volume24h: data?.volume24h || 'N/A',
            liquidity: data?.liquidity || 'N/A',
          };
        })
      );

      const priceText = prices
        .map(p => `${p.symbol}: $${p.price} (${p.change24h}% 24h, Vol: $${formatNumber(p.volume24h)})`)
        .join('\n');

      return {
        text: `Current prices:\n${priceText}`,
        data: { prices },
      };
    } catch (error) {
      console.error('Price provider error:', error);
      return { text: 'Unable to fetch prices', data: { error: error.message } };
    }
  },
};

/**
 * Provides wallet balance information
 */
const walletProvider: Provider = {
  name: 'walletBalance',

  get: async (runtime: IAgentRuntime, message: Memory, state?: State) => {
    const wallet = runtime.getSetting('SOLANA_PUBLIC_KEY');
    if (!wallet) {
      return { text: 'Wallet not configured', data: { configured: false } };
    }

    try {
      const balances = await fetchWalletBalances(wallet);

      const balanceText = balances
        .slice(0, 10) // Top 10 holdings
        .map(b => `${b.symbol}: ${b.amount} ($${formatNumber(b.valueUsd)})`)
        .join('\n');

      return {
        text: `Wallet balances:\n${balanceText}`,
        data: { balances, wallet },
      };
    } catch (error) {
      console.error('Wallet provider error:', error);
      return { text: 'Unable to fetch wallet', data: { error: error.message } };
    }
  },
};

// ============ ACTIONS ============

/**
 * Check token price and metrics
 */
const checkPriceAction: Action = {
  name: 'CHECK_PRICE',
  description: 'Check current price and metrics for a token',
  similes: ['price', 'check price', 'how much', 'what is the price'],

  validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    const text = message.content.text.toLowerCase();
    return text.includes('price') ||
           text.includes('how much') ||
           text.match(/\$[a-zA-Z]+/) !== null;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: (response: any) => void
  ) => {
    const token = extractToken(message.content.text);

    if (!token) {
      callback({ text: 'Please specify a token (e.g., $SOL or SOL)' });
      return 'no_token';
    }

    try {
      const data = await fetchDexScreenerPrice(token);

      if (!data) {
        callback({ text: `Could not find data for ${token}` });
        return 'not_found';
      }

      const response = `
**${token} Analysis**

Price: $${data.priceUsd}
24h Change: ${data.priceChange24h}%
24h Volume: $${formatNumber(data.volume24h)}
Liquidity: $${formatNumber(data.liquidity)}
Market Cap: $${formatNumber(data.marketCap)}

${getRiskAssessment(data)}
      `.trim();

      callback({ text: response });
      return 'success';
    } catch (error) {
      callback({ text: `Error fetching price: ${error.message}` });
      return 'error';
    }
  },

  examples: [
    [
      { user: '{{user1}}', content: { text: 'What is the price of $SOL?' } },
      { user: '{{agentName}}', content: { text: 'Let me check...', action: 'CHECK_PRICE' } },
    ],
    [
      { user: '{{user1}}', content: { text: 'Check $BONK price' } },
      { user: '{{agentName}}', content: { text: 'Fetching data...', action: 'CHECK_PRICE' } },
    ],
  ],
};

/**
 * Analyze token for trading
 */
const analyzeAction: Action = {
  name: 'ANALYZE_TOKEN',
  description: 'Perform deep analysis on a token',
  similes: ['analyze', 'research', 'investigate', 'look into', 'check out'],

  validate: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    const text = message.content.text.toLowerCase();
    return text.includes('analyze') ||
           text.includes('research') ||
           text.includes('investigate');
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: (response: any) => void
  ) => {
    const token = extractToken(message.content.text);

    if (!token) {
      callback({ text: 'Please specify a token to analyze' });
      return 'no_token';
    }

    callback({ text: `Analyzing ${token}... This may take a moment.` });

    try {
      const [priceData, holderData] = await Promise.all([
        fetchDexScreenerPrice(token),
        fetchHolderDistribution(token),
      ]);

      const analysis = generateAnalysis(token, priceData, holderData);

      callback({
        text: analysis,
        action: 'ANALYZE_TOKEN',
      });

      return 'success';
    } catch (error) {
      callback({ text: `Analysis failed: ${error.message}` });
      return 'error';
    }
  },

  examples: [
    [
      { user: '{{user1}}', content: { text: 'Analyze $TOKEN for me' } },
      { user: '{{agentName}}', content: { text: 'Running analysis...', action: 'ANALYZE_TOKEN' } },
    ],
  ],
};

// ============ EVALUATORS ============

/**
 * Track trading-related conversations for learning
 */
const tradeEvaluator: Evaluator = {
  name: 'TRADE_TRACKER',
  description: 'Track trading discussions for analysis',

  shouldRun: (message: Memory, state: State) => {
    const text = message.content.text.toLowerCase();
    return text.includes('buy') ||
           text.includes('sell') ||
           text.includes('trade') ||
           text.includes('position');
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    options: any,
    callback: (response: string) => void,
    responses: Memory[]
  ) => {
    // Extract trading intent for future analysis
    const intent = extractTradingIntent(message.content.text);

    if (intent) {
      await runtime.createMemory({
        content: {
          text: `Trading discussion: ${intent.action} ${intent.token}`,
          metadata: {
            type: 'trading_intent',
            ...intent,
          },
        },
        roomId: message.roomId,
      });
    }

    callback('Trade intent logged');
    return 'logged';
  },
};

// ============ HELPER FUNCTIONS ============

async function fetchDexScreenerPrice(token: string): Promise<any> {
  // Implement DexScreener API call
  const response = await fetch(
    `https://api.dexscreener.com/latest/dex/search?q=${token}`
  );
  const data = await response.json();

  const pair = data.pairs?.find(
    (p: any) => p.chainId === 'solana' && p.baseToken.symbol.toUpperCase() === token.toUpperCase()
  );

  if (!pair) return null;

  return {
    priceUsd: pair.priceUsd,
    priceChange24h: pair.priceChange?.h24 || 0,
    volume24h: pair.volume?.h24 || 0,
    liquidity: pair.liquidity?.usd || 0,
    marketCap: pair.fdv || 0,
  };
}

async function fetchWalletBalances(wallet: string): Promise<any[]> {
  // Implement Helius or RPC balance fetch
  // This is a placeholder - implement with your preferred API
  return [];
}

async function fetchHolderDistribution(token: string): Promise<any> {
  // Implement holder distribution fetch
  // Use Helius or Birdeye API
  return {};
}

function extractToken(text: string): string | null {
  const match = text.match(/\$?([a-zA-Z]{2,10})/i);
  return match ? match[1].toUpperCase() : null;
}

function formatNumber(num: number): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(2);
}

function getRiskAssessment(data: any): string {
  const risks: string[] = [];

  if (data.liquidity < 50000) {
    risks.push('Low liquidity - high slippage risk');
  }
  if (data.volume24h < 10000) {
    risks.push('Low volume - difficult to exit');
  }
  if (Math.abs(data.priceChange24h) > 50) {
    risks.push('High volatility - extreme price swings');
  }

  if (risks.length === 0) {
    return 'Risk: Moderate - standard memecoin risk applies. NFA.';
  }

  return `Risk factors:\n${risks.map(r => `- ${r}`).join('\n')}\n\nNFA - Do your own research.`;
}

function generateAnalysis(token: string, priceData: any, holderData: any): string {
  // Generate comprehensive analysis
  return `
**${token} Deep Analysis**

📊 **Price Metrics**
- Current: $${priceData?.priceUsd || 'N/A'}
- 24h Change: ${priceData?.priceChange24h || 'N/A'}%
- Volume: $${formatNumber(priceData?.volume24h || 0)}
- Liquidity: $${formatNumber(priceData?.liquidity || 0)}

👥 **Holder Distribution**
- Analysis pending (implement holder fetch)

⚠️ **Risk Assessment**
${getRiskAssessment(priceData)}

📝 **Summary**
Standard memecoin risk applies. Always use proper position sizing and stop losses. NFA.
  `.trim();
}

function extractTradingIntent(text: string): any | null {
  const buyMatch = text.match(/buy\s+\$?(\w+)/i);
  const sellMatch = text.match(/sell\s+\$?(\w+)/i);

  if (buyMatch) {
    return { action: 'buy', token: buyMatch[1].toUpperCase() };
  }
  if (sellMatch) {
    return { action: 'sell', token: sellMatch[1].toUpperCase() };
  }

  return null;
}

// ============ PLUGIN EXPORT ============

export const tradingPlugin: Plugin = {
  name: '@template/trading-plugin',
  description: 'Trading agent capabilities for Solana memecoins',

  providers: [priceProvider, walletProvider],
  actions: [checkPriceAction, analyzeAction],
  evaluators: [tradeEvaluator],

  init: async (config, runtime) => {
    console.log('Trading plugin initialized');

    // Verify required settings
    const requiredSettings = ['SOLANA_PUBLIC_KEY'];
    for (const setting of requiredSettings) {
      if (!runtime.getSetting(setting)) {
        console.warn(`Warning: ${setting} not configured`);
      }
    }
  },

  start: async (runtime) => {
    console.log('Trading plugin started');
  },

  stop: async (runtime) => {
    console.log('Trading plugin stopped');
  },
};

export default tradingPlugin;
