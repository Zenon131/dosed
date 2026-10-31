
import postgres from 'postgres';
import 'dotenv/config';

async function main() {
  const queryClient = postgres(process.env.DATABASE_URL);
  const result = await queryClient`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'medications'`;
  console.log('Columns in medications:', result);
  process.exit(0);
}
main().catch(console.error);
