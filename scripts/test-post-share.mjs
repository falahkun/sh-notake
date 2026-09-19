const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const ENDPOINT = `${BASE_URL}/api/shares`;

const payload = {
  ciphertext:
    "EOE1.eyJ2IjoxLCJhbGciOiJBMjU2R0NNIiwia2RmIjoiUEJLREYyIiwiaGFzaCI6IlNIQS0yNTYiLCJpdGVyIjo2MDAwMDAsInNhbHQiOiJlbXlWQWpYa0JsWWs1ZUdnVFBfbmV3IiwiaXYiOiJIYXZvUzRrOXFZbWswU3ozIiwidGFnIjoxMjgsImVuYyI6IlVURi04IiwiY3QiOiJkV0FidzlQak11RkNBZE5nUXpab3VKNVpHWURsakczdkNDOVJSNVYxWnVxa1IzNG0ifQ",
  iv: "3d966387-f335-47d1-906c-c6032ca32b5d"
};

async function getApiKey() {
  if (process.env.API_KEY) return process.env.API_KEY;
  const adminAuth = "Basic " + Buffer.from("admin:admin123456").toString("base64");
  const res = await fetch(`${BASE_URL}/api/admin/keys`, {
    method: "POST",
    headers: { Authorization: adminAuth, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "CLI Test Key (Share)", expiresInDays: 7 })
  });
  if (res.ok) {
    const data = await res.json();
    return data.key.rawKey;
  }
  return null;
}

async function runTest() {
  const apiKey = await getApiKey();
  console.log("=== Testing POST /api/shares ===");
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

    if (postRes.status === 201 && postData.shareId) {
      console.log("\n POST /api/shares successfully created note!");
      console.log(`Share ID: ${postData.shareId}`);
      console.log(`Share URL: ${BASE_URL}/s/${postData.shareId}`);

      // Verify note can be retrieved via GET /api/shares/[shareId]
      console.log(`\n=== Verifying via GET /api/shares/${postData.shareId} ===`);
      const getRes = await fetch(`${ENDPOINT}/${postData.shareId}`, {
        headers: { ...(apiKey ? { "x-api-key": apiKey } : {}) }
      });
      const getData = await getRes.json();
      console.log(`[GET Response] Status: ${getRes.status} ${getRes.statusText}`);
      console.log(`[GET Response] Body  :`, JSON.stringify(getData, null, 2));

      if (
        getData.ciphertext === payload.ciphertext &&
        getData.iv === payload.iv
      ) {
        console.log("\n Verification passed: Ciphertext and IV match perfectly!");
      } else {
        console.warn("\n Verification warning: Data mismatch!");
      }
    } else {
      console.error("\n POST /api/shares failed!");
      process.exitCode = 1;
    }
  } catch (err) {
    console.error("\n Request failed with error:", err);
    process.exitCode = 1;
  }
}

runTest();
