import { formatMinorUnits } from "../../lib/money/formatMinorUnits";

/** Formats a wire amount (digit string) as Rupiah without going through Number. */
export const money = (amount: string | null) => formatMinorUnits(BigInt(amount ?? "0"), { code: "IDR", minorUnits: 0 });
