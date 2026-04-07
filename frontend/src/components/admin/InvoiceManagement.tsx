import { useEffect, useState } from "react";
import { useInvoiceProgram, Invoice } from "../../hooks/useInvoice";
import { useRefreshListener, emitRefresh } from "../../hooks/useRefresh";
import StatusBadge from "../shared/StatusBadge";

export default function InvoiceManagement() {
  const { fetchAllInvoices, advanceInvoice, repayInvoice, defaultInvoice } = useInvoiceProgram();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionResult, setActionResult] = useState<Record<string, string>>({});
  const tick = useRefreshListener();

  useEffect(() => {
    fetchAllInvoices().then(setInvoices).finally(() => setLoading(false));
  }, [tick]);

  async function doAction(fn: () => Promise<string>, id: string) {
    try {
      const tx = await fn();
      setActionResult(p => ({ ...p, [id]: `✓ TX: ${tx.slice(0, 16)}...` }));
      emitRefresh();
    } catch (e: any) {
      setActionResult(p => ({ ...p, [id]: `⚠ ${e.message}` }));
    }
  }

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 48 }} />)}
    </div>
  );
  if (!invoices.length) return (
    <div className="empty-state">
      <div className="empty-state-icon">📭</div>
      <h3>No invoices yet</h3>
      <p>Invoices submitted by suppliers will appear here.</p>
    </div>
  );

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>ID</th><th>Amount</th><th>Funded</th><th>Status</th><th>APY</th><th>Due</th><th>Actions</th></tr>
        </thead>
        <tbody>
          {invoices.map(inv => {
            const total = Number(inv.totalAmount) / 1e6;
            const funded = Number(inv.fundedAmount) / 1e6;
            const canAdvance = inv.status === "Funded" && !inv.advancePaid;
            const canRepay = inv.status === "Advanced" || inv.status === "Funded";
            const canDefault = inv.status === "Funded" || inv.status === "Advanced";
            return (
              <tr key={inv.invoiceId}>
                <td><span style={{ fontFamily:"monospace", fontSize:"var(--text-xs)" }}>{inv.invoiceId.slice(0,14)}...</span></td>
                <td><strong>{total.toLocaleString()}</strong></td>
                <td>{funded.toLocaleString()}</td>
                <td><StatusBadge status={inv.status} /></td>
                <td style={{ color: "var(--success)", fontWeight: 600 }}>{inv.interestRateBps / 100}%</td>
                <td style={{ fontSize:"var(--text-xs)" }}>{new Date(inv.dueDate * 1000).toLocaleDateString()}</td>
                <td>
                  <div style={{ display:"flex", gap:"var(--space-1)", flexWrap:"wrap" }}>
                    {canAdvance && (
                      <button className="btn btn-primary btn-sm" onClick={() => doAction(() => advanceInvoice(inv.invoiceId), inv.invoiceId)}>Pay Advance</button>
                    )}
                    {canRepay && (
                      <button className="btn btn-ghost btn-sm" onClick={() => doAction(() => repayInvoice(inv.invoiceId), inv.invoiceId)}>Mark Repaid</button>
                    )}
                    {canDefault && (
                      <button className="btn btn-danger btn-sm" onClick={() => doAction(() => defaultInvoice(inv.invoiceId), inv.invoiceId)}>Default</button>
                    )}
                  </div>
                  {actionResult[inv.invoiceId] && (
                    <p style={{ fontSize:"var(--text-xs)", marginTop:4, color:"var(--text-muted)" }}>{actionResult[inv.invoiceId]}</p>
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
