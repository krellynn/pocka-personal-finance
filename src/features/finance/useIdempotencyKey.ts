import { useRef } from "react";
import { isLedgerRejection } from "./errors";

/**
 * One idempotency key per thing the user is saving. After a network failure the outcome is unknown,
 * so the retry must reuse the key; after success or a definite server rejection the next save gets a new one.
 */
export function useIdempotencyKey() {
  const ref = useRef<string | null>(null);
  ref.current ??= crypto.randomUUID();
  return {
    current: () => ref.current as string,
    settle: (error?: unknown) => {
      if (error === undefined || isLedgerRejection(error)) ref.current = crypto.randomUUID();
    },
  };
}
