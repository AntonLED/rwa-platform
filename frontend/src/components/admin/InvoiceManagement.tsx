import { useEffect, useState } from "react";
import { useInvoiceProgram, Invoice } from "../../hooks/useInvoice";
import { emitRefresh, useRefreshListener } from "../../hooks/useRefresh";
import StatusBadge from "../shared/StatusBadge";
import RiskBadge from "../shared/RiskBadge";

export default function InvoiceManagement() {
  const { fetchAllInvoices } = useInvoiceProgram();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<Record<string, string>>({});
  const tick = useRefreshListener();

  useEffect(() => {
    loadInvoices();
  }, [tick]);

  async function loadInvoices() {
    setLoading(true);
    const all = await fetchAllInvoices();
    setInvoices(all);
    setLoading(false);
  }

  async function doAction(invoiceId: string, action: "advance" | "settle" | "default") {
    setActionLoading(`${invoiceId}-${action}`);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setActionResult((p) => ({ ...p, [invoiceId]: `${action}: ${data.tx?.slice(0, 16)}...` }));
      emitRefresh();
    } catch (e: any) {
      setActionResult((p) => ({ ...p, [invoiceId]: `Error: ${e.message}` }));
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return <p>Loading invoices...</p>;

  return (
    <div>
      <h3>Invoice Management</h3>
      {!invoices.length && <p style={{ color: "#888" }}>No invoices found.</p>}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e0e0e0", textAlign: "left" }}>
            <th style={{ padding: 6 }}>ID</th>
            <th style={{ padding: 6 }}>Amount</th>
            <th style={{ padding: 6 }}>Funded</th>
            <th style={{ padding: 6 }}>Status</th>
            <th style={{ padding: 6 }}>Risk</th>
            <th style={{ padding: 6 }}>Due</th>
            <th style={{ padding: 6 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const canAdvance = inv.status === "Funded";
            const canSettle = inv.status === "Advanced";
            const canDefault = inv.status === "Funded" || inv.status === "Advanced";
            const key = inv.invoiceId;

            return (
              <tr key={key} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: 6 }}>{inv.invoiceId}</td>
                <td style={{ padding: 6 }}>{(Number(inv.totalAmount) / 1e6).toLocaleString()}</td>
                <td style={{ padding: 6 }}>{(Number(inv.fundedAmount) / 1e6).toLocaleString()}</td>
                <td style={{ padding: 6 }}><StatusBadge status={inv.status} /></td>
                <td style={{ padding: 6 }}><RiskBadge riskLevel={inv.riskLevel} /></td>
                <td style={{ padding: 6 }}>{new Date(inv.dueDate * 1000).toLocaleDateString()}</td>
                <td style={{ padding: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {canAdvance && (
                    <ActionBtn
                      label="Advance"
                      color="#e65100"
                      loading={actionLoading === `${key}-advance`}
                      onClick={() => doAction(key, "advance")}
                    />
                  )}
                  {canSettle && (
                    <ActionBtn
                      label="Settle"
                      color="#4caf50"
                      loading={actionLoading === `${key}-settle`}
                      onClick={() => doAction(key, "settle")}
                    />
                  )}
                  {canDefault && (
                    <ActionBtn
                      label="Default"
                      color="#f44336"
                      loading={actionLoading === `${key}-default`}
                      onClick={() => doAction(key, "default")}
                    />
                  )}
                  {actionResult[key] && (
                    <span style={{ fontSize: 11, color: "#666" }}>{actionResult[key]}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ActionBtn({
  label,
  color,
  loading,
  onClick,
}: {
  label: string;
  color: string;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: "3px 10px",
        background: color,
        color: "#fff",
        border: "none",
        borderRadius: 3,
        cursor: "pointer",
        fontSize: 12,
      }}
    >
      {loading ? "..." : label}
    </button>
  );
}
