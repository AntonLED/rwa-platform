import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInvoiceProgram, Invoice } from "../../hooks/useInvoice";
import { useRefreshListener } from "../../hooks/useRefresh";
import StatusBadge from "../shared/StatusBadge";

export default function InvoiceMarketplace() {
  const { fetchAllInvoices } = useInvoiceProgram();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const tick = useRefreshListener();

  useEffect(() => {
    fetchAllInvoices()
      .then((all) => setInvoices(all.filter((i) => i.status === "Funding")))
      .finally(() => setLoading(false));
  }, [tick]);

  if (loading) return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "var(--space-4)" }}>
      {[1,2,3].map(i => (
        <div key={i} className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div className="skeleton" style={{ height: 20, width: "60%" }} />
          <div className="skeleton" style={{ height: 14, width: "40%" }} />
          <div className="skeleton" style={{ height: 8, width: "100%" }} />
          <div className="skeleton" style={{ height: 36, width: "100%" }} />
        </div>
      ))}
    </div>
  );

  if (!invoices.length) return (
    <div className="empty-state">
      <div className="empty-state-icon">📭</div>
      <h3>No invoices available</h3>
      <p>Check back soon — suppliers are uploading new invoices for funding.</p>
    </div>
  );

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "var(--space-4)" }}>
      {invoices.map((inv) => {
        const total = Number(inv.totalAmount) / 1e6;
        const funded = Number(inv.fundedAmount) / 1e6;
        const pct = total > 0 ? (funded / total) * 100 : 0;
        const apy = inv.interestRateBps / 100;
        const daysLeft = Math.ceil((inv.dueDate * 1000 - Date.now()) / 86400000);

        return (
          <div
            key={inv.invoiceId}
            className="card card-hover"
            onClick={() => navigate(`/investor/invoice/${inv.invoiceId}`)}
            style={{ cursor: "pointer", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}
          >
            {/* TOP ROW */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 500, marginBottom: 4 }}>
                  {inv.invoiceId.slice(0, 18)}...
                </p>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>
                  Debtor: {inv.debtor.slice(0, 8)}...
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <StatusBadge status={inv.status} />
              </div>
            </div>

            {/* APY + AMOUNT */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Total Amount</p>
                <p style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{total.toLocaleString()} <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 400 }}>USDT</span></p>
              </div>
              <div style={{
                background: "var(--success-subtle)", color: "var(--success)",
                borderRadius: "var(--radius-lg)", padding: "var(--space-2) var(--space-4)",
                textAlign: "center",
              }}>
                <p style={{ fontSize: "var(--text-xl)", fontWeight: 700, lineHeight: 1 }}>{apy}%</p>
                <p style={{ fontSize: "var(--text-xs)", fontWeight: 500 }}>APY</p>
              </div>
            </div>

            {/* PROGRESS */}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                  Funded: <strong>{funded.toLocaleString()}</strong> / {total.toLocaleString()} USDT
                </span>
                <span style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--primary)" }}>{pct.toFixed(1)}%</span>
              </div>
              <div className="progress-wrap">
                <div className="progress-bar" style={{ width: `${pct}%` }} />
              </div>
            </div>

            {/* FOOTER */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "var(--space-2)", borderTop: "1px solid var(--divider)" }}>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                📅 Due: {new Date(inv.dueDate * 1000).toLocaleDateString()}
              </span>
              <span style={{ fontSize: "var(--text-xs)", color: daysLeft < 14 ? "var(--error)" : "var(--text-muted)", fontWeight: 600 }}>
                {daysLeft}d left
              </span>
            </div>

            <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
              Fund This Invoice →
            </button>
          </div>
        );
      })}
    </div>
  );
}
