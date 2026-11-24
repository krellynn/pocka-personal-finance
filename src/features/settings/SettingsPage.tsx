import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { updateDisplayName } from "../auth/api";
import { Field, ServerError, Submit } from "../auth/AuthPages";
import { useAuth } from "../auth/useAuth";
import { profileKey, useProfile } from "../auth/useProfile";

// Same limits as the profiles.display_name check constraint.
const schema = z.object({
  displayName: z.string().trim().min(1, "auth.validation.nameRequired").max(80, "auth.validation.nameMax"),
});

export function SettingsPage() {
  const { t } = useTranslation();
  const userId = useAuth().session?.user.id;
  const queryClient = useQueryClient();
  const profile = useProfile();
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { displayName: "" },
    // Fill the field once the profile loads; keeps user edits otherwise.
    ...(profile.data && { values: { displayName: profile.data.display_name } }),
    resetOptions: { keepDirtyValues: true },
  });
  const save = useMutation({
    mutationFn: ({ displayName }: { displayName: string }) => updateDisplayName(userId as string, displayName),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: profileKey(userId) }),
  });
  const error = form.formState.errors.displayName?.message;

  return (
    <section className="max-w-xl space-y-5">
      <h1 className="text-3xl font-bold tracking-tight">{t("nav.settings")}</h1>
      <div className="surface-card">
        <h2 className="section-title">{t("settings.profile.title")}</h2>
        <form onSubmit={form.handleSubmit((v) => {
          form.setValue("displayName", v.displayName); // show the trimmed value that gets stored
          save.mutate(v);
        })} noValidate className="mt-4 space-y-4">
          <Field label={t("auth.fields.displayName")} autoComplete="name" error={error ? t(error) : undefined} {...form.register("displayName", { onChange: () => save.reset() })} />
          <ServerError messageKey={save.isError ? "settings.profile.saveFailed" : null} />
          <p role="status" className="text-sm text-muted">{save.isSuccess ? t("settings.profile.saved") : ""}</p>
          <Submit busy={save.isPending || profile.isPending}>{t("settings.profile.submit")}</Submit>
        </form>
      </div>
    </section>
  );
}
