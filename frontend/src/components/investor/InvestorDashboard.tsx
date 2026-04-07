import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import InvoiceMarketplace from "./InvoiceMarketplace";
import InvoiceDetail from "./InvoiceDetail";
import Portfolio from "./Portfolio";

export default function InvestorDashboard() {
  const [tab, setTab] = useState<"marketplace" | "portfolio">("marketplace");
  return (
    <div className="container" style={{ paddingTop: "var(--space-8)", paddingBottom: "var(--space-12)" }}>
      {/* PAGE HEADER */}
      <div style={{ marginBottom: "var(--space-8)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-2)" }}>
          <div style={{
            width: 44, height: 44, borderRadius: "var(--radius-lg)",
            background: "var(--investor-subtle)", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.3rem",
          }}>📈</div>
          <div>
            <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 700, lineHeight: 1.1 }}>Investor Portal</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>Real Yield backed by Kazakhstan SME invoices</p>
          </div>
        </div>
      </div>

      {/* STATS ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-8)" }}>
        {[
          { label: "Available APY", value: "12–15%", sub: "Real yield, not speculative", accent: "var(--success)" },
          { label: "Active Invoices", value: "—", sub: "Funding right now" },
          { label: "Avg. Duration", value: "30–90d", sub: "Short-term, high velocity" },
          { label: "Network", value: "Solana", sub: "< $0.001 per transaction", accent: "var(--primary)" },
        ].map((s) => (
          <div className="stat-card" key={s.label}>
            <span className="stat-label">{s.label}</span>
            <span className="stat-value" style={s.accent ? { color: s.accent } : {}}>{s.value}</span>
            <span className="stat-sub">{s.sub}</span>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="tabs" style={{ marginBottom: "var(--space-6)" }}>
        {(["marketplace", "portfolio"] as const).map((t) => (
          <button key={t} className={`tab-btn ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {t === "marketplace" ? "🏪 Marketplace" : "💼 My Portfolio"}
          </button>
        ))}
      </div>

      <Routes>
        <Route path="invoice/:id" element={<InvoiceDetail />} />
        <Route path="*" element={
          tab === "marketplace" ? <InvoiceMarketplace /> : <Portfolio />
        } />
      </Routes>
    </div>
  );
}
