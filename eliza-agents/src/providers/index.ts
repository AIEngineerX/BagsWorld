export { worldStateProvider } from './worldState.js';
export { topCreatorsProvider } from './topCreators.js';
export { tokenDataProvider } from './tokenData.js';
export { agentContextProvider } from './agentContext.js';
export { ghostTradingProvider } from './ghostTrading.js';
export { ascensionDataProvider } from './ascensionData.js';

import { worldStateProvider } from './worldState.js';
import { topCreatorsProvider } from './topCreators.js';
import { tokenDataProvider } from './tokenData.js';
import { agentContextProvider } from './agentContext.js';
import { ghostTradingProvider } from './ghostTrading.js';
import { ascensionDataProvider } from './ascensionData.js';

export const allProviders = [
  worldStateProvider,
  topCreatorsProvider,
  tokenDataProvider,
  agentContextProvider,
  ghostTradingProvider,
  ascensionDataProvider,
];

export default allProviders;
