// Browser-side Supabase client. Uses the public anon key (safe to expose),
// protected by Row Level Security policies on the database side.

import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
