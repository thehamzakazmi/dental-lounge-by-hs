import { createClient } from '@supabase/supabase-js';

// Tells the new Next.js caching system to allow blocking for this route
export const instant = false;

export default async function SupabaseTestPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await supabase
    .from('patients') 
    .select('*')
    .limit(5);

  if (error) {
    return (
      <div style={{ padding: '2rem', color: 'red' }}>
        <h2>Query Failed</h2>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h2 style={{ color: 'green', marginBottom: '1rem' }}>
        Connection Successful!
      </h2>
      <p>Here is the data pulled from your database:</p>
      <pre style={{ background: '#f4f4f4', padding: '1rem', borderRadius: '8px' }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
