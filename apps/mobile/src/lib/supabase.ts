import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

import { getSupabasePublishableKey, getSupabaseUrl, hasSupabaseEnv } from "./env";

let client: any = null;

export function getSupabaseClient(): any {
  if (!hasSupabaseEnv()) {
    return null;
  }

  if (!client) {
    const url = getSupabaseUrl();
    const key = getSupabasePublishableKey();

    if (!url || !key) {
      return null;
    }

    client = createClient(url, key, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        storage: AsyncStorage,
        flowType: "pkce",
      },
    });
  }

  return client;
}

export { hasSupabaseEnv };
