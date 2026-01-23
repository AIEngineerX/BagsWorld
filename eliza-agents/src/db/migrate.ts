// Database Migration Script for ElizaOS
// Run: bun run db:migrate

import { getDatabaseAdapter } from './neon-adapter';

async function migrate() {
  console.log('Starting ElizaOS database migration...\n');

  const db = getDatabaseAdapter();

  // Check database connection
  console.log('Checking database connection...');
  const healthy = await db.healthCheck();
  if (!healthy) {
    console.error('ERROR: Database health check failed');
    process.exit(1);
  }
  console.log('Database connection: OK\n');

  // Initialize tables
  console.log('Creating/updating tables...');
  await db.initialize();
  console.log('Tables created successfully\n');

  // Verify tables exist
  console.log('Verifying tables...');
  const tables = [
    'eliza_memories',
    'eliza_goals',
    'eliza_relationships',
    'eliza_rooms',
    'eliza_participants',
    'eliza_accounts',
    'eliza_cache',
    'eliza_coordination',
    'eliza_shared_context',
  ];

  for (const table of tables) {
    const count = await countRows(db, table);
    console.log(`  ${table}: ${count} rows`);
  }

  console.log('\nMigration completed successfully!');
  console.log('ElizaOS database is ready for use.');

  await db.close();
  process.exit(0);
}

async function countRows(db: ReturnType<typeof getDatabaseAdapter>, table: string): Promise<number> {
  // This is a simple count - in production you might want more sophisticated checks
  const neonModule = await import('@neondatabase/serverless');
  const databaseUrl = process.env.DATABASE_URL ||
                      process.env.NEON_DATABASE_URL ||
                      process.env.POSTGRES_URL ||
                      process.env.NETLIFY_DATABASE_URL;

  if (!databaseUrl) return 0;

  const sql = neonModule.neon(databaseUrl);
  const result = await sql`SELECT COUNT(*) as count FROM ${sql.identifier([table])}`;
  return parseInt((result as [{ count: string }])[0]?.count || '0', 10);
}

migrate().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
