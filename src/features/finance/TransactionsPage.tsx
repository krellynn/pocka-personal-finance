import { useQuery } from "@tanstack/react-query";
import { useId, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { monthRange } from "../../lib/datetime/monthRange";
import { todayInTimeZone } from "../../lib/datetime/todayInTimeZone";
import { FEED_LIMIT, fetchFeed, fetchPeriodTotals } from "./api";
import { financeKeys } from "./keys";
import { money, sumTotals } from "./money";
import { RowActions } from "./RowActions";
import { TransactionForm } from "./TransactionForm";
import { useWorkspace } from "./useWorkspace";

type Row = Awaited<ReturnType<typeof fetchFeed>>[number];

export function TransactionsPage() {
  const { t } = useTranslation();
  const ws = useWorkspace().data;
  return (
    <section className="max-w-3xl space-y-5">
      <h1 className="text-3xl font-bold tracking-tight">{t("nav.transactions")}</h1>
      {ws && (
        <>
          <TransactionForm workspaceId={ws.id} timeZone={ws.timezone} />
          <MonthView workspaceId={ws.id} timeZone={ws.timezone} />
        </>
      )}
    </section>
  );
}

function MonthView({ workspaceId, timeZone }: { workspaceId: string; timeZone: string }) {
  const { t } = useTranslation();
  const monthId = useId();
  const thisMonth = todayInTimeZone(timeZone).slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [saved, setSaved] = useState(false);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const onSaved = () => {
    setSaved(true);
    listHeading.current?.focus();
  };
  const { from, to } = monthRange(month);
  const feed = useQuery({ queryKey: [...financeKeys.feed(workspaceId), month], queryFn: () => fetchFeed(workspaceId, from, to) });
  const totals = useQuery({ queryKey: [...financeKeys.periodTotals(workspaceId), month], queryFn: () => fetchPeriodTotals(workspaceId, from, to) });
  const sums = totals.data && sumTotals(totals.data);

  return (
    <>
      <div className="surface-card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="section-title">{t("transactions.monthTitle")}</h2>
          <div>
            <label htmlFor={monthId} className="text-sm font-medium">{t("transactions.month")}</label>
            <input
              id={monthId}
              type="month"
              value={month}
              max={thisMonth}
              onChange={(e) => {
                if (/^\d{4}-\d{2}$/.test(e.target.value)) setMonth(e.target.value);
                setSaved(false);
              }}
              className="ml-2 rounded-xl border border-[color:var(--field)] bg-white px-3 py-2 text-sm"
            />
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
          {(["income", "expense", "net"] as const).map((k) => (
            <div key={k} className="rounded-xl border border-[color:var(--line)] p-3">
              <dt className="text-xs text-muted">{t(`transactions.totals.${k}`)}</dt>
              <dd className="mt-1 break-all font-semibold tabular-nums">{sums ? money(sums[k].toString()) : totals.isError ? "—" : "…"}</dd>
            </div>
          ))}
        </dl>
        {totals.isError && <p className="mt-2 text-sm text-muted">{t("transactions.totalsFailed")}</p>}
      </div>
      <div className="surface-card">
        <h2 ref={listHeading} tabIndex={-1} className="section-title outline-none">{t("transactions.listTitle")}</h2>
        <p role="status" className="text-sm text-muted">
          {saved ? t("transactions.actions.done") : feed.isPending ? t("transactions.loading") : feed.isError ? t("transactions.loadFailed") : feed.data.length === 0 ? t("transactions.empty") : ""}
        </p>
        <ul className="mt-2 divide-y divide-[color:var(--line)]">
          {feed.data?.map((row) => <FeedRow key={row.id} row={row} workspaceId={workspaceId} timeZone={timeZone} onSaved={onSaved} />)}
        </ul>
        {feed.data?.length === FEED_LIMIT && <p className="mt-2 text-xs text-muted">{t("transactions.capped", { count: FEED_LIMIT })}</p>}
      </div>
    </>
  );
}

const sign: Partial<Record<string, string>> = { income: "+", refund: "+", expense: "-" };

function FeedRow({ row, workspaceId, timeZone, onSaved }: { row: Row; workspaceId: string; timeZone: string; onSaved: () => void }) {
  const { t } = useTranslation();
  const kind = row.kind ?? "";
  const title = kind === "transfer" ? `${row.account_name} → ${row.counter_account_name}` : row.category_name ?? t(`transactions.kinds.${kind}`);
  const refunded = row.refunded_amount && row.refunded_amount !== "0" ? row.refunded_amount : null;
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-3">
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted">
          {row.occurred_on} · {kind === "transfer" ? t("transactions.kinds.transfer") : row.account_name}
          {row.note ? ` · ${row.note}` : ""}
        </p>
        <p className="mt-1 flex flex-wrap gap-1 text-xs">
          {!["transfer", "income", "expense"].includes(kind) && <Badge>{t(`transactions.kinds.${kind}`)}</Badge>}
          {row.is_reversed && <Badge>{t("transactions.badges.reversed")}</Badge>}
          {refunded && <Badge>{t("transactions.badges.refunded", { amount: money(refunded) })}</Badge>}
        </p>
      </div>
      <p className="font-semibold tabular-nums">{(sign[kind] ?? "") + money(row.amount)}</p>
      <RowActions row={row} workspaceId={workspaceId} timeZone={timeZone} onSaved={onSaved} />
    </li>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-[color:var(--field)] px-2 py-0.5 text-muted">{children}</span>;
}
