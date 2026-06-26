function readEnvValue(name: string) {
  const value = typeof process !== "undefined" ? process.env[name] : undefined;
  return value?.trim() ? value.trim() : null;
}

export function getSupabaseUrl() {
  return readEnvValue("EXPO_PUBLIC_SUPABASE_URL") ?? readEnvValue("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabasePublishableKey() {
  return (
    readEnvValue("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ??
    readEnvValue("EXPO_PUBLIC_SUPABASE_ANON_KEY") ??
    readEnvValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ??
    readEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}

export function hasSupabaseEnv() {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}
