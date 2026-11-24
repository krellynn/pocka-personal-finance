import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client";

// The only module in the auth feature that talks to Supabase.

const updatePasswordUrl = () => `${window.location.origin}/update-password`;

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

/** Returns true when a session started immediately (email confirmation disabled). */
export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName }, emailRedirectTo: window.location.origin },
  });
  if (error) throw error;
  return data.session !== null;
}

/** Always ends the session on this device: a failed global sign-out (offline, 5xx) falls back to local. */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) await supabase.auth.signOut({ scope: "local" });
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: updatePasswordUrl() });
  if (error) throw error;
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export function onAuthChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, avatar_url")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateDisplayName(userId: string, displayName: string) {
  const { data, error } = await supabase.from("profiles").update({ display_name: displayName }).eq("id", userId).select("id").maybeSingle();
  if (error) throw error;
  // RLS or a missing row turns the update into a silent no-op; report it as a failure.
  if (!data) throw new Error("Profile not updated");
}
