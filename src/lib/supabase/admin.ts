// Server-only Supabase client with the service-role key. It bypasses Row Level Security, so it is
// used for exactly three things (design.md PROJ-1): the login-brake log, the account-state lookup at
// signup, and deleting an account. Never import it from a Client Component — `server-only` turns
// that mistake into a build error.
import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set — see .env.local.example')
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
