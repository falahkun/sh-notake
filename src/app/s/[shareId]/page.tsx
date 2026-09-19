 "use client";

import React, { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { decryptNote } from "@/lib/crypto";
import { MermaidDiagram } from "@/components/mermaid";

type Payload = { ciphertext: string; iv: string; expiresAt: string | null };

export default function SharedNotePage({ params }: { params: Promise<{ shareId: string }> }) {
  const [state, setState] = useState<"loading" | "ready" | "not-found" | "expired" | "invalid">("loading");
  const [markdown, setMarkdown] = useState("");

  useEffect(() => {
    (async () => {
      const { shareId } = await params;
      const key = location.hash.slice(1);
      if (!key) {
        setState("invalid");
        return;
      }

      const response = await fetch(`/api/shares/${encodeURIComponent(shareId)}`, { cache: "no-store" });
      if (response.status === 404) return setState("not-found");
      if (response.status === 410) return setState("expired");
      if (!response.ok) return setState("invalid");

      const payload = await response.json() as Payload;
      try {
        const text = await decryptNote(payload.ciphertext, payload.iv, key);
        setMarkdown(text);
        setState("ready");
      } catch {
        setState("invalid");
      }
    })();
  }, [params]);

  if (state !== "ready") {
    const copy = {
      loading: ["Loading note", "Decrypting the shared note..."],
      "not-found": ["Note not found", "This share link does not exist or has been revoked."],
      expired: ["Link expired", "This share link is no longer available."],
      invalid: ["Unable to open note", "The link is incomplete or the decryption key is invalid."]
    }[state];

    return <main className="shell center"><section className="empty card"><h1>{copy[0]}</h1><p>{copy[1]}</p></section></main>;
  }

  return (
    <main className="reading">
      <article className="markdown">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            table: ({ ...props }) => (
              <div className="table-wrapper">
                <table {...props} />
              </div>
            ),
            pre: ({ children, ...props }) => {
              const childArray = React.Children.toArray(children);
              const codeChild = childArray.find(
                (c): c is React.ReactElement<{ className?: string; children?: React.ReactNode }> =>
                  React.isValidElement(c) &&
                  typeof c.props === "object" &&
                  c.props !== null &&
                  Boolean((c.props as { className?: string }).className?.match(/(?:^|\s)language-mermaid(?:\s|$)/i))
              );

              if (codeChild) {
                const rawCode = codeChild.props.children;
                const chart = Array.isArray(rawCode) ? rawCode.join("") : String(rawCode || "");
                return <MermaidDiagram chart={chart} />;
              }

              return <pre {...props}>{children}</pre>;
            },
            code: ({ className, children, ...props }) => {
              if (className && /(?:^|\s)language-mermaid(?:\s|$)/i.test(className)) {
                const chart = Array.isArray(children) ? children.join("") : String(children || "");
                return <MermaidDiagram chart={chart} />;
              }
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {markdown}
        </ReactMarkdown>
      </article>
    </main>
  );
}
