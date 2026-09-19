const BASE_URL = "http://localhost:3000";

async function assertTest(name, fn) {
  process.stdout.write(`• ${name}... `);
  try {
    await fn();
    console.log(" PASSED");
  } catch (err) {
    console.log(" FAILED");
    console.error("  ->", err.message);
    process.exitCode = 1;
  }
}

function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

async function decryptNote(ciphertext, iv, keyValue) {
  const key = await crypto.subtle.importKey(
    "raw",
    base64UrlToBytes(keyValue),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(iv) },
    key,
    base64UrlToBytes(ciphertext)
  );
  return new TextDecoder().decode(plaintext);
}

async function run() {
  console.log("=================================================");
  console.log("       TESTING UPDATE NOTES API (PUT/PATCH)      ");
  console.log("=================================================\n");

  // Get or create API key
  const adminAuth = "Basic " + Buffer.from("admin:admin123456").toString("base64");
  const keyRes = await fetch(`${BASE_URL}/api/admin/keys`, {
    method: "POST",
    headers: { Authorization: adminAuth, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Update Test Key", expiresInDays: 7 })
  });
  const keyData = await keyRes.json();
  const apiKey = keyData.key.rawKey;

  let shareId = "";
  let originalKey = "";
  let originalUrl = "";

  // 1. Create a note first
  await assertTest("Create initial note via POST /api/shares/plain", async () => {
    const res = await fetch(`${BASE_URL}/api/shares/plain`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({ text: "Versi 1: Catatan awal sebelum di-update." })
    });
    if (res.status !== 201) throw new Error(`Expected 201, got ${res.status}`);
    const data = await res.json();
    shareId = data.shareId;
    originalKey = data.key;
    originalUrl = data.url;
  });

  // 2. Reject update without API key
  await assertTest("Reject unauthenticated PUT /api/shares/plain/:shareId (401)", async () => {
    const res = await fetch(`${BASE_URL}/api/shares/plain/${shareId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Versi 2: Hacker berusaha update tanpa key." })
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  // 3. Update note preserving the same encryption key (same URL!)
  await assertTest("Update note via PUT /api/shares/plain/:shareId keeping same key/URL", async () => {
    const updatedText = "Versi 2: Catatan telah berhasil di-update dengan key yang sama!";
    const res = await fetch(`${BASE_URL}/api/shares/plain/${shareId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({
        text: updatedText,
        key: originalKey // Preserve original URL
      })
    });

    if (res.status !== 200) {
      const err = await res.text();
      throw new Error(`Expected 200, got ${res.status}: ${err}`);
    }

    const data = await res.json();
    if (!data.updated || data.key !== originalKey) {
      throw new Error(`Key was not preserved: ${JSON.stringify(data)}`);
    }

    // Verify public GET /api/shares/:shareId can be decrypted with originalKey
    const getRes = await fetch(`${BASE_URL}/api/shares/${shareId}`);
    const getData = await getRes.json();
    const decrypted = await decryptNote(getData.ciphertext, getData.iv, originalKey);

    if (decrypted !== updatedText) {
      throw new Error(`Decrypted text mismatch: "${decrypted}" vs "${updatedText}"`);
    }
  });

  // 4. Update note via PUT /api/shares/:shareId (Zero-Knowledge mode)
  await assertTest("Update note via PUT /api/shares/:shareId (Zero-Knowledge ciphertext/iv)", async () => {
    // Generate new client-side ciphertext
    const newText = "Versi 3: Di-update menggunakan Zero-Knowledge mode langsung.";
    const encoder = new TextEncoder();
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(newText));

    const toBase64Url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    const rawKeyBytes = new Uint8Array(await crypto.subtle.exportKey("raw", key));
    const ciphertextStr = toBase64Url(new Uint8Array(encrypted));
    const ivStr = toBase64Url(iv);
    const keyStr = toBase64Url(rawKeyBytes);

    const res = await fetch(`${BASE_URL}/api/shares/${shareId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({
        ciphertext: ciphertextStr,
        iv: ivStr
      })
    });

    if (res.status !== 200) {
      const err = await res.text();
      throw new Error(`Expected 200, got ${res.status}: ${err}`);
    }

    // Verify public GET
    const getRes = await fetch(`${BASE_URL}/api/shares/${shareId}`);
    const getData = await getRes.json();
    const decrypted = await decryptNote(getData.ciphertext, getData.iv, keyStr);

    if (decrypted !== newText) {
      throw new Error(`Decrypted text mismatch: "${decrypted}" vs "${newText}"`);
    }
  });

  // 5. Update non-existent shareId -> 404
  await assertTest("Reject update on non-existent shareId (404)", async () => {
    const res = await fetch(`${BASE_URL}/api/shares/plain/non-existent-share-id-12345`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({ text: "Test non-existent" })
    });
    if (res.status !== 404) {
      throw new Error(`Expected 404, got ${res.status}`);
    }
  });

  console.log("\n ALL UPDATE NOTE TESTS PASSED SUCCESSFULLY!");
}

run();
