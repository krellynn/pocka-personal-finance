import { formatMinorUnits } from "../../lib/money/formatMinorUnits";

/** Formats a wire amount (digit string) as Rupiah without going through Number. */
export const money = (amount: string | null) => formatMinorUnits(BigInt(amount ?? "0"), { code: "IDR", minorUnits: 0 });

/** Income, expense and net for period_totals rows; summed as bigint so large amounts stay exact. */
export function sumTotals(rows: { kind: string; total: string | null }[]) {
  const sum = (kind: string) => rows.filter((r) => r.kind === kind).reduce((acc, r) => acc + BigInt(r.total ?? "0"), 0n);
  const income = sum("income");
  const expense = sum("expense");
  return { income, expense, net: income - expense };
}
