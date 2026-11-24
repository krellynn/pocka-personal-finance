import { describe, expect, it } from "vitest";
import { financeErrorKey, isLedgerRejection } from "./errors";

describe("financeErrorKey", () => {
  it("maps ledger codes", () => {
    expect(financeErrorKey({ code: "P0001", message: "REFUND_EXCEEDS_ORIGINAL", details: "x" })).toBe("finance.errors.refundExceeds");
    expect(financeErrorKey({ code: "P0001", message: "AUTH_REQUIRED" })).toBe("auth.errors.sessionExpired");
  });

  it("falls back to generic for unknown codes, other errors and non-objects", () => {
    expect(financeErrorKey({ code: "P0001", message: "SOMETHING_NEW" })).toBe("finance.errors.generic");
    expect(financeErrorKey({ code: "PGRST301", message: "VALIDATION_FAILED" })).toBe("finance.errors.generic");
    expect(financeErrorKey(new TypeError("Failed to fetch"))).toBe("finance.errors.generic");
    expect(financeErrorKey(null)).toBe("finance.errors.generic");
    expect(financeErrorKey({ code: "P0001", message: "constructor" })).toBe("finance.errors.generic");
  });

  it("tells a server rejection from a network failure", () => {
    expect(isLedgerRejection({ code: "P0001", message: "VALIDATION_FAILED" })).toBe(true);
    expect(isLedgerRejection(new TypeError("Failed to fetch"))).toBe(false);
  });
});
