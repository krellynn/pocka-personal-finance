export interface CurrencyMetadata {
  code: string;
  minorUnits: number;
}

export function formatMinorUnits(
  amount: bigint,
  currency: CurrencyMetadata,
  locale = "id-ID",
): string {
  const exponent = currency.minorUnits;
  if (!Number.isInteger(exponent) || exponent < 0 || exponent > 6) {
    throw new RangeError("Currency minorUnits must be an integer between 0 and 6.");
  }

  const factor = 10n ** BigInt(exponent);
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const whole = absolute / factor;
  const fraction = absolute % factor;
  const integerText = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(whole);

  let decimalSeparator = "";
  let fractionDigits = "";
  if (exponent > 0) {
    decimalSeparator = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
      .formatToParts(1)
      .find((part) => part.type === "decimal")?.value ?? "";
    if (!decimalSeparator) throw new Error("Unable to derive the decimal separator for locale.");

    fractionDigits = new Intl.NumberFormat(locale, {
      useGrouping: false,
      minimumIntegerDigits: exponent,
      maximumFractionDigits: 0,
    }).format(fraction);
  }

  if (currency.code === "IDR") {
    return `${negative ? "-" : ""}Rp${integerText}${decimalSeparator}${fractionDigits}`;
  }

  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  const parts = formatter.formatToParts(whole);
  let lastNumberPartIndex = -1;
  for (let index = 0; index < parts.length; index += 1) {
    const type = parts[index]?.type;
    if (type === "integer" || type === "group") lastNumberPartIndex = index;
  }

  if (exponent > 0) {
    parts.splice(
      lastNumberPartIndex + 1,
      0,
      { type: "decimal", value: decimalSeparator },
      { type: "fraction", value: fractionDigits },
    );
  }

  if (negative) {
    const negativeParts = formatter.formatToParts(-1n);
    const minusSignIndex = negativeParts.findIndex((part) => part.type === "minusSign");
    const minusSign = negativeParts.find((part) => part.type === "minusSign");
    if (minusSign) parts.splice(Math.max(0, minusSignIndex), 0, minusSign);
  }

  return parts.map((part) => part.value).join("");
}