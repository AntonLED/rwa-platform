import { useEffect, useState } from "react";
import { useInvoiceProgram } from "../../hooks/useInvoice";
import { useRefreshListener } from "../../hooks/useRefresh";
import InvoiceManagement from "./InvoiceManagement";
import PoolManagement from "./PoolManagement";
import WhitelistManagement from "./WhitelistManagement";

type Tab = "overview" | "invoices" | "pools" | "kyc";

export default function AdminDashboard() {
  const { fetchAllInvoices } = useInvoiceProgram();
  const [stats, setStats] = useState({ total: 0, funding: 0, funded: 0, repaid: 0, defaulted: 0, totalValue: 0 });
  const [tab, setTab] = useState<Tab>("overview");
  const tick = useRefreshListener();

  useEffect(() => {
    fetchAllInvoices().then(all => {
      setStats({
        total: all.length,
        funding: all.filter(i => i.status === "Funding").length,
        funded: all.filter(i => i.status === "Funded" || i.status === "Advanced").length,
        repaid: all.filter(i => i.status === "Repaid").length,
        defaulted: all.filter(i => i.status === "Defaulted").length,
        totalValue: all.reduce((s, i) => s + Number(i.totalAmount), 0) / 1e6,
      });
    }).catch(() => {});
  }, [tick]);

  const health = stats.total > 0 ? ((stats.repaid / stats.total) * 100).toFixed(1) : "—";

  return (
    <div className="container" style={{ paddingTop: "var(--space-8)", paddingBottom: "var(--space-12)" }}>
      {/* PAGE HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-8)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div style={{
            width: 44, height: 44, borderRadius: "var(--radius-lg)",
            background: "var(--admin-subtle)", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.3rem",
          }}>⚙️</div>
          <div>
            <h1 style={{ fontSize: "var(--text-xl)", fontWeight: 700, lineHeight: 1.1 }}>Admin Panel</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>Platform management & risk control</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <span className="badge badge-green">🟢 Platform Active</span>
          <span className="badge badge-blue">Solana Devnet</span>
        </div>
      </div>

      {/* STATS GRID */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-8)" }}>
        {[
          { label: "Total Invoices", value: stats.total, color: "var(--text)" },
          { label: "Collecting Funds", value: stats.funding, color: "var(--primary)" },
          { label: "Funded / Advanced", value: stats.funded, color: "var(--warning)" },
          { label: "Repaid", value: stats.repaid, color: "var(--success)" },
          { label: "Defaulted", value: stats.defaulted, color: "var(--error)" },
          { label: "Platform TVL", value: `$${stats.totalValue.toLocaleString()}`, color: "var(--text)" },
          { label: "Repayment Rate", value: `${health}%`, color: Number(health) > 80 ? "var(--success)" : "var(--warning)" },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <span className="stat-label">{s.label}</span>
            <span className="stat-value" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* TABS */}
      <div className="tabs" style={{ marginBottom: "var(--space-6)" }}>
        {([
          { id: "overview", label: "📊 Overview" },
          { id: "invoices", label: "📄 Invoice Management" },
          { id: "pools", label: "🏦 Pool Management" },
          { id: "kyc", label: "🔒 KYC Whitelist" },
        ] as const).map(t => (
          <button key={t.id} className={`tab-btn ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-6)" }}>
          {/* PIPELINE */}
          <div className="card">
            <h2 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-5)" }}>📈 Invoice Pipeline</h2>
            {[
              { label: "Funding", value: stats.funding, max: stats.total, color: "var(--primary)" },
              { label: "Funded / Advanced", value: stats.funded, max: stats.total, color: "var(--warning)" },
              { label: "Repaid", value: stats.repaid, max: stats.total, color: "var(--success)" },
              { label: "Defaulted", value: stats.defaulted, max: stats.total, color: "var(--error)" },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: "var(--space-4)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-1)" }}>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>{item.label}</span>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>{item.value} / {item.max}</span>
                </div>
                <div className="progress-wrap">
                  <div className="progress-bar" style={{ width: item.max > 0 ? `${(item.value / item.max) * 100}%` : "0%", background: item.color }} />
                </div>
              </div>
            ))}
          </div>

          {/* RISK & COMPLIANCE */}
          <div className="card">
            <h2 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-5)" }}>🛡 Risk & Compliance</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              {[
                { icon: "✅", label: "KYC/KYB Provider", val: "Sumsub (Mock Mode)", color: "var(--success)" },
                { icon: "🔗", label: "Blockchain", val: "Solana Devnet", color: "var(--primary)" },
                { icon: "🏦", label: "USDT Contract", val: "Es9vM...NYB", color: "var(--text-muted)" },
                { icon: "⚡", label: "Network Status", val: "Active", color: "var(--success)" },
                { icon: "🌍", label: "Regulatory Framework", val: "AIFC / AFSA (KZ)", color: "var(--admin)" },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBlock: "var(--space-2)", borderBottom: "1px solid var(--divider)" }}>
                  <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>{r.icon} {r.label}</span>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: r.color }}>{r.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "invoices" && <InvoiceManagement />}
      {tab === "pools" && <PoolManagement />}
      {tab === "kyc" && <WhitelistManagement />}
    </div>
  );
}
