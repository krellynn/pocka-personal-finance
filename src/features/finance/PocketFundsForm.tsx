import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { parseAmountInput } from "../../lib/money/parseAmountInput";
import { Field, ServerError, Submit } from "../auth/AuthPages";
import { callLedger } from "./api";
import { financeErrorKey } from "./errors";
import { financeKeys } from "./keys";
import { money } from "./money";
import { SelectField } from "./ui";
import { useIdempotencyKey } from "./useIdempotencyKey";

const actions = ["allocate", "deallocate", "move"] as const;
type PocketOption = { id: string; name: string; balance: string | null };

const schema = z
  .object({
    action: z.enum(actions),
    pocket: z.string().min(1, "pockets.funds.validation.pocket"),
    toPocket: z.string(),
    amount: z.string().refine((v) => parseAmountInput(v) !== null, "pockets.validation.target"),
    note: z.string().max(200, "pockets.funds.validation.note"),
  })
  .refine((v) => v.action !== "move" || (v.toPocket !== "" && v.toPocket !== v.pocket), {
    path: ["toPocket"],
    message: "pockets.funds.validation.toPocket",
  });
type Values = z.infer<typeof schema>;

/** Allocate from "Belum dialokasikan", return to it, or move between pockets. The server enforces every limit. */
export function PocketFundsForm({ workspaceId, pockets }: { workspaceId: string; pockets: PocketOption[] }) {
  const { t } = useTranslation();
  const [saved, setSaved] = useState(false);
  const idem = useIdempotencyKey();
  const queryClient = useQueryClient();
  const defaultValues: Values = { action: "allocate", pocket: "", toPocket: "", amount: "", note: "" };
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues });
  const action = form.watch("action");
  const save = useMutation({
    mutationFn: (v: Values) => {
      const common = { p_workspace_id: workspaceId, p_idempotency_key: idem.current(), p_amount: parseAmountInput(v.amount), p_note: v.note.trim() || null };
      if (v.action === "move") return callLedger("move_between_pockets", { ...common, p_from_pocket_id: v.pocket, p_to_pocket_id: v.toPocket });
      return callLedger(v.action === "allocate" ? "allocate_to_pocket" : "deallocate_from_pocket", { ...common, p_pocket_id: v.pocket });
    },
    onSuccess: () => {
      idem.settle();
      setSaved(true);
      form.reset({ ...defaultValues, action: form.getValues("action") });
      return queryClient.invalidateQueries({ queryKey: financeKeys.pockets(workspaceId) });
    },
    onError: (error) => idem.settle(error),
  });
  // A changed form after a failed save is a new request, never a retry of the old one.
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
  const options = pockets.map((p) => (
    <option key={p.id} value={p.id}>{`${p.name} (${money(p.balance ?? "0")})`}</option>
  ));

  return (
    <div className="surface-card">
      <h2 className="section-title">{t("pockets.funds.title")}</h2>
      <form onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
        {/* Locked while saving so an edit cannot rotate the idempotency key of an in-flight request. */}
        <fieldset disabled={save.isPending} className="mt-4 space-y-4">
        <SelectField label={t("pockets.funds.action")} {...form.register("action", { onChange: onEdit })}>
          {actions.map((a) => <option key={a} value={a}>{t(`pockets.funds.actions.${a}`)}</option>)}
        </SelectField>
        <SelectField label={t(action === "move" ? "pockets.funds.from" : "pockets.funds.pocket")} error={err("pocket")} {...form.register("pocket", { onChange: onEdit })}>
          <option value="">{t("pockets.funds.choose")}</option>
          {options}
        </SelectField>
        {action === "move" && (
          <SelectField label={t("pockets.funds.to")} error={err("toPocket")} {...form.register("toPocket", { onChange: onEdit })}>
            <option value="">{t("pockets.funds.choose")}</option>
            {options}
          </SelectField>
        )}
        <Field
          label={t("pockets.funds.amount")}
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
        <Field label={t("pockets.funds.note")} maxLength={200} error={err("note")} {...form.register("note", { onChange: onEdit })} />
        <ServerError messageKey={save.isError ? financeErrorKey(save.error) : null} />
        <p role="status" className="text-sm text-muted">{saved ? t("pockets.funds.saved") : ""}</p>
        <Submit busy={save.isPending}>{t("pockets.funds.submit")}</Submit>
        </fieldset>
      </form>
    </div>
  );
}
