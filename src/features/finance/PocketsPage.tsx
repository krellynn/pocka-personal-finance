import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { parseAmountInput } from "../../lib/money/parseAmountInput";
import { Field, ServerError, Submit } from "../auth/AuthPages";
import { callLedger, fetchPockets, fetchPocketSummary } from "./api";
import { nameTakenOr } from "./errors";
import { financeKeys } from "./keys";
import { money } from "./money";
import { useIdempotencyKey } from "./useIdempotencyKey";
import { useWorkspace } from "./useWorkspace";

type Pocket = Awaited<ReturnType<typeof fetchPockets>>[number];

export function PocketsPage() {
  const { t } = useTranslation();
  const ws = useWorkspace().data;
  const enabled = !!ws;
  const pockets = useQuery({ queryKey: [...financeKeys.pockets(ws?.id ?? ""), "list"], queryFn: () => fetchPockets(ws!.id), enabled });
  const summary = useQuery({ queryKey: [...financeKeys.pockets(ws?.id ?? ""), "summary"], queryFn: () => fetchPocketSummary(ws!.id), enabled });
  const queryClient = useQueryClient();
  const listHeading = useRef<HTMLHeadingElement>(null);
  const archive = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      callLedger("set_pocket_archived", { p_workspace_id: ws!.id, p_pocket_id: id, p_archived: archived }),
    onSuccess: () => listHeading.current?.focus(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: financeKeys.pockets(ws!.id) }),
  });

  const active = pockets.data?.filter((p) => !p.archived_at) ?? [];
  const archived = pockets.data?.filter((p) => p.archived_at) ?? [];
  const s = summary.data;
  const row = (p: Pocket) => (
    <PocketRow key={p.id} pocket={p} busy={archive.isPending} onToggle={() => archive.mutate({ id: p.id, archived: !p.archived_at })} />
  );

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
        <h2 ref={listHeading} tabIndex={-1} className="section-title outline-none">{t("pockets.listTitle")}</h2>
        <p role="status" className="text-sm text-muted">
          {pockets.isPending ? t("pockets.loading") : pockets.isError ? t("pockets.loadFailed")
            : archive.isSuccess ? t(archive.variables.archived ? "pockets.archivedDone" : "pockets.unarchivedDone")
            : active.length === 0 ? t("pockets.empty") : ""}
        </p>
        <ServerError messageKey={archive.isError ? nameTakenOr(archive.error, "pockets.validation.nameTaken") : null} />
        <ul className="mt-3 divide-y divide-[color:var(--line)]">{active.map(row)}</ul>
        {archived.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium">{t("pockets.archivedTitle", { count: archived.length })}</summary>
            <ul className="mt-2 divide-y divide-[color:var(--line)]">{archived.map(row)}</ul>
          </details>
        )}
      </div>
      {ws && <CreatePocketForm workspaceId={ws.id} />}
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

function PocketRow({ pocket, busy, onToggle }: { pocket: Pocket; busy: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  const hintId = useId();
  const isArchived = !!pocket.archived_at;
  const blocked = !isArchived && (pocket.balance ?? "0") !== "0";
  const label = isArchived ? t("pockets.unarchive") : t("pockets.archive");
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div>
        <p className="font-medium">{pocket.name}</p>
        {pocket.target_amount && <p className="text-xs text-muted">{t("pockets.target", { amount: money(pocket.target_amount) })}</p>}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        <p className="text-right font-semibold tabular-nums">{money(pocket.balance ?? "0")}</p>
        <button
          type="button"
          onClick={onToggle}
          disabled={busy || blocked}
          aria-label={`${label} ${pocket.name}`}
          aria-describedby={blocked ? hintId : undefined}
          className="rounded-lg border border-[color:var(--field)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
        >
          {label}
        </button>
        {blocked && <span id={hintId} className="basis-full text-right text-xs text-muted">{t("pockets.archiveBlocked")}</span>}
      </div>
    </li>
  );
}

const schema = z.object({
  name: z.string().trim().min(1, "pockets.validation.name").max(60, "pockets.validation.name"),
  target: z.string().refine((v) => v.trim() === "" || parseAmountInput(v) !== null, "pockets.validation.target"),
});
type Values = z.infer<typeof schema>;
const defaultValues: Values = { name: "", target: "" };

function CreatePocketForm({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const [saved, setSaved] = useState(false);
  const idem = useIdempotencyKey();
  const queryClient = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues });
  const create = useMutation({
    mutationFn: (v: Values) =>
      callLedger("create_pocket", {
        p_workspace_id: workspaceId,
        p_idempotency_key: idem.current(),
        p_name: v.name,
        p_target_amount: v.target.trim() === "" ? null : parseAmountInput(v.target),
      }),
    onSuccess: () => {
      idem.settle();
      setSaved(true);
      form.reset(defaultValues);
      return queryClient.invalidateQueries({ queryKey: financeKeys.pockets(workspaceId) });
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
      <h2 className="section-title">{t("pockets.createTitle")}</h2>
      <form onSubmit={form.handleSubmit((v) => create.mutate(v))} noValidate className="mt-4 space-y-4">
        <Field label={t("pockets.fields.name")} error={err("name")} {...form.register("name", { onChange: onEdit })} />
        <Field
          label={t("pockets.fields.target")}
          inputMode="numeric"
          placeholder="Rp0"
          error={err("target")}
          {...form.register("target", {
            onChange: onEdit,
            onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
              const parsed = parseAmountInput(e.target.value);
              if (parsed !== null) form.setValue("target", money(parsed));
            },
          })}
        />
        <ServerError messageKey={create.isError ? nameTakenOr(create.error, "pockets.validation.nameTaken") : null} />
        <p role="status" className="text-sm text-muted">{saved ? t("pockets.created") : ""}</p>
        <Submit busy={create.isPending}>{t("pockets.submit")}</Submit>
      </form>
    </div>
  );
}
