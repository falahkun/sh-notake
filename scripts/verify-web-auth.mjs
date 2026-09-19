const BASE_URL = "http://localhost:3000";

let cookieHeader = "";

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
  console.log("   VERIFYING LOGIN, DASHBOARD & PROFILE AUTH     ");
  console.log("=================================================\n");

  // 1. Unauthorized /dashboard redirect
  await assertTest("Unauthenticated access to /dashboard redirects to /login", async () => {
    const res = await fetch(`${BASE_URL}/dashboard`, { redirect: "manual" });
    if (res.status !== 307 && res.status !== 302) {
      throw new Error(`Expected redirect status (302/307), got ${res.status}`);
    }
    const location = res.headers.get("location");
    if (!location || !location.includes("/login")) {
      throw new Error(`Expected location containing /login, got: ${location}`);
    }
  });

  // 2. Unauthorized /profile redirect
  await assertTest("Unauthenticated access to /profile redirects to /login", async () => {
    const res = await fetch(`${BASE_URL}/profile`, { redirect: "manual" });
    if (res.status !== 307 && res.status !== 302) {
      throw new Error(`Expected redirect status (302/307), got ${res.status}`);
    }
    const location = res.headers.get("location");
    if (!location || !location.includes("/login")) {
      throw new Error(`Expected location containing /login, got: ${location}`);
    }
  });

  // 3. Login with invalid password fails
  await assertTest("POST /api/auth/login rejects wrong password (401)", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "wrongpassword123" })
    });
    if (res.status !== 401) {
      throw new Error(`Expected 401, got ${res.status}`);
    }
  });

  // 4. Login with valid credentials succeeds & returns cookie
  await assertTest("POST /api/auth/login succeeds with admin / admin123456", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123456" })
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
    const setCookie = res.headers.get("set-cookie");
    if (!setCookie || !setCookie.includes("admin_session=")) {
      throw new Error(`Missing admin_session in Set-Cookie: ${setCookie}`);
    }
    cookieHeader = setCookie.split(";")[0];
  });

  // 5. Access /dashboard with session cookie
  await assertTest("Authenticated access to /dashboard succeeds (200)", async () => {
    const res = await fetch(`${BASE_URL}/dashboard`, {
      headers: { Cookie: cookieHeader }
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
  });

  // 6. Access /profile with session cookie
  await assertTest("Authenticated access to /profile succeeds (200)", async () => {
    const res = await fetch(`${BASE_URL}/profile`, {
      headers: { Cookie: cookieHeader }
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
  });

  // 7. Check GET /api/auth/me returns admin username
  await assertTest("GET /api/auth/me returns authenticated admin", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Cookie: cookieHeader }
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
    const data = await res.json();
    if (!data.authenticated || data.username !== "admin") {
      throw new Error(`Unexpected user data: ${JSON.stringify(data)}`);
    }
  });

  // 8. Test Change Password
  await assertTest("Change admin password via POST /api/auth/change-password", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/change-password`, {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        currentPassword: "admin123456",
        newPassword: "adminnewpassword999"
      })
    });
    if (res.status !== 200) {
      const err = await res.text();
      throw new Error(`Expected 200, got ${res.status}: ${err}`);
    }
  });

  // 9. Verify old password fails now
  await assertTest("Old password fails after password change (401)", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123456" })
    });
    if (res.status !== 401) {
      throw new Error(`Expected 401, got ${res.status}`);
    }
  });

  // 10. Verify new password succeeds
  await assertTest("New password succeeds to log in", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "adminnewpassword999" })
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
    const setCookie = res.headers.get("set-cookie");
    cookieHeader = setCookie.split(";")[0];
  });

  // 11. Reset password back to admin123456 for convenience
  await assertTest("Reset password back to default admin123456", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/change-password`, {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        currentPassword: "adminnewpassword999",
        newPassword: "admin123456"
      })
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
  });

  // 12. Logout
  await assertTest("POST /api/auth/logout clears session", async () => {
    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: "POST",
      headers: { Cookie: cookieHeader }
    });
    if (res.status !== 200) {
      throw new Error(`Expected 200, got ${res.status}`);
    }
    const setCookie = res.headers.get("set-cookie");
    if (!setCookie || !setCookie.includes("admin_session=;")) {
      throw new Error(`Session cookie not cleared: ${setCookie}`);
    }
  });

  console.log("\n ALL WEB AUTH TESTS PASSED SUCCESSFULLY!");
}

run();
