const knownCodes: Record<string, string> = {
  invalid_credentials: "auth.errors.invalidCredentials",
  email_not_confirmed: "auth.errors.emailNotConfirmed",
  user_already_exists: "auth.errors.userAlreadyExists",
  email_exists: "auth.errors.userAlreadyExists",
  weak_password: "auth.errors.weakPassword",
  same_password: "auth.errors.samePassword",
  over_email_send_rate_limit: "auth.errors.rateLimited",
  over_request_rate_limit: "auth.errors.rateLimited",
  session_not_found: "auth.errors.sessionExpired",
};

/** Maps a Supabase Auth error to an i18n key; never surfaces raw server text. */
export function authErrorKey(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  return knownCodes[code] ?? "auth.errors.generic";
}
