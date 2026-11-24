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

/** A transfer, or a reversal of one, has two accounts and no category: show it as "From → To". */
export const isTransferLike = (row: { kind: string; counter_account_name: string | null; category_name: string | null }) =>
  row.kind === "transfer" || (!!row.counter_account_name && !row.category_name);
