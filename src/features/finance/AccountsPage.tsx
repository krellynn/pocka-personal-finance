import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { todayInTimeZone } from "../../lib/datetime/todayInTimeZone";
import { formatMinorUnits } from "../../lib/money/formatMinorUnits";
import { parseAmountInput } from "../../lib/money/parseAmountInput";
import { Field, ServerError, Submit } from "../auth/AuthPages";
import { callLedger, fetchAccounts } from "./api";
import { financeErrorKey } from "./errors";
import { financeKeys } from "./keys";
import { useIdempotencyKey } from "./useIdempotencyKey";
import { useWorkspace } from "./useWorkspace";

const kinds = ["cash", "bank", "ewallet", "credit_card"] as const;
type Account = Awaited<ReturnType<typeof fetchAccounts>>[number];

// A duplicate name is VALIDATION_FAILED with the fixed detail "name taken" (create_financial_account).
const createErrorKey = (error: unknown) =>
  typeof error === "object" && error !== null && "details" in error && error.details === "name taken"
    ? "accounts.validation.nameTaken"
    : financeErrorKey(error);

const money = (amount: string | null) => formatMinorUnits(BigInt(amount ?? "0"), { code: "IDR", minorUnits: 0 });

export function AccountsPage() {
  const { t } = useTranslation();
  const ws = useWorkspace().data;
  const accounts = useQuery({ queryKey: financeKeys.accounts(ws?.id ?? ""), queryFn: () => fetchAccounts(ws!.id), enabled: !!ws });
  const queryClient = useQueryClient();
  const listHeading = useRef<HTMLHeadingElement>(null);
  const archive = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      callLedger("set_financial_account_archived", { p_workspace_id: ws!.id, p_account_id: id, p_archived: archived }),
    onSuccess: () => listHeading.current?.focus(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: financeKeys.accounts(ws!.id) }),
  });

  const active = accounts.data?.filter((a) => !a.archived_at) ?? [];
  const archived = accounts.data?.filter((a) => a.archived_at) ?? [];

  return (
    <section className="max-w-3xl space-y-5">
      <h1 className="text-3xl font-bold tracking-tight">{t("nav.accounts")}</h1>
      <div className="surface-card">
        <h2 ref={listHeading} tabIndex={-1} className="section-title outline-none">{t("accounts.listTitle")}</h2>
        <p role="status" className="text-sm text-muted">
          {accounts.isPending ? t("accounts.loading") : accounts.isError ? t("accounts.loadFailed")
            : archive.isSuccess ? t(archive.variables.archived ? "accounts.archivedDone" : "accounts.unarchivedDone")
            : active.length === 0 ? t("accounts.empty") : ""}
        </p>
        <ServerError messageKey={archive.isError ? financeErrorKey(archive.error) : null} />
        <ul className="mt-3 divide-y divide-[color:var(--line)]">
          {active.map((a) => (
            <AccountRow key={a.id} account={a} busy={archive.isPending} onToggle={() => archive.mutate({ id: a.id, archived: true })} />
          ))}
        </ul>
        {archived.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">{t("accounts.archivedTitle", { count: archived.length })}</summary>
            <ul className="mt-2 divide-y divide-[color:var(--line)]">
              {archived.map((a) => (
                <AccountRow key={a.id} account={a} busy={archive.isPending} onToggle={() => archive.mutate({ id: a.id, archived: false })} />
              ))}
            </ul>
          </details>
        )}
      </div>
      {ws && <CreateAccountForm workspaceId={ws.id} timeZone={ws.timezone} />}
    </section>
  );
}

function AccountRow({ account, busy, onToggle }: { account: Account; busy: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const hintId = useId();
  const isArchived = !!account.archived_at;
  const blocked = !isArchived && account.balance !== "0";
  const label = isArchived ? t("accounts.unarchive") : t("accounts.archive");
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div>
        <p className="font-medium">{account.name}</p>
        <p className="text-xs text-muted">{t(`accounts.kinds.${account.kind}`)}</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        <p className="text-right font-semibold tabular-nums">
          {account.kind === "credit_card" && <span className="mr-1 text-xs font-normal text-muted">{t("accounts.owed")}</span>}
          {money(account.balance)}
        </p>
        <button
          type="button"
          onClick={onToggle}
          disabled={busy || blocked}
          aria-label={`${label} ${account.name}`}
          aria-describedby={blocked ? hintId : undefined}
          className="rounded-lg border border-[color:var(--field)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {label}
        </button>
        {blocked && <span id={hintId} className="basis-full text-right text-xs text-muted">{t("accounts.archiveBlocked")}</span>}
      </div>
    </li>
  );
}

