import { zodResolver } from "@hookform/resolvers/zod";
import { useId, useState, type ComponentProps, type PropsWithChildren } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { requestPasswordReset, signIn, signUp, updatePassword } from "./api";
import { useAuth } from "./useAuth";
import { authErrorKey } from "./errors";
import { AuthLoading } from "./guards";

// Schema messages are i18n keys, translated at render time.
const email = z.string().trim().min(1, "auth.validation.emailRequired").email("auth.validation.emailInvalid");
// Supabase Auth (bcrypt) accepts at most 72 bytes, not characters.
const password = z
  .string()
  .min(8, "auth.validation.passwordMin")
  .refine((v) => new TextEncoder().encode(v).length <= 72, "auth.validation.passwordMax");
const matching = <T extends { password: string; confirmPassword: string }>(v: T) => v.password === v.confirmPassword;
const mismatch = { message: "auth.validation.passwordMismatch", path: ["confirmPassword"] };

const signInSchema = z.object({ email, password: z.string().min(1, "auth.validation.passwordRequired") });
const signUpSchema = z
  .object({
    displayName: z.string().trim().min(1, "auth.validation.nameRequired").max(80, "auth.validation.nameMax"),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine(matching, mismatch);
const forgotSchema = z.object({ email });
const updateSchema = z.object({ password, confirmPassword: z.string() }).refine(matching, mismatch);

export function SignInPage() {
  const { t } = useTranslation();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(signInSchema), defaultValues: { email: "", password: "" } });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setServerError(null);
    try {
      await signIn(email, password); // GuestOnly redirects once the session arrives
    } catch (error) {
      setServerError(authErrorKey(error));
    }
  });

  return (
    <AuthLayout title={t("auth.signIn.title")} subtitle={t("auth.signIn.subtitle")}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label={t("auth.fields.email")} type="email" autoComplete="email" error={tr(t, errors.email?.message)} {...form.register("email")} />
        <Field label={t("auth.fields.password")} type="password" autoComplete="current-password" error={tr(t, errors.password?.message)} {...form.register("password")} />
        <ServerError messageKey={serverError} />
        <Submit busy={form.formState.isSubmitting}>{t("auth.signIn.submit")}</Submit>
      </form>
      <div className="mt-5 flex flex-col gap-2 text-center text-sm">
        <Link className="text-muted underline-offset-4 hover:underline" to="/forgot-password">{t("auth.signIn.forgot")}</Link>
        <p className="text-muted">
          {t("auth.signIn.noAccount")} <Link className="font-semibold text-ink underline-offset-4 hover:underline" to="/sign-up">{t("auth.signUp.title")}</Link>
        </p>
      </div>
    </AuthLayout>
  );
}

export function SignUpPage() {
  const { t } = useTranslation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const form = useForm({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: "", email: "", password: "", confirmPassword: "" },
  });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async ({ displayName, email, password }) => {
    setServerError(null);
    try {
      const signedIn = await signUp(email, password, displayName);
      if (!signedIn) setCheckEmail(true); // email confirmation required
    } catch (error) {
      setServerError(authErrorKey(error));
    }
  });

  if (checkEmail) {
    return (
      <AuthLayout title={t("auth.signUp.checkEmailTitle")} subtitle={t("auth.signUp.checkEmailBody")}>
        <BackToSignIn />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("auth.signUp.title")} subtitle={t("auth.signUp.subtitle")}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label={t("auth.fields.displayName")} autoComplete="name" error={tr(t, errors.displayName?.message)} {...form.register("displayName")} />
        <Field label={t("auth.fields.email")} type="email" autoComplete="email" error={tr(t, errors.email?.message)} {...form.register("email")} />
        <Field label={t("auth.fields.password")} type="password" autoComplete="new-password" hint={t("auth.fields.passwordHint")} error={tr(t, errors.password?.message)} {...form.register("password")} />
        <Field label={t("auth.fields.confirmPassword")} type="password" autoComplete="new-password" error={tr(t, errors.confirmPassword?.message)} {...form.register("confirmPassword")} />
        <ServerError messageKey={serverError} />
        <Submit busy={form.formState.isSubmitting}>{t("auth.signUp.submit")}</Submit>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        {t("auth.signUp.haveAccount")} <Link className="font-semibold text-ink underline-offset-4 hover:underline" to="/sign-in">{t("auth.signIn.title")}</Link>
      </p>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const form = useForm({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setServerError(null);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (error) {
      setServerError(authErrorKey(error));
    }
  });

  if (sent) {
    return (
      <AuthLayout title={t("auth.forgot.sentTitle")} subtitle={t("auth.forgot.sentBody")}>
        <BackToSignIn />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("auth.forgot.title")} subtitle={t("auth.forgot.subtitle")}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label={t("auth.fields.email")} type="email" autoComplete="email" error={tr(t, form.formState.errors.email?.message)} {...form.register("email")} />
        <ServerError messageKey={serverError} />
        <Submit busy={form.formState.isSubmitting}>{t("auth.forgot.submit")}</Submit>
      </form>
      <BackToSignIn />
    </AuthLayout>
  );
}

