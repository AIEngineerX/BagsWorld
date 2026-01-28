// Routes index - exports all route modules

export { default as chatRoutes } from './chat.js';
export { default as tokenRoutes } from './tokens.js';
export { default as worldRoutes } from './world.js';
export { default as autonomousRoutes } from './autonomous.js';
export { default as coordinationRoutes } from './coordination.js';
export { default as launchWizardRoutes } from './launch-wizard.js';
export { default as creatorToolsRoutes } from './creator-tools.js';
export { default as ghostRoutes } from './ghost.js';
export { default as twitterRoutes } from './twitter.js';

export { setDatabase, getDatabase } from './shared.js';
