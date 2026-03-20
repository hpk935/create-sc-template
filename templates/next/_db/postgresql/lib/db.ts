import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL!;

if (!DATABASE_URL) {
  throw new Error(
    'Please define the DATABASE_URL environment variable in .env'
  );
}

let cached = global as typeof globalThis & {
  pg: ReturnType<typeof drizzle> | null;
};

if (!cached.pg) {
  const client = postgres(DATABASE_URL);
  cached.pg = drizzle(client);
}

const db = cached.pg;

export default db;
