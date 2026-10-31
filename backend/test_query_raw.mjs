
import postgres from 'postgres';
import 'dotenv/config';

async function main() {
  const queryClient = postgres(process.env.DATABASE_URL);
  try {
    const result = await queryClient`SELECT * FROM medications WHERE user_id = 'test-user-123'`;
    console.log('Raw Query Success! Meds found:', result.length);
  } catch (e) {
    console.error('Raw Query Failed:', e);
  }
  process.exit(0);
}
main();
