import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigurado = Boolean(supabaseUrl && supabaseKey);

export const supabase = supabaseConfigurado
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function exigirSupabase() {
  if (!supabase) {
    throw new Error("Configura las variables VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.");
  }
  return supabase;
}
