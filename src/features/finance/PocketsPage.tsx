import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ServerError } from "../auth/AuthPages";
import { fetchPockets, fetchPocketSummary } from "./api";
import { financeKeys } from "./keys";
import { money } from "./money";
import { useWorkspace } from "./useWorkspace";

type Pocket = Awaited<ReturnType<typeof fetchPockets>>[number];

export function PocketsPage() {
  const { t } = useTranslation();
  const ws = useWorkspace().data;
  const enabled = !!ws;
  const pockets = useQuery({ queryKey: [...financeKeys.pockets(ws?.id ?? ""), "list"], queryFn: () => fetchPockets(ws!.id), enabled });
  const summary = useQuery({ queryKey: [...financeKeys.pockets(ws?.id ?? ""), "summary"], queryFn: () => fetchPocketSummary(ws!.id), enabled });

  const active = pockets.data?.filter((p) => !p.archived_at) ?? [];
  const archived = pockets.data?.filter((p) => p.archived_at) ?? [];
  const s = summary.data;

  return (
    <section className="max-w-3xl space-y-5">
      <h1 className="text-3xl font-bold tracking-tight">{t("nav.pockets")}</h1>
      <div className="surface-card">
        <h2 className="section-title">{t("pockets.summaryTitle")}</h2>
        <ServerError messageKey={summary.isError ? "pockets.loadFailed" : null} />
        {summary.isPending && <p role="status" className="text-sm text-muted">{t("pockets.loading")}</p>}
        {s && (
          <>
            <dl className="mt-3 grid gap-3 sm:grid-cols-3">
              <Stat label={t("pockets.eligible")} value={s.eligible_funds} hint={t("pockets.eligibleHint")} />
              <Stat label={t("pockets.allocated")} value={s.allocated} />
              <Stat label={t("pockets.unallocated")} value={s.unallocated} warn={!!s.is_shortfall} />
            </dl>
            <div className="mt-3"><ServerError messageKey={s.is_shortfall ? "pockets.shortfall" : null} /></div>
          </>
        )}
      </div>
      <div className="surface-card">
        <h2 className="section-title">{t("pockets.listTitle")}</h2>
        <p role="status" className="text-sm text-muted">
          {pockets.isPending ? t("pockets.loading") : pockets.isError ? t("pockets.loadFailed") : active.length === 0 ? t("pockets.empty") : ""}
        </p>
        <ul className="mt-3 divide-y divide-[color:var(--line)]">
          {active.map((p) => <PocketRow key={p.id} pocket={p} />)}
        </ul>
        {archived.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">{t("pockets.archivedTitle", { count: archived.length })}</summary>
            <ul className="mt-2 divide-y divide-[color:var(--line)]">
              {archived.map((p) => <PocketRow key={p.id} pocket={p} />)}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value, hint, warn }: { label: string; value: string | null; hint?: string; warn?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`text-lg font-semibold tabular-nums ${warn ? "text-red-700" : ""}`}>{money(value ?? "0")}</dd>
      {hint && <dd className="text-xs text-muted">{hint}</dd>}
    </div>
  );
}

function PocketRow({ pocket }: { pocket: Pocket }) {
  const { t } = useTranslation();
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div>
        <p className="font-medium">{pocket.name}</p>
        {pocket.target_amount && <p className="text-xs text-muted">{t("pockets.target", { amount: money(pocket.target_amount) })}</p>}
      </div>
      <p className="text-right font-semibold tabular-nums">{money(pocket.balance ?? "0")}</p>
    </li>
  );
}
