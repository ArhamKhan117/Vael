import { SupabaseClient, createClient } from "@supabase/supabase-js"

import { serviceEnv } from "../config/env"

/**
 * The Supabase client, created on first use.
 *
 * Lazy on purpose. Creating it at module scope meant that importing any route which happens to
 * touch `dbService` pulled the credentials in, and the whole API refused to boot without a Supabase
 * project, a Groq key, and a Pinata JWT. None of those are needed to serve a hero, a raid, or a
 * proof, so the failure now happens where the credential is actually used and is reported as a 503
 * by that one route rather than as a crash at startup.
 */
let client: SupabaseClient | undefined

export function getSupabase(): SupabaseClient {
  if (!client) {
    const env = serviceEnv()
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return client
}

/**
 * A proxy that behaves like the client but defers construction to the first property access.
 *
 * Existing call sites say `supabase.from(...)`; keeping that shape means the laziness is invisible
 * to them rather than requiring every one to be rewritten.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    return Reflect.get(getSupabase(), property, receiver)
  },
})
