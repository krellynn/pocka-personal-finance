import { describe, expect, it } from "vitest";
import i18n from "../../i18n";
import { authErrorKey } from "./errors";

describe("authErrorKey", () => {
  it("maps known Supabase error codes", () => {
    expect(authErrorKey({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe("auth.errors.invalidCredentials");
    expect(authErrorKey({ code: "weak_password" })).toBe("auth.errors.weakPassword");
  });

  it("falls back to a generic key for unknown or malformed errors", () => {
    expect(authErrorKey({ code: "something_new" })).toBe("auth.errors.generic");
    expect(authErrorKey(new Error("network"))).toBe("auth.errors.generic");
    expect(authErrorKey(null)).toBe("auth.errors.generic");
  });

  it("has an Indonesian translation for every mapped key", () => {
    const codes = ["invalid_credentials", "email_not_confirmed", "user_already_exists", "email_exists", "weak_password",
      "same_password", "over_email_send_rate_limit", "over_request_rate_limit", "session_not_found", "unknown"];
    for (const code of codes) expect(i18n.exists(authErrorKey({ code }))).toBe(true);
  });
});
