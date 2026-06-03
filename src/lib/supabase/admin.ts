import { createClient } from "@supabase/supabase-js";

import { getSupabaseAdminKey, getSupabaseUrl, hasSupabaseAdminEnv } from "@/lib/supabase/config";

export function getSupabaseAdminClient() {
  if (!hasSupabaseAdminEnv()) {
    return null;
  }

  const url = getSupabaseUrl();
  const key = getSupabaseAdminKey();

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
