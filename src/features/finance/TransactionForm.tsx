import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { todayInTimeZone } from "../../lib/datetime/todayInTimeZone";
import { parseAmountInput } from "../../lib/money/parseAmountInput";
import { Field, ServerError, Submit } from "../auth/AuthPages";
import { callLedger, fetchAccounts, fetchCategories } from "./api";
import { financeErrorKey } from "./errors";
import { financeKeys, invalidateLedger } from "./keys";
import { money } from "./money";
import { SelectField } from "./ui";
import { useIdempotencyKey } from "./useIdempotencyKey";

const kinds = ["expense", "income", "transfer"] as const;

// Mirrors the server rules (posting_rpcs.sql) so VALIDATION_FAILED stays rare.
const schema = (today: string) =>
  z
    .object({
      kind: z.enum(kinds),
      accountId: z.string().min(1, "transactions.validation.account"),
      counterId: z.string(),
      categoryId: z.string(),
      amount: z.string().refine((v) => parseAmountInput(v) !== null, "transactions.validation.amount"),
      occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "transactions.validation.date").refine((d) => d <= today, "transactions.validation.date"),
      note: z.string().max(500, "transactions.validation.note"),
    })
    .superRefine((v, ctx) => {
      if (v.kind === "transfer") {
        if (!v.counterId) ctx.addIssue({ code: "custom", path: ["counterId"], message: "transactions.validation.account" });
        else if (v.counterId === v.accountId) ctx.addIssue({ code: "custom", path: ["counterId"], message: "transactions.validation.sameAccount" });
      } else if (!v.categoryId) {
        ctx.addIssue({ code: "custom", path: ["categoryId"], message: "transactions.validation.category" });
      }
    });
type Values = z.infer<ReturnType<typeof schema>>;

function toRpc(workspaceId: string, key: string, v: Values): [string, Record<string, unknown>] {
  const common = { p_workspace_id: workspaceId, p_idempotency_key: key, p_amount: parseAmountInput(v.amount), p_occurred_on: v.occurredOn, p_note: v.note.trim() || null };
  if (v.kind === "transfer") return ["post_transfer", { ...common, p_from_account_id: v.accountId, p_to_account_id: v.counterId }];
  return [v.kind === "income" ? "post_income" : "post_expense", { ...common, p_account_id: v.accountId, p_category_id: v.categoryId }];
}

export function TransactionForm({ workspaceId, timeZone }: { workspaceId: string; timeZone: string }) {
  const { t } = useTranslation();
  const today = todayInTimeZone(timeZone);
  const [saved, setSaved] = useState(false);
  const idem = useIdempotencyKey();
  const queryClient = useQueryClient();
  const accounts = useQuery({ queryKey: financeKeys.accounts(workspaceId), queryFn: () => fetchAccounts(workspaceId) });
  const categories = useQuery({ queryKey: financeKeys.categories(workspaceId), queryFn: () => fetchCategories(workspaceId), staleTime: 5 * 60_000 });
  const defaultValues: Values = { kind: "expense", accountId: "", counterId: "", categoryId: "", amount: "", occurredOn: today, note: "" };
  const form = useForm<Values>({ resolver: zodResolver(schema(today)), defaultValues });
  const kind = form.watch("kind");
  const accountId = form.watch("accountId");

  const save = useMutation({
    mutationFn: (v: Values) => callLedger(...toRpc(workspaceId, idem.current(), v)),
    onSuccess: () => {
      idem.settle();
      setSaved(true);
      form.reset({ ...defaultValues, kind: form.getValues("kind"), accountId: form.getValues("accountId") });
      return invalidateLedger(queryClient, workspaceId);
    },
    onError: (error) => idem.settle(error),
  });
  // A changed form after a failed or in-flight save is a new request, never a retry of the old one.
  const onEdit = () => {
    setSaved(false);
    if (save.isError || save.isPending) {
      idem.settle();
      if (save.isError) save.reset();
    }
  };
  const err = (name: keyof Values) => {
    const m = form.formState.errors[name]?.message;
    return m ? t(m) : undefined;
  };

  const active = accounts.data?.filter((a) => !a.archived_at) ?? [];
  // Income and transfers out need an asset account; a card cash advance is not supported yet (Q11).
  const sourceAccounts = kind === "expense" ? active : active.filter((a) => a.kind !== "credit_card");
  const pickCategories = categories.data?.filter((c) => !c.archived_at && c.kind === kind) ?? [];
  const reg = (name: keyof Values) => form.register(name, { onChange: onEdit });

  return (
    <div className="surface-card">
      <h2 className="section-title">{t("transactions.createTitle")}</h2>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate className="mt-4">
        {/* Locked while saving, so a reset after success never wipes newer input. */}
        <fieldset disabled={save.isPending} className="space-y-4">
        <fieldset>
          <legend className="text-sm font-medium">{t("transactions.fields.kind")}</legend>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {kinds.map((k) => (
              <label key={k} className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[color:var(--field)] px-3 py-2 text-sm has-[:checked]:border-[color:var(--focus)] has-[:checked]:font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[color:var(--focus)]">
                <input
                  type="radio"
                  value={k}
                  className="sr-only"
                  {...form.register("kind", {
                    onChange: () => {
                      onEdit();
                      form.setValue("categoryId", "");
                      form.setValue("counterId", "");
                      // A card picked for an expense is not allowed as the source of income or a transfer.
                      if (k !== "expense" && active.find((a) => a.id === form.getValues("accountId"))?.kind === "credit_card") {
                        form.setValue("accountId", "");
                      }
                    },
                  })}
                />
                {t(`transactions.kinds.${k}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <SelectField label={t(kind === "transfer" ? "transactions.fields.from" : "transactions.fields.account")} error={err("accountId")} {...reg("accountId")}>
          <option value="">{t("transactions.pick")}</option>
          {sourceAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </SelectField>
        {kind === "transfer" ? (
          <SelectField label={t("transactions.fields.to")} error={err("counterId")} {...reg("counterId")}>
            <option value="">{t("transactions.pick")}</option>
            {active.filter((a) => a.id !== accountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </SelectField>
        ) : (
          <SelectField label={t("transactions.fields.category")} error={err("categoryId")} {...reg("categoryId")}>
            <option value="">{t("transactions.pick")}</option>
            {pickCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </SelectField>
        )}
        <Field
          label={t("transactions.fields.amount")}
          inputMode="numeric"
          placeholder="Rp0"
          error={err("amount")}
          {...form.register("amount", {
            onChange: onEdit,
            onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
              const parsed = parseAmountInput(e.target.value);
              if (parsed !== null) form.setValue("amount", money(parsed));
            },
          })}
        />
        <Field label={t("transactions.fields.date")} type="date" max={today} error={err("occurredOn")} {...reg("occurredOn")} />
        <Field label={t("transactions.fields.note")} maxLength={500} error={err("note")} {...reg("note")} />
        {active.length === 0 && accounts.isSuccess && <p className="text-sm text-muted">{t("transactions.noAccounts")}</p>}
        <ServerError messageKey={save.isError ? financeErrorKey(save.error) : null} />
        <p role="status" className="text-sm text-muted">{saved ? t("transactions.saved") : ""}</p>
        <Submit busy={save.isPending}>{t("transactions.submit")}</Submit>
        </fieldset>
      </form>
    </div>
  );
}
