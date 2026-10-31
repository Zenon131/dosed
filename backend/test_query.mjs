
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './src/db/schema/schema.js';
import { eq } from 'drizzle-orm';
import 'dotenv/config';

async function main() {
  const queryClient = postgres(process.env.DATABASE_URL);
  const db = drizzle(queryClient);
  try {
    const meds = await db.select().from(schema.medications).where(eq(schema.medications.user_id, 'test-user-123'));
    console.log('Query Success! Meds found:', meds.length);
  } catch (e) {
    console.error('Query Failed:', e);
  }
  process.exit(0);
}
main();
