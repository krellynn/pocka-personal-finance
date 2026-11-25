import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { todayInTimeZone } from "../../lib/datetime/todayInTimeZone";
import { fetchPocketMovements, MOVEMENTS_LIMIT } from "./api";
import { financeKeys } from "./keys";
import { money } from "./money";

/** Latest movements across all pockets; a null side is "Belum dialokasikan". */
export function PocketHistory({ workspaceId, timeZone, names }: { workspaceId: string; timeZone: string; names: Map<string, string> }) {
  const { t } = useTranslation();
  const movements = useQuery({ queryKey: [...financeKeys.pockets(workspaceId), "movements"], queryFn: () => fetchPocketMovements(workspaceId) });
  const label = (id: string | null) => (id ? names.get(id) ?? "?" : t("pockets.history.unallocated"));
  const rows = movements.data ?? [];

  return (
    <div className="surface-card">
      <h2 className="section-title">{t("pockets.history.title")}</h2>
      <p role="status" className="text-sm text-muted">
        {movements.isPending ? t("pockets.loading") : movements.isError ? t("pockets.history.loadFailed")
          : rows.length === 0 ? t("pockets.history.empty")
          : rows.length === MOVEMENTS_LIMIT ? t("pockets.history.limited", { count: MOVEMENTS_LIMIT }) : ""}
      </p>
      <ul className="mt-3 divide-y divide-[color:var(--line)]">
        {rows.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div>
              <p className="font-medium">{t("pockets.history.route", { from: label(m.from_pocket_id), to: label(m.to_pocket_id) })}</p>
              <p className="text-xs text-muted">
                {todayInTimeZone(timeZone, new Date(m.created_at))}
                {m.note ? ` · ${m.note}` : ""}
              </p>
            </div>
            <p className="text-right font-semibold tabular-nums">{money(m.amount)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
