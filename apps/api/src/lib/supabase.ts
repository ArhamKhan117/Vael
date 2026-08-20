import { createClient } from "@supabase/supabase-js"
import { serviceEnv } from "../config/env"

/**
 * Supabase client untuk backend operations
 * Menggunakan service role key untuk bypass RLS (Row Level Security)
 */
export const supabase = createClient(serviceEnv().SUPABASE_URL, serviceEnv().SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

