import { useTranslation } from "react-i18next";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./useAuth";

export function AuthLoading() {
  const { t } = useTranslation();
  return (
    <div role="status" className="grid min-h-screen place-items-center bg-canvas text-sm text-muted">
      {t("auth.loading")}
    </div>
  );
}

/** Protected area: waits for the restored session, then sends guests to sign-in. */
export function RequireAuth() {
  const { session, loading } = useAuth();
  const location = useLocation();
  if (loading) return <AuthLoading />;
  if (!session) return <Navigate to="/sign-in" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}

/** Guest-only pages: a signed-in user goes back where they came from. */
export function GuestOnly() {
  const { session, loading } = useAuth();
  const from: unknown = (useLocation().state as { from?: unknown } | null)?.from;
  if (loading) return <AuthLoading />;
  // Only same-app paths, never an absolute or protocol-relative URL.
  const safe = typeof from === "string" && from.startsWith("/") && !from.startsWith("//") && !from.startsWith("/\\");
  if (session) return <Navigate to={safe ? from : "/"} replace />;
  return <Outlet />;
}
