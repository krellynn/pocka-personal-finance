import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { todayInTimeZone } from "../../lib/datetime/todayInTimeZone";
import { parseAmountInput } from "../../lib/money/parseAmountInput";
import { Field, ServerError, Submit } from "../auth/AuthPages";
import { copyBudgets, fetchBudgetVsActual, fetchCategories, setBudget } from "./api";
import { financeErrorKey } from "./errors";
import { financeKeys } from "./keys";
import { money } from "./money";
import { SelectField } from "./ui";
import { useWorkspace } from "./useWorkspace";

type Row = Awaited<ReturnType<typeof fetchBudgetVsActual>>[number];

/** "YYYY-MM" of the month before. */
const previousMonth = (month: string) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
};
const sum = (rows: Row[], pick: (r: Row) => string | null) => rows.reduce((acc, r) => acc + BigInt(pick(r) ?? "0"), 0n).toString();

export function BudgetsPage() {
  const { t } = useTranslation();
  const ws = useWorkspace().data;
  return (
    <section className="max-w-3xl space-y-5">
      <h1 className="text-3xl font-bold tracking-tight">{t("nav.budgets")}</h1>
      {ws && <MonthBudgets workspaceId={ws.id} timeZone={ws.timezone} />}
    </section>
  );
}

function MonthBudgets({ workspaceId, timeZone }: { workspaceId: string; timeZone: string }) {
  const { t } = useTranslation();
  const monthId = useId();
  const [month, setMonth] = useState(todayInTimeZone(timeZone).slice(0, 7));
  const first = `${month}-01`;
  const queryClient = useQueryClient();
  const rows = useQuery({ queryKey: [...financeKeys.budgets(workspaceId), month], queryFn: () => fetchBudgetVsActual(workspaceId, first) });
  const copy = useMutation({
    mutationFn: () => copyBudgets(workspaceId, `${previousMonth(month)}-01`, first),
    onSettled: () => queryClient.invalidateQueries({ queryKey: financeKeys.budgets(workspaceId) }),
  });

  const data = rows.data ?? [];
  const budgeted = data.filter((r) => r.has_budget);
  const unbudgeted = data.filter((r) => !r.has_budget);

  return (
    <>
      <div className="surface-card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="section-title">{t("budgets.listTitle")}</h2>
          <div>
            <label htmlFor={monthId} className="text-sm font-medium">{t("budgets.month")}</label>
            <input
              id={monthId}
              type="month"
              value={month}
              onChange={(e) => {
                if (/^\d{4}-\d{2}$/.test(e.target.value)) {
                  setMonth(e.target.value);
                  copy.reset();
                }
              }}
              className="ml-2 rounded-xl border border-[color:var(--field)] px-3 py-2 text-sm"
            />
          </div>
        </div>
        <p role="status" className="mt-2 text-sm text-muted">
          {rows.isPending ? t("budgets.loading") : rows.isError ? t("budgets.loadFailed")
            : copy.isSuccess ? t(copy.data === 0 ? "budgets.copiedNone" : "budgets.copied", { count: copy.data })
            : data.length === 0 ? t("budgets.empty") : ""}
        </p>
        <ServerError messageKey={copy.isError ? financeErrorKey(copy.error) : null} />
        {data.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th scope="col" className="py-2 font-medium">{t("budgets.cols.category")}</th>
                  <th scope="col" className="py-2 text-right font-medium">{t("budgets.cols.planned")}</th>
                  <th scope="col" className="py-2 text-right font-medium">{t("budgets.cols.actual")}</th>
                  <th scope="col" className="py-2 text-right font-medium">{t("budgets.cols.remaining")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--line)]">
                {budgeted.map((r) => <BudgetRow key={r.category_id} row={r} />)}
              </tbody>
              {unbudgeted.length > 0 && (
                <tbody className="divide-y divide-[color:var(--line)]">
                  <tr>
                    <th scope="rowgroup" colSpan={4} className="pt-4 pb-1 text-left text-xs font-semibold text-muted">{t("budgets.unbudgeted")}</th>
                  </tr>
                  {unbudgeted.map((r) => <BudgetRow key={r.category_id} row={r} />)}
                </tbody>
              )}
              <tfoot>
                <tr className="border-t border-[color:var(--line)] font-semibold">
                  <th scope="row" className="py-2 text-left">{t("budgets.total")}</th>
                  <td className="py-2 text-right tabular-nums">{money(sum(budgeted, (r) => r.planned))}</td>
                  <td className="py-2 text-right tabular-nums">{money(sum(data, (r) => r.actual))}</td>
                  <td className="py-2 text-right tabular-nums">{money(sum(budgeted, (r) => r.remaining))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <button
          type="button"
          onClick={() => copy.mutate()}
          disabled={copy.isPending}
          className="mt-4 rounded-lg border border-[color:var(--field)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {t("budgets.copy")}
        </button>
      </div>
      <SetBudgetForm key={month} workspaceId={workspaceId} month={first} archivedBudgeted={new Set(budgeted.filter((r) => r.category_archived).map((r) => r.category_id))} />
    </>
  );
}

function BudgetRow({ row }: { row: Row }) {
  const { t } = useTranslation();
  return (
    <tr>
      <th scope="row" className="py-2 text-left font-medium">
        {row.category_name}
        {row.category_archived && <span className="ml-1 text-xs font-normal text-muted">({t("budgets.archived")})</span>}
        {row.is_over && <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-800">{t("budgets.over")}</span>}
      </th>
      <td className="py-2 text-right tabular-nums">{row.has_budget ? money(row.planned) : "–"}</td>
      <td className="py-2 text-right tabular-nums">{money(row.actual)}</td>
      <td className={`py-2 text-right tabular-nums ${row.is_over ? "text-red-700" : ""}`}>{row.has_budget ? money(row.remaining) : "–"}</td>
    </tr>
  );
}

const schema = z.object({
  category: z.string().min(1, "budgets.validation.category"),
  amount: z.string().refine((v) => parseAmountInput(v, { allowZero: true }) !== null, "budgets.validation.amount"),
});
type Values = z.infer<typeof schema>;
const defaultValues: Values = { category: "", amount: "" };

function SetBudgetForm({ workspaceId, month, archivedBudgeted }: { workspaceId: string; month: string; archivedBudgeted: Set<string> }) {
  const { t } = useTranslation();
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: financeKeys.categories(workspaceId), queryFn: () => fetchCategories(workspaceId) });
  // Archived categories are listed only while they still hold a plan this month, so it can be removed with 0.
  const expense = categories.data?.filter((c) => c.kind === "expense" && (!c.archived_at || archivedBudgeted.has(c.id))) ?? [];
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues });
  // set_budget is an absolute upsert, so a retry needs no idempotency key.
  const save = useMutation({
    mutationFn: (v: Values) => setBudget(workspaceId, month, v.category, parseAmountInput(v.amount, { allowZero: true })!),
    onSuccess: () => {
      setSaved(true);
      form.reset(defaultValues);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: financeKeys.budgets(workspaceId) }),
  });
  const onEdit = () => {
    setSaved(false);
    if (save.isError) save.reset();
  };
  const err = (name: keyof Values) => {
    const m = form.formState.errors[name]?.message;
    return m ? t(m) : undefined;
  };

  return (
    <div className="surface-card">
      <h2 className="section-title">{t("budgets.editTitle")}</h2>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate className="mt-4 space-y-4">
        <SelectField label={t("budgets.fields.category")} error={err("category")} {...form.register("category", { onChange: onEdit })}>
          <option value="">{t("budgets.choose")}</option>
          {expense.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
        <Field
          label={t("budgets.fields.amount")}
          hint={t("budgets.amountHint")}
          inputMode="numeric"
          placeholder="Rp0"
          error={err("amount")}
          {...form.register("amount", {
            onChange: onEdit,
            onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
              const parsed = parseAmountInput(e.target.value, { allowZero: true });
              if (parsed !== null) form.setValue("amount", money(parsed));
            },
          })}
        />
        <ServerError messageKey={save.isError ? financeErrorKey(save.error) : null} />
        <p role="status" className="text-sm text-muted">{saved ? t("budgets.saved") : ""}</p>
        <Submit busy={save.isPending}>{t("budgets.submit")}</Submit>
      </form>
    </div>
  );
}
