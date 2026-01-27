export { lookupTokenAction } from './lookupToken.js';
export { getCreatorFeesAction } from './getCreatorFees.js';
export { getTopCreatorsAction } from './getTopCreators.js';
export { getRecentLaunchesAction } from './getRecentLaunches.js';
export { checkWorldHealthAction } from './checkWorldHealth.js';

// Oracle Prediction Market Actions
export { getOracleRoundAction } from './getOracleRound.js';
export { enterPredictionAction } from './enterPrediction.js';
export { checkPredictionAction } from './checkPrediction.js';
export { getOracleHistoryAction } from './getOracleHistory.js';

import { lookupTokenAction } from './lookupToken.js';
import { getCreatorFeesAction } from './getCreatorFees.js';
import { getTopCreatorsAction } from './getTopCreators.js';
import { getRecentLaunchesAction } from './getRecentLaunches.js';
import { checkWorldHealthAction } from './checkWorldHealth.js';
import { getOracleRoundAction } from './getOracleRound.js';
import { enterPredictionAction } from './enterPrediction.js';
import { checkPredictionAction } from './checkPrediction.js';
import { getOracleHistoryAction } from './getOracleHistory.js';

export const allActions = [
  lookupTokenAction,
  getCreatorFeesAction,
  getTopCreatorsAction,
  getRecentLaunchesAction,
  checkWorldHealthAction,
  // Oracle Prediction Market
  getOracleRoundAction,
  enterPredictionAction,
  checkPredictionAction,
  getOracleHistoryAction,
];

export default allActions;
