import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./config";

export function isSupabaseConfigured(): boolean {
  return getSupabaseEnv().isConfigured;
}

export function createClient() {
  const { url, key } = getSupabaseEnv();
  return createBrowserClient(url, key || "placeholder-publishable-key");
}
