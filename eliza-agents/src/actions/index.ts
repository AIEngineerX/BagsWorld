export { lookupTokenAction } from './lookupToken.js';
export { getCreatorFeesAction } from './getCreatorFees.js';
export { getTopCreatorsAction } from './getTopCreators.js';
export { getRecentLaunchesAction } from './getRecentLaunches.js';
export { checkWorldHealthAction } from './checkWorldHealth.js';

// Finn Actions (Fee Claims & Shilling)
export { claimFeesReminderAction } from './claimFeesReminderAction.js';
export { shillTokenAction } from './shillTokenAction.js';

// Ascension Spire Actions
export {
  celebrateAscensionAction,
  challengeRivalAction,
  reactToBlessingAction,
  commentOnAscensionAction,
  ascensionActions,
} from './ascension.js';

import { lookupTokenAction } from './lookupToken.js';
import { getCreatorFeesAction } from './getCreatorFees.js';
import { getTopCreatorsAction } from './getTopCreators.js';
import { getRecentLaunchesAction } from './getRecentLaunches.js';
import { checkWorldHealthAction } from './checkWorldHealth.js';
import { claimFeesReminderAction } from './claimFeesReminderAction.js';
import { shillTokenAction } from './shillTokenAction.js';
import {
  celebrateAscensionAction,
  challengeRivalAction,
  reactToBlessingAction,
  commentOnAscensionAction,
} from './ascension.js';

export const allActions = [
  lookupTokenAction,
  getCreatorFeesAction,
  getTopCreatorsAction,
  getRecentLaunchesAction,
  checkWorldHealthAction,
  // Finn Actions
  claimFeesReminderAction,
  shillTokenAction,
  // Ascension Spire
  celebrateAscensionAction,
  challengeRivalAction,
  reactToBlessingAction,
  commentOnAscensionAction,
];

export default allActions;
