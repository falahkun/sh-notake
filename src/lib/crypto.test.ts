import { describe, expect, it } from "vitest";
import { decryptNote, encryptNote } from "./crypto";

describe("share-note crypto", () => {
  it("encrypts and decrypts the original markdown", async () => {
    const source = "# Hello\n\nThis is **private**.";
    const encrypted = await encryptNote(source);
    expect(encrypted.ciphertext).not.toContain(source);
    await expect(decryptNote(encrypted.ciphertext, encrypted.iv, encrypted.key)).resolves.toBe(source);
  });

  it("rejects a wrong key", async () => {
    const encrypted = await encryptNote("secret");
    const other = await encryptNote("other");
    await expect(decryptNote(encrypted.ciphertext, encrypted.iv, other.key)).rejects.toThrow();
  });
});
