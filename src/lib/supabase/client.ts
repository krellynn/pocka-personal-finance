import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Public browser config only: project URL + publishable key. Never a secret/service-role key.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!url || !publishableKey) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY (see .env.example).");
}

export const supabase = createClient<Database>(url, publishableKey);
