// Database module exports
// Provides persistent storage for ElizaOS agents using Neon PostgreSQL

export * from './types';
export * from './neon-adapter';

import { getDatabaseAdapter, NeonDatabaseAdapter } from './neon-adapter';

// Re-export for convenience
export { getDatabaseAdapter, NeonDatabaseAdapter };
export default getDatabaseAdapter;
