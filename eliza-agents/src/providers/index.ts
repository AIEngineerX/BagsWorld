export { worldStateProvider } from './worldState.js';
export { topCreatorsProvider } from './topCreators.js';
export { tokenDataProvider } from './tokenData.js';
export { agentContextProvider } from './agentContext.js';
export { oracleDataProvider } from './oracleData.js';
export { ghostTradingProvider } from './ghostTrading.js';

import { worldStateProvider } from './worldState.js';
import { topCreatorsProvider } from './topCreators.js';
import { tokenDataProvider } from './tokenData.js';
import { agentContextProvider } from './agentContext.js';
import { oracleDataProvider } from './oracleData.js';
import { ghostTradingProvider } from './ghostTrading.js';

export const allProviders = [
  worldStateProvider,
  topCreatorsProvider,
  tokenDataProvider,
  agentContextProvider,
  oracleDataProvider,
  ghostTradingProvider,
];

export default allProviders;
