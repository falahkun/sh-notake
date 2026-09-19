"use client";

import { useEffect, useState } from "react";
import { AdminNav } from "@/components/admin-nav";

type ApiKeyItem = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
};

type CreatedKey = {
  id: string;
  name: string;
  rawKey: string;
  keyPrefix: string;
  expiresAt: string | null;
};

export default function DashboardPage() {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [expiryDays, setExpiryDays] = useState<string>("30");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);

  async function fetchKeys() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/keys");
      if (!res.ok) {
        throw new Error(`Gagal memuat API keys (HTTP ${res.status})`);
      }
      const data = await res.json();
      setKeys(data.keys || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchKeys();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    try {
      const days = expiryDays === "never" ? null : parseInt(expiryDays, 10);
      const res = await fetch("/api/admin/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), expiresInDays: days })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal membuat key");
      }

      const data = await res.json();
      setCreatedKey(data.key);
      setName("");
      fetchKeys();
    } catch (err: any) {
      alert(err.message || "Error saat membuat key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string, keyName: string) {
    if (!confirm(`Yakin ingin mencabut (revoke) API key "${keyName}"? Aksi ini tidak dapat dibatalkan.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/keys/${id}`, {
        method: "DELETE"
      });

      if (!res.ok) {
        throw new Error("Gagal mencabut key");
      }

      fetchKeys();
    } catch (err: any) {
      alert(err.message || "Error saat mencabut key");
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function getStatus(key: ApiKeyItem) {
    if (key.revokedAt) {
      return { label: "Revoked", color: "#dc2626", bg: "#fee2e2" };
    }
    if (key.expiresAt && new Date(key.expiresAt).getTime() < Date.now()) {
      return { label: "Expired", color: "#d97706", bg: "#fef3c7" };
    }
    return { label: "Active", color: "#16a34a", bg: "#dcfce7" };
  }

  // Calculate statistics
  const totalKeys = keys.length;
  const activeKeys = keys.filter((k) => !k.revokedAt && (!k.expiresAt || new Date(k.expiresAt).getTime() >= Date.now())).length;
  const revokedKeys = keys.filter((k) => Boolean(k.revokedAt)).length;
  const expiredKeys = keys.filter((k) => !k.revokedAt && k.expiresAt && new Date(k.expiresAt).getTime() < Date.now()).length;

  return (
    <div style={{ minHeight: "100vh", background: "#f7f7f5" }}>
      <AdminNav />

      <main style={{ width: "min(960px, calc(100% - 32px))", margin: "0 auto", paddingBottom: "80px" }}>
        <section style={{ marginBottom: "28px" }}>
          <span style={{ fontSize: "12px", letterSpacing: "0.12em", color: "#6b7280", fontWeight: 700 }}>
            ADMINISTRATOR DASHBOARD
          </span>
          <h1 style={{ fontSize: "32px", fontWeight: 800, margin: "8px 0", letterSpacing: "-0.02em" }}>
            API Secret Keys Management
          </h1>
          <p style={{ color: "#6b7280", fontSize: "15px", margin: 0, maxWidth: "680px" }}>
            Kelola secret key untuk memproteksi endpoint API dari akses anonimus dan anomali. Secret key
            dienkripsi menggunakan AES-256-GCM di database dan diverifikasi oleh middleware.
          </p>
        </section>

        {/* METRICS ROW */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px",
            marginBottom: "28px"
          }}
        >
          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: "12px", color: "#6b7280", fontWeight: 600, textTransform: "uppercase" }}>Total Keys</div>
            <div style={{ fontSize: "28px", fontWeight: 800, marginTop: "4px", color: "#111827" }}>{totalKeys}</div>
          </div>
          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: "12px", color: "#16a34a", fontWeight: 600, textTransform: "uppercase" }}>Active Keys</div>
            <div style={{ fontSize: "28px", fontWeight: 800, marginTop: "4px", color: "#16a34a" }}>{activeKeys}</div>
          </div>
          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: "12px", color: "#dc2626", fontWeight: 600, textTransform: "uppercase" }}>Revoked</div>
            <div style={{ fontSize: "28px", fontWeight: 800, marginTop: "4px", color: "#dc2626" }}>{revokedKeys}</div>
          </div>
          <div className="card" style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: "12px", color: "#d97706", fontWeight: 600, textTransform: "uppercase" }}>Expired</div>
            <div style={{ fontSize: "28px", fontWeight: 800, marginTop: "4px", color: "#d97706" }}>{expiredKeys}</div>
          </div>
        </div>

        {/* GENERATE SECRET KEY CARD */}
        <section className="card" style={{ marginBottom: "28px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, margin: "0 0 16px 0" }}>Generate New Secret Key</h2>
          <form onSubmit={handleCreate} style={{ display: "grid", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "6px" }}>
                Key Name / Label
              </label>
              <input
                type="text"
                placeholder="e.g. Production Backend, Mobile Client, Microservice"
                value={name}
                onChange={(e) => setName(e.target.value)}
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
                Expiration Period
              </label>
              <select
                value={expiryDays}
                onChange={(e) => setExpiryDays(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #d1d5db",
                  fontSize: "14px",
                  background: "#fff"
                }}
              >
                <option value="7">7 Hari</option>
                <option value="30">30 Hari (Direkomendasikan)</option>
                <option value="90">90 Hari</option>
                <option value="365">1 Tahun</option>
                <option value="never">Tanpa Batas Waktu (Never Expire)</option>
              </select>
            </div>

            <div>
              <button
                type="submit"
                disabled={creating || !name.trim()}
                style={{ padding: "10px 18px", fontSize: "14px" }}
              >
                {creating ? "Membuat..." : "Generate Secret Key"}
              </button>
            </div>
          </form>

          {/* CREATED KEY MODAL/ALERT */}
          {createdKey && (
            <div
              style={{
                marginTop: "20px",
                padding: "16px",
                background: "#ecfdf5",
                border: "1px solid #10b981",
                borderRadius: "12px"
              }}
            >
              <div style={{ color: "#065f46", fontWeight: "bold", fontSize: "15px", marginBottom: "6px" }}>
                Secret Key Berhasil Dibuat!
              </div>
              <p style={{ margin: "0 0 10px 0", fontSize: "13px", color: "#047857" }}>
                <strong>PENTING:</strong> Simpan secret key ini sekarang. Demi alasan keamanan, secret key
                dienkripsi saat disimpan di database dan <strong>tidak akan pernah ditampilkan lagi</strong> setelah halaman ditutup.
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  background: "#ffffff",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #a7f3d0"
                }}
              >
                <code style={{ flex: 1, wordBreak: "break-all", fontSize: "14px", color: "#111827", fontWeight: 600 }}>
                  {createdKey.rawKey}
                </code>
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdKey.rawKey)}
                  style={{ padding: "6px 14px", fontSize: "13px" }}
                >
                  {copied ? "Copied!" : "Copy Key"}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* REGISTERED KEYS LIST */}
        <section className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 700, margin: 0 }}>Registered Secret Keys</h2>
            <button
              onClick={fetchKeys}
              type="button"
              style={{ background: "#f3f4f6", color: "#374151", padding: "6px 14px", fontSize: "13px" }}
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <p style={{ color: "#6b7280" }}>Memuat daftar keys...</p>
          ) : error ? (
            <div style={{ color: "#dc2626", padding: "12px", background: "#fee2e2", borderRadius: "8px" }}>
              {error}
            </div>
          ) : keys.length === 0 ? (
            <p style={{ color: "#6b7280", margin: "20px 0" }}>Belum ada secret key yang terdaftar.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e5e7eb", color: "#4b5563" }}>
                    <th style={{ padding: "10px 8px" }}>Nama Key</th>
                    <th style={{ padding: "10px 8px" }}>Prefix</th>
                    <th style={{ padding: "10px 8px" }}>Status</th>
                    <th style={{ padding: "10px 8px" }}>Dibuat</th>
                    <th style={{ padding: "10px 8px" }}>Kadaluarsa</th>
                    <th style={{ padding: "10px 8px" }}>Terakhir Dipakai</th>
                    <th style={{ padding: "10px 8px", textAlign: "right" }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => {
                    const status = getStatus(k);
                    const isRevoked = Boolean(k.revokedAt);
                    return (
                      <tr key={k.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "12px 8px", fontWeight: 600 }}>{k.name}</td>
                        <td style={{ padding: "12px 8px" }}>
                          <code style={{ background: "#f3f4f6", padding: "3px 8px", borderRadius: "4px", fontSize: "13px" }}>
                            {k.keyPrefix}
                          </code>
                        </td>
                        <td style={{ padding: "12px 8px" }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "3px 10px",
                              borderRadius: "9999px",
                              fontSize: "12px",
                              fontWeight: 600,
                              color: status.color,
                              background: status.bg
                            }}
                          >
                            {status.label}
                          </span>
                        </td>
                        <td style={{ padding: "12px 8px", color: "#6b7280" }}>
                          {new Date(k.createdAt).toLocaleDateString("id-ID")}
                        </td>
                        <td style={{ padding: "12px 8px", color: "#6b7280" }}>
                          {k.expiresAt ? new Date(k.expiresAt).toLocaleDateString("id-ID") : "Never"}
                        </td>
                        <td style={{ padding: "12px 8px", color: "#6b7280" }}>
                          {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("id-ID") : "Belum pernah"}
                        </td>
                        <td style={{ padding: "12px 8px", textAlign: "right" }}>
                          {!isRevoked && (
                            <button
                              type="button"
                              onClick={() => handleRevoke(k.id, k.name)}
                              style={{
                                background: "#fff",
                                border: "1px solid #ef4444",
                                color: "#ef4444",
                                padding: "4px 10px",
                                fontSize: "12px",
                                fontWeight: 600
                              }}
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
