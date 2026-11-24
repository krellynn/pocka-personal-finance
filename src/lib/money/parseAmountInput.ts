/**
 * Reads what a person typed for an IDR amount ("Rp 1.500.000") into the wire format: a digit string
 * with an optional leading "-". Returns null for anything that is not a whole amount of at most 15 digits.
 * Never goes through Number, so large amounts stay exact.
 */
export function parseAmountInput(text: string, { allowNegative = false, allowZero = false } = {}): string | null {
  const match = /^(-?)(?:rp)?(-?)([\d.]+)$/i.exec(text.replace(/\s/g, ""));
  if (!match) return null;
  const [, signBefore = "", signAfter = "", body = ""] = match;
  if (signBefore && signAfter) return null;
  // Dots are thousands separators only: "1.500.000" yes, "1.5" no.
  if (body.includes(".") && !/^\d{1,3}(\.\d{3})+$/.test(body)) return null;
  const digits = body.replace(/\./g, "").replace(/^0+(?=\d)/, "");
  if (digits.length > 15) return null;
  if (digits === "0") return allowZero ? "0" : null;
  const negative = !!(signBefore || signAfter);
  if (negative && !allowNegative) return null;
  return (negative ? "-" : "") + digits;
}