const schema = (today: string) =>
  z.object({
    kind: z.enum(kinds),
    name: z.string().trim().min(1, "accounts.validation.name").max(80, "accounts.validation.name"),
    openingBalance: z.string().refine((v) => v.trim() === "" || parseAmountInput(v, { allowNegative: true, allowZero: true }) !== null, "accounts.validation.amount"),
    openedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "accounts.validation.date").refine((d) => d <= today, "accounts.validation.date"),
  });
type Values = z.infer<ReturnType<typeof schema>>;

function CreateAccountForm({ workspaceId, timeZone }: { workspaceId: string; timeZone: string }) {
  const { t } = useTranslation();
  const kindId = useId();
  const today = todayInTimeZone(timeZone);
  const [saved, setSaved] = useState(false);
  const idem = useIdempotencyKey();
  const queryClient = useQueryClient();
  const defaultValues: Values = { kind: "bank", name: "", openingBalance: "", openedOn: today };
  const form = useForm<Values>({ resolver: zodResolver(schema(today)), defaultValues });
  const create = useMutation({
    mutationFn: (v: Values) =>
      callLedger("create_financial_account", {
        p_workspace_id: workspaceId,
        p_idempotency_key: idem.current(),
        p_kind: v.kind,
        p_name: v.name,
        p_opening_balance: v.openingBalance.trim() === "" ? "0" : parseAmountInput(v.openingBalance, { allowNegative: true, allowZero: true }),
        p_opened_on: v.openedOn,
      }),
    onSuccess: () => {
      idem.settle();
      setSaved(true);
      form.reset(defaultValues);
      return queryClient.invalidateQueries({ queryKey: financeKeys.accounts(workspaceId) });
    },
    onError: (error) => idem.settle(error),
  });
  // A changed form after a failed save is a new request, never a retry of the old one.
  const onEdit = () => {
    setSaved(false);
    if (create.isError || create.isPending) {
      idem.settle();
      if (create.isError) create.reset();
    }
  };
  const err = (name: keyof Values) => {
    const m = form.formState.errors[name]?.message;
    return m ? t(m) : undefined;
  };

  return (
    <div className="surface-card">
      <h2 className="section-title">{t("accounts.createTitle")}</h2>
      <form onSubmit={form.handleSubmit((v) => create.mutate(v))} noValidate className="mt-4 space-y-4">
        <div>
          <label htmlFor={kindId} className="text-sm font-medium">{t("accounts.fields.kind")}</label>
          <select
            id={kindId}
            className="mt-1.5 w-full rounded-xl border border-[color:var(--field)] bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-[color:var(--focus)] focus:ring-2 focus:ring-[color:var(--focus)]"
            {...form.register("kind", { onChange: onEdit })}
          >
            {kinds.map((k) => <option key={k} value={k}>{t(`accounts.kinds.${k}`)}</option>)}
          </select>
        </div>
        <Field label={t("accounts.fields.name")} error={err("name")} {...form.register("name", { onChange: onEdit })} />
        <Field
          label={t("accounts.fields.openingBalance")}
          hint={t("accounts.fields.openingHint")}
          inputMode="numeric"
          placeholder="Rp0"
          error={err("openingBalance")}
          {...form.register("openingBalance", {
            onChange: onEdit,
            onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
              const parsed = parseAmountInput(e.target.value, { allowNegative: true, allowZero: true });
              if (parsed !== null) form.setValue("openingBalance", money(parsed));
            },
          })}
        />
        <Field label={t("accounts.fields.openedOn")} type="date" max={today} error={err("openedOn")} {...form.register("openedOn", { onChange: onEdit })} />
        <ServerError messageKey={create.isError ? createErrorKey(create.error) : null} />
        <p role="status" className="text-sm text-muted">{saved ? t("accounts.created") : ""}</p>
        <Submit busy={create.isPending}>{t("accounts.submit")}</Submit>
      </form>
    </div>
  );
}
