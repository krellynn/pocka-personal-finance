import { describe, expect, it } from "vitest";
import { parseAmountInput } from "./parseAmountInput";

describe("parseAmountInput", () => {
  it.each([
    ["Rp 1.500.000", "1500000"],
    ["rp1500000", "1500000"],
    ["  25 000 ", "25000"],
    ["007", "7"],
    ["999.999.999.999.999", "999999999999999"],
  ])("reads %j as %j", (input, expected) => expect(parseAmountInput(input)).toBe(expected));

  it.each(["", "0", "Rp", "1,5", "1.5", "12.34.567", "abc", "1e5", "1234567890123456", "-5", "--5"])(
    "rejects %j",
    (input) => expect(parseAmountInput(input)).toBeNull(),
  );

  it("allows a negative or zero amount only when asked (opening balance)", () => {
    expect(parseAmountInput("-Rp 2.000", { allowNegative: true })).toBe("-2000");
    expect(parseAmountInput("Rp -2.000", { allowNegative: true })).toBe("-2000");
    expect(parseAmountInput("-Rp-2", { allowNegative: true })).toBeNull();
    expect(parseAmountInput("0", { allowZero: true })).toBe("0");
    expect(parseAmountInput("-0", { allowNegative: true, allowZero: true })).toBe("0");
  });
});
