// Single Supabase client for the whole app.
// Re-export the auto-generated client so there is exactly one GoTrueClient
// instance sharing the auth storage key (fixes the "Multiple GoTrueClient
// instances detected" warning and prevents session races).
export { supabase } from '../integrations/supabase/client'

// Kept for legacy call sites — the generated client is always configured.
export const isSupabaseConfigured = true
