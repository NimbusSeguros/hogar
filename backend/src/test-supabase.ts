
import { SupabaseProvider } from './services/SupabaseProvider';

async function test() {
  try {
    console.log('Testing SupabaseProvider...');
    // This will probably fail because of missing table or connection, but we want to see if it even runs
    const result = await SupabaseProvider.getOrderByRusId('hogar', 'test-id');
    console.log('Result:', result);
  } catch (err: any) {
    console.error('Caught error:', err.message);
  }
}

test();
