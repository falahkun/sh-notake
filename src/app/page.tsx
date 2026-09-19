 "use client";

import { useState } from "react";
import { encryptNote } from "@/lib/crypto";

export default function HomePage() {
  const [markdown, setMarkdown] = useState("# My note\n\nWrite something here...");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function publish() {
    setBusy(true);
    try {
      const encrypted = await encryptNote(markdown);
      const response = await fetch("/api/shares", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ciphertext: encrypted.ciphertext, iv: encrypted.iv })
      });
      if (!response.ok) throw new Error("Failed to create share");
      const data = await response.json();
      setUrl(`${location.origin}/s/${data.shareId}#${encrypted.key}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <section className="hero">
        <span className="eyebrow">PRIVATE SHARING</span>
        <h1>Share a note without handing the server the key.</h1>
        <p>Encryption happens in the browser. The decryption key stays in the URL fragment.</p>
      </section>
      <section className="card">
        <textarea value={markdown} onChange={(e) => setMarkdown(e.target.value)} aria-label="Markdown note" />
        <button onClick={publish} disabled={busy || !markdown.trim()}>
          {busy ? "Publishing..." : "Publish securely"}
        </button>
        {url && <div className="result"><small>Share URL</small><code>{url}</code></div>}
      </section>
    </main>
  );
}
