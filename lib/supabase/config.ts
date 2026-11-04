/**
 * Unified Supabase Environment Configuration
 * Validates presence of publishable key across standard naming conventions
 * without leaking key values.
 */
export function getSupabaseEnv() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    "https://rltvgdcwmgwikoukdjxq.supabase.co";

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    "";

  const isConfigured = Boolean(
    key &&
      key !== "placeholder-publishable-key" &&
      !key.includes("placeholder") &&
      key.length > 20
  );

  return {
    url,
    key,
    isConfigured,
    projectRef: "rltvgdcwmgwikoukdjxq",
  };
}
