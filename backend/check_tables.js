
const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
require('dotenv').config();

async function main() {
  const queryClient = postgres(process.env.DATABASE_URL);
  const db = drizzle(queryClient);
  const result = await queryClient`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
  console.log('Tables in DB:', result);
  process.exit(0);
}
main().catch(console.error);
