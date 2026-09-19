import { describe, expect, it } from "vitest";
import { createShareSchema } from "@/lib/share";

describe("share API validation", () => {
  it("accepts valid encrypted payload", () => {
    expect(createShareSchema.safeParse({
      ciphertext: "abc",
      iv: "123"
    }).success).toBe(true);
  });

  it("rejects missing ciphertext", () => {
    expect(createShareSchema.safeParse({ iv: "123" }).success).toBe(false);
  });

  it("rejects empty IV", () => {
    expect(createShareSchema.safeParse({ ciphertext: "abc", iv: "" }).success).toBe(false);
  });
});
