"use client";

import React, { useEffect, useId, useState } from "react";

let mermaidInitialized = false;

async function getMermaid() {
  const mermaidModule = await import("mermaid");
  const mermaid = mermaidModule.default;
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "loose",
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    });
    mermaidInitialized = true;
  }
  return mermaid;
}

export function MermaidDiagram({ chart }: { chart: string }) {
  const reactId = useId();
  // Create a strictly alphanumeric ID with a unique prefix
  const [diagramId] = useState(() => {
    const cleanId = reactId.replace(/[^a-zA-Z0-9]/g, "");
    const randomSuffix = Math.random().toString(36).substring(2, 9);
    return `mermaid_${cleanId || "chart"}_${randomSuffix}`;
  });

  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function renderChart() {
      try {
        setLoading(true);
        const mermaid = await getMermaid();
        const cleanChart = chart.trim();

        // Render diagram SVG
        const { svg: renderedSvg } = await mermaid.render(diagramId, cleanChart);

        if (active) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (err: unknown) {
        if (active) {
          console.error("Mermaid diagram render error:", err);
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
        // Cleanup potential residual DOM elements created by mermaid
        const tempEl = document.getElementById(diagramId);
        if (tempEl) tempEl.remove();
        const tempErr = document.getElementById(`d${diagramId}`);
        if (tempErr) tempErr.remove();
      }
    }

    renderChart();

    return () => {
      active = false;
      const tempEl = document.getElementById(diagramId);
      if (tempEl) tempEl.remove();
      const tempErr = document.getElementById(`d${diagramId}`);
      if (tempErr) tempErr.remove();
    };
  }, [diagramId, chart]);

  if (error) {
    return (
      <div className="mermaid-error card">
        <div className="mermaid-error-title">⚠️ Mermaid Syntax Error</div>
        <pre>
          <code>{chart}</code>
        </pre>
      </div>
    );
  }

  if (loading || !svg) {
    return (
      <div className="mermaid-loading">
        <span>Rendering diagram...</span>
      </div>
    );
  }

  return (
    <div
      className="mermaid-wrapper"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
