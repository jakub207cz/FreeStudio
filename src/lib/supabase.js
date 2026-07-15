import { createClient } from '@supabase/supabase-js';

// Použijeme zástupné hodnoty pro fázi buildu, aby kompilátor Next.js neselhal na chybějících proměnných.
// Skutečné hodnoty budou načteny z produkčního prostředí (Vercel env vars).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn(
    'Varování: Chybí proměnné prostředí pro Supabase. Používám zástupné hodnoty pro sestavení aplikace (build).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
