// Ghost Trading Context Provider
// Injects real-time trading data into Ghost's conversations

import type { Provider, IAgentRuntime, Memory, State } from '../types/elizaos.js';
import { getGhostTrader } from '../services/GhostTrader.js';

export const ghostTradingProvider: Provider = {
  name: 'ghostTrading',
  description: 'Provides Ghost\'s real-time trading statistics and positions',

  async get(
    _runtime: IAgentRuntime,
    _memory: Memory,
    _state: State
  ): Promise<{ text: string } | null> {
    try {
      const trader = getGhostTrader();
      const stats = trader.getStats();
      const openPositions = trader.getOpenPositions();
      const config = trader.getConfig();

      // Build trading context
      const lines: string[] = [
        '=== GHOST TRADING STATUS ===',
        `Trading: ${stats.enabled ? 'ENABLED (LIVE)' : 'DISABLED'}`,
        `Open Positions: ${stats.openPositions}/${config.maxOpenPositions}`,
        `Total Exposure: ${stats.totalExposureSol.toFixed(4)} SOL`,
        `Max Exposure: ${config.maxTotalExposureSol} SOL`,
        '',
        '=== PERFORMANCE ===',
        `Total Trades: ${stats.totalTrades}`,
        `Winning: ${stats.winningTrades}`,
        `Losing: ${stats.losingTrades}`,
        `Win Rate: ${stats.winRate.toFixed(1)}%`,
        `Total P&L: ${stats.totalPnlSol >= 0 ? '+' : ''}${stats.totalPnlSol.toFixed(4)} SOL`,
        '',
        '=== STRATEGY ===',
        `Position Size: ${config.minPositionSol}-${config.maxPositionSol} SOL`,
        `Take Profit Tiers: ${config.takeProfitTiers.map(t => `${t}x`).join(', ')}`,
        `Trailing Stop: ${config.trailingStopPercent}%`,
        `Stop Loss: -${config.stopLossPercent}%`,
        `Min Liquidity: $${config.minLiquidityUsd.toLocaleString()}`,
        `Min Buy/Sell Ratio: ${config.minBuySellRatio}`,
        `Min Score: 70/100 points`,
      ];

      // Add open positions if any
      if (openPositions.length > 0) {
        lines.push('');
        lines.push('=== OPEN POSITIONS ===');
        for (const pos of openPositions) {
          const pnlStr = pos.pnlSol !== undefined
            ? `P&L: ${pos.pnlSol >= 0 ? '+' : ''}${pos.pnlSol.toFixed(4)} SOL`
            : '';
          lines.push(`$${pos.tokenSymbol}: ${pos.amountSol.toFixed(4)} SOL entry, ${pos.amountTokens.toLocaleString()} tokens ${pnlStr}`);
          if (pos.entryReason) {
            lines.push(`  Reason: ${pos.entryReason}`);
          }
        }
      } else {
        lines.push('');
        lines.push('=== OPEN POSITIONS ===');
        lines.push('No open positions - watching for opportunities');
      }

      // Recent activity
      const recentTrades = trader.getAllPositions()
        .filter(p => p.status === 'closed')
        .slice(-3);

      if (recentTrades.length > 0) {
        lines.push('');
        lines.push('=== RECENT TRADES ===');
        for (const trade of recentTrades) {
          const pnl = trade.pnlSol || 0;
          const result = pnl >= 0 ? 'WIN' : 'LOSS';
          lines.push(`$${trade.tokenSymbol}: ${result} ${pnl >= 0 ? '+' : ''}${pnl.toFixed(4)} SOL - ${trade.exitReason || 'closed'}`);
        }
      }

      return { text: lines.join('\n') };
    } catch (error) {
      console.error('[ghostTradingProvider] Error:', error);
      return { text: 'Trading data temporarily unavailable.' };
    }
  },
};

export default ghostTradingProvider;
