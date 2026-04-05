import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useInvoiceProgram, Invoice } from "../../hooks/useInvoice";
import StatusBadge from "../shared/StatusBadge";
import RiskBadge from "../shared/RiskBadge";

export default function InvoiceMarketplace() {
  const { fetchAllInvoices } = useInvoiceProgram();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAllInvoices()
      .then((all) => setInvoices(all.filter((i) => i.status === "Funding")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading marketplace...</p>;
  if (!invoices.length) return <p style={{ color: "#888" }}>No invoices available for funding.</p>;

  return (
    <div>
      <h3>Invoice Marketplace</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
        {invoices.map((inv) => {
          const total = Number(inv.totalAmount) / 1e6;
          const funded = Number(inv.fundedAmount) / 1e6;
          const pct = total > 0 ? (funded / total) * 100 : 0;
          const apy = inv.interestRateBps / 100;

          return (
            <div
              key={inv.invoiceId}
              onClick={() => navigate(`/investor/invoice/${inv.invoiceId}`)}
              style={{
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                padding: 16,
                cursor: "pointer",
                transition: "box-shadow 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)")}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <strong>{inv.invoiceId}</strong>
                <StatusBadge status={inv.status} />
              </div>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>
                Debtor: {inv.debtor.slice(0, 8)}...
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>{total.toLocaleString()} USDT</span>
                <span style={{ color: "#1976d2", fontWeight: 600 }}>{apy}% APY</span>
              </div>
              <RiskBadge riskLevel={inv.riskLevel} />
              <div style={{ marginTop: 8 }}>
                <div
                  style={{
                    height: 8,
                    background: "#e0e0e0",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(pct, 100)}%`,
                      background: "#1976d2",
                      borderRadius: 4,
                    }}
                  />
                </div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                  {funded.toLocaleString()} / {total.toLocaleString()} USDT ({pct.toFixed(1)}%)
                </div>
              </div>
              <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>
                Due: {new Date(inv.dueDate * 1000).toLocaleDateString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