/** Reached from the reset email (recovery session) or by a signed-in user changing their password. */
export function UpdatePasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm({ resolver: zodResolver(updateSchema), defaultValues: { password: "", confirmPassword: "" } });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setServerError(null);
    try {
      await updatePassword(password);
      navigate("/", { replace: true });
    } catch (error) {
      setServerError(authErrorKey(error));
    }
  });

  if (loading) return <AuthLoading />;
  if (!session) {
    return (
      <AuthLayout title={t("auth.update.invalidTitle")} subtitle={t("auth.update.invalidBody")}>
        <Link className="block text-center text-sm font-semibold underline-offset-4 hover:underline" to="/forgot-password">{t("auth.forgot.title")}</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("auth.update.title")} subtitle={t("auth.update.subtitle")}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label={t("auth.fields.newPassword")} type="password" autoComplete="new-password" hint={t("auth.fields.passwordHint")} error={tr(t, errors.password?.message)} {...form.register("password")} />
        <Field label={t("auth.fields.confirmPassword")} type="password" autoComplete="new-password" error={tr(t, errors.confirmPassword?.message)} {...form.register("confirmPassword")} />
        <ServerError messageKey={serverError} />
        <Submit busy={form.formState.isSubmitting}>{t("auth.update.submit")}</Submit>
      </form>
    </AuthLayout>
  );
}

// ---- shared bits -------------------------------------------------------------

const tr = (t: (key: string) => string, key: string | undefined) => (key ? t(key) : undefined);

function AuthLayout({ title, subtitle, children }: PropsWithChildren<{ title: string; subtitle: string }>) {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5 py-10 text-ink">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-ink text-sm font-black text-white">P.</div>
          <p className="text-lg font-extrabold tracking-tight">pocka</p>
        </div>
        <div className="surface-card">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mb-6 mt-2 text-sm leading-6 text-muted">{subtitle}</p>
          {children}
        </div>
      </div>
    </main>
  );
}

type FieldProps = ComponentProps<"input"> & { label: string; error?: string | undefined; hint?: string };

export function Field({ label, error, hint, ...input }: FieldProps) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="mt-1.5 w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-blue focus:ring-2 focus:ring-blue/40 aria-[invalid=true]:border-red-400"
        {...input}
      />
      {hint && <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-red-700">{error}</p>}
    </div>
  );
}

export function ServerError({ messageKey }: { messageKey: string | null }) {
  const { t } = useTranslation();
  if (!messageKey) return null;
  return <p role="alert" className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-800">{t(messageKey)}</p>;
}

export function Submit({ busy, children }: PropsWithChildren<{ busy: boolean }>) {
  const { t } = useTranslation();
  return (
    <button type="submit" disabled={busy} className="w-full rounded-xl bg-ink px-4 py-3 text-sm font-semibold text-white shadow-soft transition disabled:cursor-wait disabled:opacity-60">
      {busy ? t("auth.submitting") : children}
    </button>
  );
}

function BackToSignIn() {
  const { t } = useTranslation();
  return <Link className="mt-5 block text-center text-sm text-muted underline-offset-4 hover:underline" to="/sign-in">{t("auth.backToSignIn")}</Link>;
}
