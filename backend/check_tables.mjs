
import postgres from 'postgres';
import 'dotenv/config';

async function main() {
  const queryClient = postgres(process.env.DATABASE_URL);
  const result = await queryClient`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
  console.log('Tables in DB:', result);
  process.exit(0);
}
main().catch(console.error);
