import { createClient } from '@supabase/supabase-js'
import type { Database } from '../integrations/supabase/types'

// Runtime env first, then the project's public Cloud connection as a safe
// fallback for published Vite builds where env vars were not injected.
const env = import.meta.env as Record<string, string | undefined>
const CLOUD_URL = 'https://yqwspssnpeyvzhpdoqpy.supabase.co'
const CLOUD_PUBLISHABLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlxd3Nwc3NucGV5dnpocGRvcXB5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTc5MTcsImV4cCI6MjA5Njg3MzkxN30.lAFrMYqlkmBmnMWFo_ypo5rlxmC-RV9HTqg0mU5_M-o'

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || CLOUD_URL
const supabaseAnonKey =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  env.SUPABASE_ANON_KEY ||
  env.SUPABASE_PUBLISHABLE_KEY ||
  CLOUD_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
})
