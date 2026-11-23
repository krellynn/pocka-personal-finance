import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { onAuthChange } from "./api";
import { AuthContext, type AuthState } from "./useAuth";

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<AuthState>({ session: null, loading: true });
  const lastUserId = useRef<string | null>(null);

  useEffect(
    () =>
      // INITIAL_SESSION fires first with the session restored from storage (refresh-safe).
      // Keep the callback synchronous: no Supabase calls inside it.
      onAuthChange((_event, session) => {
        const userId = session?.user.id ?? null;
        // Sign-out, or another tab switching user: drop the previous user's cached data.
        if (userId !== lastUserId.current && lastUserId.current !== null) queryClient.clear();
        lastUserId.current = userId;
        // Skip re-renders when nothing changed (e.g. SIGNED_IN fired again on tab refocus).
        const key = (s: AuthState["session"]) => (s ? `${s.user.id}:${s.access_token}` : null);
        setState((prev) => (!prev.loading && key(prev.session) === key(session) ? prev : { session, loading: false }));
      }),
    [queryClient],
  );

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
