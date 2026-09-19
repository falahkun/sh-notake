"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    try {
      setLoggingOut(true);
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    } finally {
      setLoggingOut(false);
    }
  }

  const linkStyle = (active: boolean): React.CSSProperties => ({
    padding: "8px 14px",
    borderRadius: "8px",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: 600,
    color: active ? "#111827" : "#6b7280",
    background: active ? "#f3f4f6" : "transparent",
    transition: "all 0.15s ease"
  });

  return (
    <header
      style={{
        borderBottom: "1px solid #e5e7eb",
        background: "#ffffff",
        marginBottom: "32px",
        position: "sticky",
        top: 0,
        zIndex: 50
      }}
    >
      <div
        style={{
          width: "min(960px, calc(100% - 32px))",
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: "64px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          <Link
            href="/dashboard"
            style={{
              textDecoration: "none",
              color: "#111827",
              fontWeight: 800,
              fontSize: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: "#10b981",
                display: "inline-block"
              }}
            />
            Share Note SX <span style={{ fontWeight: 400, color: "#6b7280" }}>Admin</span>
          </Link>

          <nav style={{ display: "flex", gap: "8px" }}>
            <Link href="/dashboard" style={linkStyle(pathname === "/dashboard" || pathname === "/admin")}>
              Dashboard
            </Link>
            <Link href="/profile" style={linkStyle(pathname === "/profile")}>
              Profile
            </Link>
          </nav>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link
            href="/"
            target="_blank"
            style={{
              textDecoration: "none",
              fontSize: "13px",
              color: "#6b7280",
              fontWeight: 500,
              padding: "6px 12px",
              borderRadius: "6px"
            }}
          >
            Open App ↗
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            type="button"
            style={{
              background: "#fff",
              border: "1px solid #d1d5db",
              color: "#374151",
              fontSize: "13px",
              padding: "6px 14px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: 600
            }}
          >
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </div>
      </div>
    </header>
  );
}
