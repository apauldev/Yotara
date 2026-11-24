import { defineConfig } from 'drizzle-kit';

// Drizzle Studio is for local inspection only. Schema changes are applied at
// runtime by the bootstrap and upgrade guards in src/db/client.ts.
export default defineConfig({
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env['DATABASE_URL'] ?? './data/yotara.db',
  },
});
