import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useIdempotencyKey } from "./useIdempotencyKey";

describe("useIdempotencyKey", () => {
  it("keeps the key across re-renders and after a network failure", () => {
    const { result, rerender } = renderHook(() => useIdempotencyKey());
    const first = result.current.current();
    rerender();
    result.current.settle(new TypeError("Failed to fetch"));
    expect(result.current.current()).toBe(first);
  });

  it("gives a new key after success or a server rejection", () => {
    const { result } = renderHook(() => useIdempotencyKey());
    const first = result.current.current();
    result.current.settle();
    const second = result.current.current();
    expect(second).not.toBe(first);
    result.current.settle({ code: "P0001", message: "VALIDATION_FAILED" });
    expect(result.current.current()).not.toBe(second);
  });
});
