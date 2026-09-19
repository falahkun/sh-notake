"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Login gagal");
      }

      router.push(from);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ padding: "32px 28px" }}>
      {error && (
        <div
          style={{
            marginBottom: "20px",
            padding: "12px 14px",
            background: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            color: "#dc2626",
            fontSize: "14px"
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "18px" }}>
        <div>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: 600,
              marginBottom: "6px",
              color: "#374151"
            }}
          >
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            required
            autoFocus
            style={{
              width: "100%",
              padding: "11px 14px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: "15px"
            }}
          />
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: 600,
              marginBottom: "6px",
              color: "#374151"
            }}
          >
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            style={{
              width: "100%",
              padding: "11px 14px",
              borderRadius: "8px",
              border: "1px solid #d1d5db",
              fontSize: "15px"
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !username.trim() || !password}
          style={{
            marginTop: "6px",
            padding: "12px",
            fontSize: "15px",
            fontWeight: 600,
            borderRadius: "8px"
          }}
        >
          {loading ? "Memproses..." : "Masuk ke Dashboard"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#f7f7f5"
      }}
    >
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <Link
            href="/"
            style={{
              textDecoration: "none",
              fontSize: "13px",
              color: "#6b7280",
              fontWeight: 600,
              display: "inline-block",
              marginBottom: "12px"
            }}
          >
            ← Kembali ke Beranda
          </Link>
          <h1 style={{ fontSize: "28px", fontWeight: 800, margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
            Administrator Login
          </h1>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "14px" }}>
            Masuk untuk mengelola API secret keys dan konfigurasi sistem.
          </p>
        </div>

        <Suspense fallback={<div className="card" style={{ padding: "32px", textAlign: "center" }}>Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
