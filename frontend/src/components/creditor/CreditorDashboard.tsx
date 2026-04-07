import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useInvoiceProgram, Invoice } from "../../hooks/useInvoice";
import { useRefreshListener } from "../../hooks/useRefresh";
import StatusBadge from "../shared/StatusBadge";
import SubmitInvoice from "./SubmitInvoice";
import EdoImport from "./EdoImport";

type View = "list" | "submit" | "edo";

export default function CreditorDashboard() {
  const { publicKey } = useWallet();
  const { fetchCreditorInvoices } = useInvoiceProgram();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("list");
  const [preFill, setPreFill] = useState<any>(null);
  const tick = useRefreshListener();

  useEffect(() => {
    if (!publicKey) return;
    fetchCreditorInvoices(publicKey.toBase58())
      .then(setInvoices).finally(() => setLoading(false));
  }, [publicKey, tick]);

  if (!publicKey) return (
    <div className="container" style={{ paddingTop: "var(--space-16)" }}>
      <div className="empty-state">
        <div className="empty-state-icon">🔒</div>
        <h3>Connect your wallet</h3>
        <p>Connect Phantom or Solflare to access the Supplier Portal.</p>
      </div>
    </div>
  );

  const stats = {
    total: invoices.length,
    funding: invoices.filter(i => i.status === "Funding").length,
    funded: invoices.filter(i => i.status === "Funded" || i.status === "Advanced").length,
    repaid: invoices.filter(i => i.status === "Repaid").length,
    totalValue: invoices.reduce((s, i) => s + Number(i.totalAmount) / 1e6, 0),
    receivedAdvance: invoices.filter(i => i.advancePaid).reduce((s, i) => s + Number(i.totalAmount) / 1e6 * 0.9, 0),
  };

  return (
    <div className="container" style={{ paddingTop: "var(--space-8)", paddingBottom: "var(--space-12)" }}>
      {/* PAGE HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-8)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <div style={{
            width: 44, height: 44, borderRadius: "var(--radius-lg)",
            background: "var(--creditor-subtle)", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.3rem",
          }}>🏭</div>
          <div>
            <h1 style={{ fontWeight: 700, lineHeight: 1.1 }}>Supplier Portal</h1>
            <p style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)" }}>Convert your invoices into immediate liquidity</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button className={`btn ${view === "edo" ? "btn-primary" : "btn-ghost"}`} onClick={() => setView(v => v === "edo" ? "list" : "edo")}>
            📋 Import from EDO
          </button>
          <button className={`btn ${view === "submit" ? "btn-primary" : "btn-ghost"}`} onClick={() => setView(v => v === "submit" ? "list" : "submit")} style={{ background: view === "submit" ? "var(--creditor)" : undefined }}>
            + New Invoice
          </button>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--space-4)", marginBottom: "var(--space-8)" }}>
        {[
          { label: "Total Invoices", value: stats.total },
          { label: "Collecting Funds", value: stats.funding, accent: "var(--primary)" },
          { label: "Funded / Advanced", value: stats.funded, accent: "var(--warning)" },
          { label: "Repaid", value: stats.repaid, accent: "var(--success)" },
          { label: "Total Value", value: `$${stats.totalValue.toLocaleString()}`, accent: "var(--text)" },
          { label: "Advance Received", value: `$${stats.receivedAdvance.toFixed(0)}`, accent: "var(--success)" },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <span className="stat-label">{s.label}</span>
            <span className="stat-value" style={s.accent ? { color: s.accent } : {}}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* EDO IMPORT PANEL */}
      {view === "edo" && (
        <div className="card" style={{ marginBottom: "var(--space-6)", borderColor: "var(--creditor)", borderWidth: 1.5 }}>
          <EdoImport onImport={(data) => { setPreFill(data); setView("submit"); }} />
        </div>
      )}

      {/* SUBMIT FORM */}
      {view === "submit" && (
        <div className="card" style={{ marginBottom: "var(--space-6)", borderColor: "var(--creditor)", borderWidth: 1.5 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-5)" }}>
            <h2 style={{ fontWeight: 700 }}>Submit New Invoice</h2>
            <button className="btn btn-ghost btn-sm" onClick={() => { setView("list"); setPreFill(null); }}>✕ Cancel</button>
          </div>
          <SubmitInvoice preFill={preFill} onClearPreFill={() => { setPreFill(null); setView("list"); }} />
        </div>
      )}

      {/* INVOICE LIST */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 56 }} />)}
        </div>
      ) : !invoices.length ? (
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <h3>No invoices yet</h3>
          <p>Submit your first invoice to receive advance payment within 24 hours.</p>
          <button className="btn btn-primary" onClick={() => setView("submit")} style={{ marginTop: "var(--space-2)" }}>Submit Invoice</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <h2 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-2)" }}>My Invoices</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Invoice ID</th>
                  <th>Debtor</th>
                  <th>Amount</th>
                  <th>Funded</th>
                  <th>Status</th>
                  <th>Risk</th>
                  <th>Due Date</th>
                  <th>Advance</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => {
                  const total = Number(inv.totalAmount) / 1e6;
                  const funded = Number(inv.fundedAmount) / 1e6;
                  const pct = total > 0 ? (funded / total) * 100 : 0;
                  return (
                    <tr key={inv.invoiceId}>
                      <td><span style={{ fontFamily: "monospace", fontSize: "var(--text-xs)" }}>{inv.invoiceId.slice(0, 14)}...</span></td>
                      <td style={{ fontSize: "var(--text-xs)", fontFamily: "monospace", color: "var(--text-muted)" }}>{inv.debtor.slice(0, 10)}...</td>
                      <td><strong>{total.toLocaleString()}</strong> USDT</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 120 }}>
                          <span style={{ fontSize: "var(--text-xs)" }}>{funded.toLocaleString()} / {total.toLocaleString()}</span>
                          <div className="progress-wrap" style={{ height: 4 }}>
                            <div className="progress-bar" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td><StatusBadge status={inv.status} /></td>
                      <td style={{ color: "var(--success)", fontWeight: 600 }}>{inv.interestRateBps / 100}% APY</td>
                      <td style={{ fontSize: "var(--text-xs)" }}>{new Date(inv.dueDate * 1000).toLocaleDateString()}</td>
                      <td>{inv.advancePaid ? <span className="badge badge-green">✓ Paid</span> : <span className="badge badge-gray">Pending</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
