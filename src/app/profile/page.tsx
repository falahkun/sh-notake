"use client";

import { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";

export default function ProfilePage() {
  const [username, setUsername] = useState<string>("admin");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.username) {
          setUsername(data.username);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 6) {
      setError("Password baru minimal 6 karakter");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password baru tidak cocok");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal mengubah password");
      }

      setSuccess("Password admin berhasil diperbarui!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan saat mengubah password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f5" }}>
      <AdminNav />

      <main style={{ width: "min(680px, calc(100% - 32px))", margin: "0 auto", paddingBottom: "80px" }}>
        <section style={{ marginBottom: "28px" }}>
          <span style={{ fontSize: "12px", letterSpacing: "0.12em", color: "#6b7280", fontWeight: 700 }}>
            ADMINISTRATOR PROFILE
          </span>
          <h1 style={{ fontSize: "32px", fontWeight: 800, margin: "8px 0", letterSpacing: "-0.02em" }}>
            Admin Security & Profile
          </h1>
          <p style={{ color: "#6b7280", fontSize: "15px", margin: 0 }}>
            Kelola kredensial akun administrator. Password disimpan dengan enkripsi PBKDF2 (SHA-512 + Salt unik).
          </p>
        </section>

        {/* ACCOUNT INFO CARD */}
        <section className="card" style={{ marginBottom: "24px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 16px 0" }}>Informasi Akun</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "14px" }}>
            <div>
              <div style={{ color: "#6b7280", fontSize: "12px", textTransform: "uppercase", fontWeight: 600 }}>
                Username
              </div>
              <div style={{ fontWeight: 700, fontSize: "16px", marginTop: "4px", color: "#111827" }}>
                {username}
              </div>
            </div>
            <div>
              <div style={{ color: "#6b7280", fontSize: "12px", textTransform: "uppercase", fontWeight: 600 }}>
                Role
              </div>
              <div style={{ fontWeight: 700, fontSize: "16px", marginTop: "4px", color: "#10b981" }}>
                Super Administrator
              </div>
            </div>
          </div>
        </section>

        {/* CHANGE PASSWORD CARD */}
        <section className="card">
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 16px 0" }}>Ganti Password Admin</h2>

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

          {success && (
            <div
              style={{
                marginBottom: "20px",
                padding: "12px 14px",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                borderRadius: "8px",
                color: "#065f46",
                fontSize: "14px",
                fontWeight: 600
              }}
            >
              ✓ {success}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                Password Saat Ini (Current Password)
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px"
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                Password Baru (New Password)
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                required
                minLength={6}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px"
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                Konfirmasi Password Baru
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
                required
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px"
                }}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                style={{ padding: "10px 20px", fontSize: "14px" }}
              >
                {loading ? "Menyimpan..." : "Simpan Password Baru"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
