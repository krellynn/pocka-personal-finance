import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { todayInTimeZone } from "../../lib/datetime/todayInTimeZone";
import { parseAmountInput } from "../../lib/money/parseAmountInput";
import { Field, ServerError } from "../auth/AuthPages";
import { callLedger, fetchAccounts, fetchCategories, type fetchFeed } from "./api";
import { financeErrorKey } from "./errors";
import { financeKeys, invalidateLedger } from "./keys";
import { money } from "./money";
import { SelectField } from "./ui";
import { useIdempotencyKey } from "./useIdempotencyKey";

type Row = Awaited<ReturnType<typeof fetchFeed>>[number];
type Panel = "refund" | "edit" | "reverse";
type Ctx = { row: Row; workspaceId: string; today: string; close: (saved: boolean) => void; refunded: bigint };

const editable = ["income", "expense", "transfer", "opening_balance"];

/** onSaved: the page announces the save and moves focus, because this row may lose its actions after it. */
export function RowActions({ row, workspaceId, timeZone, onSaved }: { row: Row; workspaceId: string; timeZone: string; onSaved: () => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<Panel | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const kind = row.kind;
  const refunded = BigInt(row.refunded_amount ?? "0");
  const remaining = BigInt(row.amount ?? "0") - refunded;
  const live = kind !== "reversal" && !row.is_reversed;
  const actions: Panel[] = [];
  if (live && kind === "expense" && remaining > 0n) actions.push("refund");
  if (live && editable.includes(kind)) actions.push("edit");
  // An expense with refunds cannot be reversed until its refunds are (HAS_DEPENDENT_REFUNDS).
  if (live && refunded === 0n) actions.push("reverse");
  if (actions.length === 0) return null;

  const close = (didSave: boolean) => {
    setOpen(null);
    if (didSave) onSaved();
    else opener.current?.focus();
  };
  const ctx: Ctx = { row, workspaceId, today: todayInTimeZone(timeZone), close, refunded };

  return (
    <div className="basis-full">
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button
            key={a}
            type="button"
            aria-expanded={open === a}
            onClick={(e) => {
              opener.current = e.currentTarget;
              setOpen(open === a ? null : a);
            }}
            className="rounded-lg border border-[color:var(--field)] px-2.5 py-1 text-xs font-medium"
          >
            {t(`transactions.actions.${a}`)}
          </button>
        ))}
      </div>
      {open === "refund" && <RefundPanel {...ctx} remaining={remaining} />}
      {open === "edit" && <EditPanel {...ctx} />}
      {open === "reverse" && <ReversePanel {...ctx} />}
    </div>
  );
}

/** One ledger call with its own idempotency key; a changed form after a failure is a new request. */
function useLedgerAction(workspaceId: string, close: Ctx["close"]) {
  const idem = useIdempotencyKey();
  const queryClient = useQueryClient();
  const action = useMutation({
    mutationFn: ({ fn, args }: { fn: string; args: Record<string, unknown> }) =>
      callLedger(fn, { p_workspace_id: workspaceId, p_idempotency_key: idem.current(), ...args }),
    onSuccess: () => {
      idem.settle();
      close(true);
      return invalidateLedger(queryClient, workspaceId);
    },
    onError: (error) => idem.settle(error),
  });
  const touched = () => {
    if (action.isError) {
      idem.settle();
      action.reset();
    }
  };
  return { action, touched };
}

function PanelForm({ title, onSubmit, busy, error, submitLabel, onCancel, children }: {
  title: string; onSubmit: () => void; busy: boolean; error: unknown; submitLabel: string; onCancel: () => void; children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <form
      noValidate
      aria-label={title}
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onSubmit();
      }}
      className="mt-2 rounded-xl border border-[color:var(--line)] p-3"
    >
      <fieldset disabled={busy} className="space-y-3">
        <legend className="text-sm font-semibold">{title}</legend>
        {children}
        <ServerError messageKey={error ? financeErrorKey(error) : null} />
        <div className="flex gap-2">
          <button type="submit" className="rounded-lg bg-ink px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {busy ? t("auth.submitting") : submitLabel}
          </button>
          <button type="button" onClick={onCancel} className="rounded-lg border border-[color:var(--field)] px-3 py-2 text-sm">
            {t("transactions.actions.cancel")}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function useActiveAccounts(workspaceId: string) {
  const q = useQuery({ queryKey: financeKeys.accounts(workspaceId), queryFn: () => fetchAccounts(workspaceId) });
  return q.data?.filter((a) => !a.archived_at) ?? [];
}

