// Server-side only Supabase client using the service role key. This key has
// full database access, bypassing Row Level Security, so it must NEVER be
// imported into any file that runs in the browser — only pages/api/*.

const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = { supabaseAdmin };
