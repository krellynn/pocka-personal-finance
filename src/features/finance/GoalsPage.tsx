import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { parseAmountInput } from "../../lib/money/parseAmountInput";
import { Field, ServerError, Submit } from "../auth/AuthPages";
import { callLedger, fetchGoals, fetchPockets } from "./api";
import { nameTakenOr } from "./errors";
import { financeKeys } from "./keys";
import { money } from "./money";
import { SelectField } from "./ui";
import { useIdempotencyKey } from "./useIdempotencyKey";
import { useWorkspace } from "./useWorkspace";

type Goal = Awaited<ReturnType<typeof fetchGoals>>[number];

export function GoalsPage() {
  const { t } = useTranslation();
  const ws = useWorkspace().data;
  const enabled = !!ws;
  const goals = useQuery({ queryKey: financeKeys.goals(ws?.id ?? ""), queryFn: () => fetchGoals(ws!.id), enabled });
  const pockets = useQuery({ queryKey: [...financeKeys.pockets(ws?.id ?? ""), "list"], queryFn: () => fetchPockets(ws!.id), enabled });
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Goal | null>(null);
  // The edit form closes on success and rows change on archive, so confirmations live here.
  const [notice, setNotice] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const archive = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      callLedger("set_goal_archived", { p_workspace_id: ws!.id, p_goal_id: id, p_archived: archived }),
    onSuccess: (_, { archived }) => setNotice(archived ? "goals.archivedDone" : "goals.unarchivedDone"),
    onSettled: () => queryClient.invalidateQueries({ queryKey: financeKeys.goals(ws!.id) }),
  });

  const all = goals.data ?? [];
  const active = all.filter((g) => !g.archived_at);
  const archived = all.filter((g) => g.archived_at);
  const pocketName = (id: string | null) => pockets.data?.find((p) => p.id === id)?.name ?? "";
  const row = (g: Goal) => (
    <GoalRow
      key={g.id}
      goal={g}
      pocket={pocketName(g.pocket_id)}
      busy={archive.isPending}
      onEdit={() => {
        setNotice(null);
        setEditing(g);
      }}
      onToggle={() => archive.mutate({ id: g.id, archived: !g.archived_at })}
    />
  );

  return (
    <section className="max-w-3xl space-y-5">
      <h1 className="text-3xl font-bold tracking-tight">{t("nav.goals")}</h1>
      <div className="surface-card">
        <h2 ref={heading} tabIndex={-1} className="section-title">{t("goals.listTitle")}</h2>
        <ServerError messageKey={goals.isError ? "goals.loadFailed" : archive.isError ? nameTakenOr(archive.error, "goals.validation.nameTaken") : null} />
        <p role="status" className="mt-2 text-sm text-muted">{notice ? t(notice) : ""}</p>
        {goals.isPending && <p role="status" className="mt-2 text-sm text-muted">{t("goals.loading")}</p>}
        {goals.isSuccess && active.length === 0 && <p className="mt-2 text-sm text-muted">{t("goals.empty")}</p>}
        <ul className="mt-3 divide-y divide-[color:var(--line)]">{active.map(row)}</ul>
        {archived.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-muted">{t("goals.archivedTitle", { count: archived.length })}</summary>
            <ul className="mt-2 divide-y divide-[color:var(--line)]">{archived.map(row)}</ul>
          </details>
        )}
      </div>
      {ws && pockets.isSuccess && (
        <GoalForm
          key={editing?.id ?? "new"}
          workspaceId={ws.id}
          goal={editing}
          pockets={pockets.data.filter((p) => p.id === editing?.pocket_id || (!p.archived_at && !active.some((g) => g.pocket_id === p.id)))}
          onDone={(saved) => {
            setNotice(saved ? "goals.updated" : null);
            setEditing(null);
            heading.current?.focus();
          }}
        />
      )}
    </section>
  );
}

