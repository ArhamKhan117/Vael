import { createClient } from "@supabase/supabase-js"
import { env } from "../config/env"

/**
 * Supabase client untuk backend operations
 * Menggunakan service role key untuk bypass RLS (Row Level Security)
 */
export const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

