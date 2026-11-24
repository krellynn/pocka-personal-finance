import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, Plus, Sparkles, Wallet, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { monthRange } from "../../lib/datetime/monthRange";
import { todayInTimeZone } from "../../lib/datetime/todayInTimeZone";
import { fetchAccounts, fetchFeed, fetchPeriodTotals } from "../finance/api";
import { financeKeys } from "../finance/keys";
import { isTransferLike, money, sumTotals } from "../finance/money";
import { useWorkspace } from "../finance/useWorkspace";

export function DashboardPage() {
  const { t } = useTranslation();
  const ws = useWorkspace().data;
  const wsId = ws?.id ?? "";
  const month = ws ? todayInTimeZone(ws.timezone).slice(0, 7) : "";
  const { from, to } = month ? monthRange(month) : { from: "", to: "" };
  // Same keys as the finance pages, so postings there refresh this summary too.
  const accounts = useQuery({ queryKey: financeKeys.accounts(wsId), queryFn: () => fetchAccounts(wsId), enabled: !!ws });
  const totals = useQuery({ queryKey: [...financeKeys.periodTotals(wsId), month], queryFn: () => fetchPeriodTotals(wsId, from, to), enabled: !!ws });
  const feed = useQuery({ queryKey: [...financeKeys.feed(wsId), month], queryFn: () => fetchFeed(wsId, from, to), enabled: !!ws });

  const active = accounts.data?.filter((a) => !a.archived_at) ?? [];
  // Cash on hand: asset accounts only; card balances are debt, not money you have.
  const assetTotal = active.filter((a) => a.kind !== "credit_card").reduce((sum, a) => sum + BigInt(a.balance ?? "0"), 0n);
  const sums = totals.data && sumTotals(totals.data);
  const recent = feed.data?.slice(0, 5) ?? [];

  return (
    <div className="space-y-8">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">{t("dashboard.eyebrow")}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-[34px]">{t("dashboard.title")}</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted">{t("dashboard.subtitle")}</p>
        </div>
        <Link to="/transactions" className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-soft">
          <Plus size={17} aria-hidden="true" />
          {t("dashboard.addTransaction")}
        </Link>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <Summary label={t("dashboard.totalBalance")} icon={Wallet} tone="sage"
          value={accounts.data ? money(assetTotal.toString()) : null}
          detail={accounts.data && active.length === 0 ? t("dashboard.noAccounts") : t("dashboard.totalBalanceHint")} />
        <Summary label={t("dashboard.income")} icon={ArrowDownLeft} tone="blue" value={sums ? money(sums.income.toString()) : null} detail={t("dashboard.thisMonth")} />
        <Summary label={t("dashboard.expense")} icon={ArrowUpRight} tone="yellow" value={sums ? money(sums.expense.toString()) : null} detail={t("dashboard.thisMonth")} />
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="surface-card min-h-[300px]">
          <h2 className="section-title">{t("dashboard.cashFlow")}</h2>
          <div className="grid min-h-[220px] place-items-center text-center">
            <div className="max-w-xs">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-sage/30"><Sparkles size={22} aria-hidden="true" /></div>
              <p className="mt-4 text-xs leading-5 text-muted">{t("dashboard.cashFlowHint")}</p>
            </div>
          </div>
        </div>
        <div className="surface-card min-h-[300px]">
          <h2 className="section-title">{t("dashboard.accounts")}</h2>
          <p className="mt-1 text-xs text-muted">{t("dashboard.accountsHint")}</p>
          {!accounts.data ? (
            <p role="status" className="mt-3 text-sm text-muted">{t(accounts.isError ? "accounts.loadFailed" : "accounts.loading")}</p>
          ) : active.length === 0 ? (
            <div className="grid min-h-[220px] place-items-center text-center">
              <div>
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-blue/25"><Wallet size={22} aria-hidden="true" /></div>
                <p className="mt-4 text-sm font-semibold">{t("dashboard.noAccountsTitle")}</p>
                <Link to="/accounts" className="mt-1 block text-xs text-muted underline">{t("dashboard.noAccounts")}</Link>
              </div>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-[color:var(--line)]">
              {active.map((a) => (
                <li key={a.id} className="flex justify-between gap-3 py-2.5 text-sm">
                  <span>{a.name}</span>
                  <span className="font-semibold tabular-nums">
                    {a.kind === "credit_card" && <span className="mr-1 text-xs font-normal text-muted">{t("accounts.owed")}</span>}
                    {money(a.balance)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
      <section className="surface-card">
        <h2 className="section-title">{t("dashboard.recentTransactions")}</h2>
        <p className="mt-1 text-xs text-muted">{t("dashboard.thisMonth")}</p>
        {!feed.data ? (
          <p role="status" className="mt-3 text-sm text-muted">{t(feed.isError ? "transactions.loadFailed" : "transactions.loading")}</p>
        ) : recent.length === 0 ? (
          <div className="grid min-h-[100px] place-items-center text-center"><p className="text-sm text-muted">{t("dashboard.noTransactions")}</p></div>
        ) : (
          <ul className="mt-3 divide-y divide-[color:var(--line)]">
            {recent.map((r) => (
              <li key={r.id} className="flex justify-between gap-3 py-2.5 text-sm">
                <span>
                  {isTransferLike(r) ? `${r.account_name} → ${r.counter_account_name}` : r.category_name ?? t(`transactions.kinds.${r.kind}`)}
                  {(r.kind === "refund" || r.kind === "reversal") && <span className="ml-1 text-xs text-muted">· {t(`transactions.kinds.${r.kind}`)}</span>}
                  {r.is_reversed && <span className="ml-1 text-xs text-muted">· {t("transactions.badges.reversed")}</span>}
                </span>
                <span className="tabular-nums text-muted">{r.occurred_on} · {money(r.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Summary({ label, icon: Icon, tone, value, detail }: { label: string; icon: LucideIcon; tone: "sage" | "blue" | "yellow"; value: string | null; detail: string }) {
  const bg = tone === "sage" ? "bg-sage/35" : tone === "blue" ? "bg-blue/30" : "bg-yellow/40";
  return (
    <div className="surface-card">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{label}</p>
        <span className={"grid h-9 w-9 place-items-center rounded-xl " + bg}><Icon size={18} aria-hidden="true" /></span>
      </div>
      <p className="mt-5 break-all text-2xl font-bold tabular-nums">{value ?? "—"}</p>
      <p className="mt-2 text-xs text-muted">{detail}</p>
    </div>
  );
}