function RefundPanel({ row, workspaceId, today, close, remaining }: Ctx & { remaining: bigint }) {
  const { t } = useTranslation();
  const accounts = useActiveAccounts(workspaceId);
  const [amount, setAmount] = useState(money(remaining.toString()));
  const [picked, setAccountId] = useState<string | null>(null);
  // Default to the original account (Q12) only while it is still active; otherwise make the user pick.
  const accountId = picked ?? (accounts.some((a) => a.id === row.account_id) ? row.account_id ?? "" : "");
  const [date, setDate] = useState(today);
  const [invalid, setInvalid] = useState<string | null>(null);
  const { action, touched } = useLedgerAction(workspaceId, close);
  const change = (set: (v: string) => void) => (e: { target: { value: string } }) => {
    touched();
    setInvalid(null);
    set(e.target.value);
  };

  const submit = () => {
    const parsed = parseAmountInput(amount);
    if (parsed === null || BigInt(parsed) > remaining) return setInvalid("transactions.validation.refundAmount");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) return setInvalid("transactions.validation.date");
    if (!accountId) return setInvalid("transactions.validation.account");
    action.mutate({
      fn: "post_refund",
      // Q12: the server defaults to the original's account; send one only when it differs.
      args: { p_refund_of_id: row.id, p_amount: parsed, p_occurred_on: date, ...(accountId !== row.account_id && { p_account_id: accountId }) },
    });
  };

  return (
    <PanelForm title={t("transactions.actions.refundTitle")} onSubmit={submit} busy={action.isPending} error={action.error}
      submitLabel={t("transactions.actions.refundSubmit")} onCancel={() => close(false)}>
      <Field label={t("transactions.fields.amount")} inputMode="numeric" autoFocus value={amount} onChange={change(setAmount)}
        hint={t("transactions.actions.refundHint", { amount: money(remaining.toString()) })}
        error={invalid === "transactions.validation.refundAmount" ? t(invalid) : undefined} />
      <SelectField label={t("transactions.actions.refundTo")} value={accountId} onChange={change(setAccountId)}
        error={invalid === "transactions.validation.account" ? t(invalid) : undefined}>
        <option value="">{t("transactions.pick")}</option>
        {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </SelectField>
      <Field label={t("transactions.fields.date")} type="date" max={today} value={date} onChange={change(setDate)}
        error={invalid === "transactions.validation.date" ? t(invalid) : undefined} />
    </PanelForm>
  );
}

function EditPanel({ row, workspaceId, today, close, refunded }: Ctx) {
  const { t } = useTranslation();
  const categories = useQuery({ queryKey: financeKeys.categories(workspaceId), queryFn: () => fetchCategories(workspaceId), staleTime: 5 * 60_000 });
  // Opening balances may be negative (Q13), so they are edited by their signed amount.
  const opening = row.kind === "opening_balance";
  const current = opening ? row.signed_amount : row.amount;
  // Amount/date changes on a refunded expense are refused (HAS_DEPENDENT_REFUNDS).
  const fixedDate = refunded > 0n;
  const original = { amount: money(current), date: row.occurred_on, categoryId: row.category_id ?? "", note: row.note ?? "" };
  const [v, setV] = useState(original);
  const [invalid, setInvalid] = useState<string | null>(null);
  const { action, touched } = useLedgerAction(workspaceId, close);
  const set = (key: keyof typeof original) => (e: { target: { value: string } }) => {
    touched();
    setInvalid(null);
    setV({ ...v, [key]: e.target.value });
  };
  const withCategory = row.kind === "income" || row.kind === "expense";
  const pick = categories.data?.filter((c) => c.kind === row.kind && (!c.archived_at || c.id === row.category_id)) ?? [];

  const submit = () => {
    const args: Record<string, unknown> = { p_transaction_id: row.id };
    // Only changed fields go out: the RPC treats a missing value as "keep" (opening balances keep their sign).
    if (v.amount !== original.amount) {
      const parsed = parseAmountInput(v.amount, { allowNegative: opening });
      if (parsed === null) return setInvalid(opening ? "transactions.validation.openingAmount" : "transactions.validation.amount");
      if (parsed !== current) args.p_amount = parsed;
    }
    if (v.date !== original.date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date) || v.date > today) return setInvalid("transactions.validation.date");
      args.p_occurred_on = v.date;
    }
    if (withCategory && v.categoryId !== original.categoryId) args.p_category_id = v.categoryId;
    if (v.note !== original.note) args.p_note = v.note; // "" clears the note
    if (v.note.length > 500) return setInvalid("transactions.validation.note");
    if (Object.keys(args).length === 1) return close(false);
    action.mutate({ fn: "edit_transaction", args });
  };

  return (
    <PanelForm title={t("transactions.actions.editTitle")} onSubmit={submit} busy={action.isPending} error={action.error}
      submitLabel={t("transactions.actions.editSubmit")} onCancel={() => close(false)}>
      <p className="text-xs text-muted">
        {t(fixedDate ? "transactions.actions.editRefundedHint" : "transactions.actions.editHint")}
      </p>
      {!fixedDate && (
        <Field label={t("transactions.fields.amount")} inputMode="numeric" autoFocus value={v.amount} onChange={set("amount")}
          error={invalid === "transactions.validation.amount" || invalid === "transactions.validation.openingAmount" ? t(invalid) : undefined} />
      )}
      {!fixedDate && (
        <Field label={t("transactions.fields.date")} type="date" max={today} value={v.date} onChange={set("date")}
          error={invalid === "transactions.validation.date" ? t(invalid) : undefined} />
      )}
      {withCategory && (
        <SelectField label={t("transactions.fields.category")} value={v.categoryId} onChange={set("categoryId")}>
          {pick.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
      )}
      <Field label={t("transactions.fields.note")} maxLength={500} value={v.note} onChange={set("note")}
        error={invalid === "transactions.validation.note" ? t(invalid) : undefined} />
    </PanelForm>
  );
}

function ReversePanel({ row, workspaceId, close }: Ctx) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");
  const { action, touched } = useLedgerAction(workspaceId, close);
  return (
    <PanelForm title={t("transactions.actions.reverseTitle")} busy={action.isPending} error={action.error}
      submitLabel={t("transactions.actions.reverseSubmit")} onCancel={() => close(false)}
      onSubmit={() => action.mutate({ fn: "reverse_transaction", args: { p_transaction_id: row.id, p_reason: reason.trim() || null } })}>
      <p className="text-xs text-muted">{t("transactions.actions.reverseHint")}</p>
      <Field label={t("transactions.actions.reason")} maxLength={200} autoFocus value={reason}
        onChange={(e) => {
          touched();
          setReason(e.target.value);
        }} />
    </PanelForm>
  );
}
