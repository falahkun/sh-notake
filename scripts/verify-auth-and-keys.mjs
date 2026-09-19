const BASE_URL = "http://localhost:3000";

const ADMIN_USER = "admin";
const ADMIN_PASS = "admin123456";
const BASIC_AUTH = "Basic " + Buffer.from(`${ADMIN_USER}:${ADMIN_PASS}`).toString("base64");

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

async function run() {
  console.log("=================================================");
  console.log("  VERIFYING BASIC AUTH, SECRET KEYS & MIDDLEWARE ");
  console.log("=================================================\n");

  let createdApiKey = null;
  let createdKeyId = null;
  let testShareId = null;

  // 1. Basic Auth on /api/admin/keys without credentials
  await assertTest("Admin API blocks unauthorized access (401 + WWW-Authenticate)", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/keys`);
    if (res.status !== 401) {
      throw new Error(`Expected 401, got ${res.status}`);
    }
    const wwwAuth = res.headers.get("www-authenticate");
    if (!wwwAuth || !wwwAuth.includes("Basic")) {
      throw new Error(`Missing WWW-Authenticate header, got: ${wwwAuth}`);
    }
  });

  // 2. Unauthenticated web /admin redirects to /login
  await assertTest("Admin page redirects unauthenticated web visitors to /login", async () => {
    const res = await fetch(`${BASE_URL}/admin`, { redirect: "manual" });
    if (res.status !== 307 && res.status !== 302) {
      throw new Error(`Expected redirect status (302/307), got ${res.status}`);
    }
    const location = res.headers.get("location");
    if (!location || !location.includes("/login")) {
      throw new Error(`Expected redirect to /login, got: ${location}`);
    }
  });

  // 3. Basic Auth on /api/admin/keys with credentials
  await assertTest("Admin API permits access with valid Basic Auth", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/keys`, {
      headers: { Authorization: BASIC_AUTH }
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
  });

  // 3. Admin API /api/admin/keys - Create new API Secret Key
  await assertTest("Admin API creates a new Secret Key", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/keys`, {
      method: "POST",
      headers: {
        Authorization: BASIC_AUTH,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Automated Test Key",
        expiresInDays: 30
      })
    });
    if (res.status !== 201) {
      const body = await res.text();
      throw new Error(`Expected 201, got ${res.status}. Body: ${body}`);
    }
    const data = await res.json();
    if (!data.key || !data.key.rawKey || !data.key.id) {
      throw new Error("Response missing key details");
    }
    createdApiKey = data.key.rawKey;
    createdKeyId = data.key.id;
  });

  // 4. Test anonymous request to /api/shares/plain without key -> 401
  await assertTest("Middleware blocks anonymous POST /api/shares/plain (401)", async () => {
    const res = await fetch(`${BASE_URL}/api/shares/plain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hello anonymous" })
    });
    if (res.status !== 401) {
      throw new Error(`Expected 401, got ${res.status}`);
    }
    const data = await res.json();
    if (data.reason !== "missing") {
      throw new Error(`Expected reason 'missing', got: ${JSON.stringify(data)}`);
    }
  });

  // 5. Test request with invalid API key -> 401
  await assertTest("Middleware blocks invalid secret key (401)", async () => {
    const res = await fetch(`${BASE_URL}/api/shares/plain`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "snx_sec_invalid_fake_key_12345"
      },
      body: JSON.stringify({ text: "Hello fake" })
    });
    if (res.status !== 401) {
      throw new Error(`Expected 401, got ${res.status}`);
    }
    const data = await res.json();
    if (data.reason !== "invalid") {
      throw new Error(`Expected reason 'invalid', got: ${JSON.stringify(data)}`);
    }
  });

  // 6. Test request with valid API key -> 201
  await assertTest("Middleware permits POST /api/shares/plain with valid x-api-key (201)", async () => {
    const res = await fetch(`${BASE_URL}/api/shares/plain`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": createdApiKey
      },
      body: JSON.stringify({ text: "# Protected Note with Secret Key" })
    });
    if (res.status !== 201) {
      const text = await res.text();
      throw new Error(`Expected 201, got ${res.status}: ${text}`);
    }
    const data = await res.json();
    if (!data.shareId || !data.url) {
      throw new Error(`Missing shareId or url: ${JSON.stringify(data)}`);
    }
    testShareId = data.shareId;
  });

  // 7. Test GET /api/shares/:shareId with Authorization: Bearer <key> -> 200
  await assertTest("Middleware permits GET /api/shares/[id] with Bearer token (200)", async () => {
    const res = await fetch(`${BASE_URL}/api/shares/${testShareId}`, {
      headers: {
        Authorization: `Bearer ${createdApiKey}`
      }
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
    const data = await res.json();
    if (data.shareId !== testShareId) {
      throw new Error(`Share ID mismatch: ${JSON.stringify(data)}`);
    }
  });

  // 8. Revoke the API key via admin API
  await assertTest("Admin API revokes Secret Key", async () => {
    const res = await fetch(`${BASE_URL}/api/admin/keys/${createdKeyId}`, {
      method: "DELETE",
      headers: { Authorization: BASIC_AUTH }
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
    const data = await res.json();
    if (!data.success) {
      throw new Error(`Revoke unsuccessful: ${JSON.stringify(data)}`);
    }
  });

  // 9. Test request with revoked API key -> 403
  await assertTest("Middleware blocks revoked secret key (403 Forbidden)", async () => {
    const res = await fetch(`${BASE_URL}/api/shares/plain`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": createdApiKey
      },
      body: JSON.stringify({ text: "Should be blocked" })
    });
    if (res.status !== 403) {
      throw new Error(`Expected 403, got ${res.status}`);
    }
    const data = await res.json();
    if (data.reason !== "revoked") {
      throw new Error(`Expected reason 'revoked', got: ${JSON.stringify(data)}`);
    }
  });

  console.log("\n ALL TESTS COMPLETED SUCCESSFULLY!");
}

run();
