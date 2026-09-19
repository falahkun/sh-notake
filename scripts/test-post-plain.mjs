const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ENDPOINT = `${BASE_URL}/api/shares/plain`;

const payload = {
  text: "# Halo dari Plaintext API!\n\nCatatan rahasia ini dikirim sebagai plain text, dienkripsi di backend, dan siap dibuka di browser."
};

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

async function getApiKey() {
  if (process.env.API_KEY) return process.env.API_KEY;
  const adminAuth = "Basic " + Buffer.from("admin:admin123456").toString("base64");
  const res = await fetch(`${BASE_URL}/api/admin/keys`, {
    method: "POST",
    headers: { Authorization: adminAuth, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "CLI Test Key (Plain)", expiresInDays: 7 })
  });
  if (res.ok) {
    const data = await res.json();
    return data.key.rawKey;
  }
  return null;
}

async function runTest() {
  const apiKey = await getApiKey();
  console.log("=== Testing POST /api/shares/plain ===");
  console.log(`Target URL : ${ENDPOINT}`);
  console.log(`Payload    :`, JSON.stringify(payload, null, 2));
  console.log("Sending request...\n");

  try {
    const postRes = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {})
      },
      body: JSON.stringify(payload)
    });

    const postData = await postRes.json();
    console.log(`[POST Response] Status: ${postRes.status} ${postRes.statusText}`);
    console.log(`[POST Response] Body  :`, JSON.stringify(postData, null, 2));

    if (postRes.status === 201 && postData.shareId && postData.url) {
      console.log("\n POST /api/shares/plain successfully created and encrypted note!");
      console.log(`Share ID : ${postData.shareId}`);
      console.log(`Share URL: ${postData.url}`);

      // Verify that database holds encrypted ciphertext and can be decrypted with key
      console.log(`\n=== Verifying via GET /api/shares/${postData.shareId} ===`);
      const getRes = await fetch(`${BASE_URL}/api/shares/${postData.shareId}`, {
        headers: { ...(apiKey ? { "x-api-key": apiKey } : {}) }
      });
      const getData = await getRes.json();
      console.log(`[GET Response] Status: ${getRes.status} ${getRes.statusText}`);
      console.log(`[GET Response] Ciphertext stored: ${getData.ciphertext.slice(0, 30)}...`);
      console.log(`[GET Response] IV stored        : ${getData.iv}`);

      // Decrypt using the key returned from the plain endpoint
      const decrypted = await decryptNote(getData.ciphertext, getData.iv, postData.key);
      console.log(`\n[Decryption Test] Decrypted text:\n"${decrypted}"`);

      if (decrypted === payload.text) {
        console.log("\n SUCCESS: Plaintext matches decrypted content perfectly!");
      } else {
        console.error("\n FAILED: Decrypted content does not match original!");
        process.exitCode = 1;
      }
    } else {
      console.error("\n POST /api/shares/plain failed!");
      process.exitCode = 1;
    }
  } catch (err) {
    console.error("\n Request failed with error:", err);
    process.exitCode = 1;
  }
}

runTest();
