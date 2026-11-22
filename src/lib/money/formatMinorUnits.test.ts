import { describe, expect, it } from "vitest";
import { formatMinorUnits } from "./formatMinorUnits";

describe("formatMinorUnits", () => {
  it("formats IDR without a space after Rp", () => {
    expect(formatMinorUnits(12850000n, { code: "IDR", minorUnits: 0 })).toBe("Rp12.850.000");
  });

  it("supports zero-decimal currencies", () => {
    expect(formatMinorUnits(500n, { code: "JPY", minorUnits: 0 })).toContain("500");
  });

  it("uses the locale decimal separator and currency placement", () => {
    expect(formatMinorUnits(10005n, { code: "USD", minorUnits: 2 }, "en-US")).toBe("$100.05");
    expect(formatMinorUnits(10005n, { code: "EUR", minorUnits: 2 }, "de-DE")).toBe("100,05\u00a0€");
  });

  it("preserves negative values", () => {
    expect(formatMinorUnits(-250000n, { code: "IDR", minorUnits: 0 })).toBe("-Rp250.000");
  });
});