import { useId, type ComponentProps } from "react";

type SelectFieldProps = ComponentProps<"select"> & { label: string; error?: string | undefined };

/** A labelled select styled like Field (auth/AuthPages). */
export function SelectField({ label, error, children, ...select }: SelectFieldProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="mt-1.5 w-full rounded-xl border border-[color:var(--field)] bg-white px-3.5 py-2.5 text-sm text-ink outline-none focus:border-[color:var(--focus)] focus:ring-2 focus:ring-[color:var(--focus)] aria-[invalid=true]:border-red-400"
        {...select}
      >
        {children}
      </select>
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-red-700">{error}</p>}
    </div>
  );
}