function GoalRow({ goal: g, pocket, busy, onEdit, onToggle }: { goal: Goal; pocket: string; busy: boolean; onEdit: () => void; onToggle: () => void }) {
  const { t } = useTranslation();
  const percent = Math.min(100, Math.max(0, g.percent ?? 0));
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">
          {g.name}
          {g.is_reached && <span className="ml-2 rounded bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-800">{t("goals.reached")}</span>}
        </span>
        <span className="flex gap-2">
          {!g.archived_at && (
            <button type="button" onClick={onEdit} aria-label={`${t("goals.edit")} ${g.name}`} className="rounded-lg border border-[color:var(--field)] px-3 py-1.5 text-xs font-medium">
              {t("goals.edit")}
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            disabled={busy}
            aria-label={`${t(g.archived_at ? "goals.unarchive" : "goals.archive")} ${g.name}`}
            className="rounded-lg border border-[color:var(--field)] px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          >
            {t(g.archived_at ? "goals.unarchive" : "goals.archive")}
          </button>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={g.name}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}%`}
        className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--line)]"
      >
        <div className="h-full bg-[color:var(--focus)]" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1 text-sm tabular-nums">
        {t("goals.progress", { saved: money(g.saved), target: money(g.target_amount) })} · {percent}%
      </p>
      <p className="text-xs text-muted">
        {g.pocket_id ? t("goals.pocket", { name: pocket }) : g.archived_at ? "" : t("goals.unlinked")}
        {g.target_date && ` · ${t("goals.date", { date: g.target_date })}`}
        {g.notes && ` · ${g.notes}`}
      </p>
    </li>
  );
}

const schema = z.object({
  name: z.string().refine((v) => v.trim().length >= 1 && v.trim().length <= 60, "goals.validation.name"),
  amount: z.string().refine((v) => parseAmountInput(v) !== null, "goals.validation.amount"),
  date: z.string().refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "goals.validation.date"),
  note: z.string().max(500, "goals.validation.note"),
  pocket: z.string(),
});
type Values = z.infer<typeof schema>;
const emptyValues: Values = { name: "", amount: "", date: "", note: "", pocket: "" };

type PocketOption = { id: string; name: string };

function GoalForm({ workspaceId, goal, pockets, onDone }: { workspaceId: string; goal: Goal | null; pockets: PocketOption[]; onDone: (saved: boolean) => void }) {
  const { t } = useTranslation();
  const [created, setCreated] = useState(false);
  const idem = useIdempotencyKey();
  const queryClient = useQueryClient();
  const defaultValues: Values = goal
    ? { name: goal.name, amount: money(goal.target_amount), date: goal.target_date ?? "", note: goal.notes ?? "", pocket: goal.pocket_id ?? "" }
    : emptyValues;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues });
  const save = useMutation({
    mutationFn: (v: Values) => {
      const fields = {
        p_workspace_id: workspaceId,
        p_name: v.name,
        p_target_amount: parseAmountInput(v.amount),
        p_target_date: v.date || null,
        p_note: v.note.trim() || null,
        p_pocket_id: v.pocket || null,
      };
      // update_goal is an absolute upsert (no key); create_goal replays on its key.
      return goal ? callLedger("update_goal", { ...fields, p_goal_id: goal.id }) : callLedger("create_goal", { ...fields, p_idempotency_key: idem.current() });
    },
    onSuccess: () => {
      idem.settle();
      if (goal) onDone(true);
      else {
        setCreated(true);
        form.reset(emptyValues);
      }
      return queryClient.invalidateQueries({ queryKey: financeKeys.goals(workspaceId) });
    },
    onError: (error) => idem.settle(error),
  });
  // A changed form after a failed save is a new request, never a retry of the old one.
  const onEdit = () => {
    setCreated(false);
    if (save.isError || save.isPending) {
      idem.settle();
      if (save.isError) save.reset();
    }
  };
  const err = (name: keyof Values) => {
    const m = form.formState.errors[name]?.message;
    return m ? t(m) : undefined;
  };
  // Editing starts in the name field, which sits below the list.
  useEffect(() => {
    if (goal) form.setFocus("name");
  }, [goal, form]);
  const registered = (name: keyof Values) => form.register(name, { onChange: onEdit });

  return (
    <div className="surface-card">
      <h2 className="section-title">{t(goal ? "goals.editTitle" : "goals.createTitle")}</h2>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate className="mt-4 space-y-4">
        <fieldset disabled={save.isPending} className="space-y-4">
          <Field label={t("goals.fields.name")} error={err("name")} {...registered("name")} />
          <Field
            label={t("goals.fields.amount")}
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
          <Field type="date" label={t("goals.fields.date")} error={err("date")} {...registered("date")} />
          <Field label={t("goals.fields.note")} maxLength={500} error={err("note")} {...registered("note")} />
          <SelectField label={t("goals.fields.pocket")} {...registered("pocket")}>
            <option value="">{t("goals.noPocket")}</option>
            {pockets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </SelectField>
          <ServerError messageKey={save.isError ? nameTakenOr(save.error, "goals.validation.nameTaken") : null} />
          <p role="status" className="text-sm text-muted">{created ? t("goals.created") : ""}</p>
          <div className="flex gap-2">
            <Submit busy={save.isPending}>{t("goals.submit")}</Submit>
            {goal && (
              <button type="button" onClick={() => onDone(false)} className="rounded-xl border border-[color:var(--field)] px-4 py-2.5 text-sm font-medium">
                {t("goals.cancel")}
              </button>
            )}
          </div>
        </fieldset>
      </form>
    </div>
  );
}
