import { useEffect, useState } from "react";

interface EdoInvoice {
  id: string; creditor: { name: string; bin: string }; debtor: { name: string; bin: string };
  description: string; amountKzt: number; usdtEquivalent: number; issueDate: string; dueDate: string; status: string;
}
interface Props { onImport: (data: { debtorName: string; amount: number; dueDate: string }) => void; }

export default function EdoImport({ onImport }: Props) {
  const [invoices, setInvoices] = useState<EdoInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/edo/invoices").then(r => r.json()).then(d => setInvoices(d.invoices || [])).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div className="skeleton" style={{ height: 20, width: "40%" }} />
      {[1,2].map(i => <div key={i} className="skeleton" style={{ height: 56 }} />)}
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-5)" }}>
        <span style={{ fontSize: "1.3rem" }}>📋</span>
        <div>
          <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600 }}>Import from EDO</h3>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Pull invoices directly from your Electronic Document Operator</p>
        </div>
      </div>

      {!invoices.length ? (
        <div className="alert alert-info">No EDO invoices found. Make sure your EDO account is connected.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {invoices.map(inv => (
            <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--space-4)", background: "var(--surface-offset)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{inv.id}</span>
                  <span className="badge badge-gray">{inv.status}</span>
                </div>
                <p style={{ fontSize: "var(--text-sm)", fontWeight: 500 }}>{inv.debtor.name}</p>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{inv.description} · Due: {inv.dueDate}</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "var(--space-2)" }}>
                <p style={{ fontSize: "var(--text-base)", fontWeight: 700 }}>{inv.usdtEquivalent.toLocaleString()} USDT</p>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{inv.amountKzt.toLocaleString()} KZT</p>
                <button className="btn btn-primary btn-sm" onClick={() => onImport({ debtorName: inv.debtor.name, amount: inv.usdtEquivalent, dueDate: inv.dueDate })}>
                  Import →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
