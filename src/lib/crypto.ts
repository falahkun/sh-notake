const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((b) => binary += String.fromCharCode(b));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

export async function encryptNote(markdown: string) {
  return encryptNoteWithKey(markdown);
}

export async function encryptNoteWithKey(markdown: string, keyValue?: string) {
  let cryptoKey: CryptoKey;
  let rawKeyBase64: string;

  if (keyValue) {
    cryptoKey = await crypto.subtle.importKey(
      "raw",
      base64UrlToBytes(keyValue),
      { name: "AES-GCM" },
      true,
      ["encrypt", "decrypt"]
    );
    rawKeyBase64 = keyValue;
  } else {
    cryptoKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    const rawKey = new Uint8Array(await crypto.subtle.exportKey("raw", cryptoKey));
    rawKeyBase64 = bytesToBase64Url(rawKey);
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, encoder.encode(markdown));

  return {
    ciphertext: bytesToBase64Url(new Uint8Array(data)),
    iv: bytesToBase64Url(iv),
    key: rawKeyBase64
  };
}

export async function decryptNote(ciphertext: string, iv: string, keyValue: string) {
  const key = await crypto.subtle.importKey("raw", base64UrlToBytes(keyValue), { name: "AES-GCM" }, false, ["decrypt"]);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(iv) },
    key,
    base64UrlToBytes(ciphertext)
  );
  return new TextDecoder().decode(plaintext);
}
