export { lookupTokenAction } from './lookupToken.js';
export { getCreatorFeesAction } from './getCreatorFees.js';
export { getTopCreatorsAction } from './getTopCreators.js';
export { getRecentLaunchesAction } from './getRecentLaunches.js';
export { checkWorldHealthAction } from './checkWorldHealth.js';

import { lookupTokenAction } from './lookupToken.js';
import { getCreatorFeesAction } from './getCreatorFees.js';
import { getTopCreatorsAction } from './getTopCreators.js';
import { getRecentLaunchesAction } from './getRecentLaunches.js';
import { checkWorldHealthAction } from './checkWorldHealth.js';

export const allActions = [
  lookupTokenAction,
  getCreatorFeesAction,
  getTopCreatorsAction,
  getRecentLaunchesAction,
  checkWorldHealthAction,
];

export default allActions;
