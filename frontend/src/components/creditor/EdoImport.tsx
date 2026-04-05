import { useEffect, useState } from "react";

interface EdoInvoice {
  id: string;
  creditor: { name: string; bin: string };
  debtor: { name: string; bin: string };
  description: string;
  amountKzt: number;
  usdtEquivalent: number;
  issueDate: string;
  dueDate: string;
  status: string;
}

interface Props {
  onImport: (data: { debtorName: string; amount: number; dueDate: string }) => void;
}

export default function EdoImport({ onImport }: Props) {
  const [invoices, setInvoices] = useState<EdoInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/edo/invoices")
      .then((r) => r.json())
      .then((data) => setInvoices(data.invoices || []))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading EDO invoices...</p>;

  return (
    <div style={{ padding: 16, border: "1px solid #e0e0e0", borderRadius: 8 }}>
      <h3 style={{ marginTop: 0 }}>Import from EDO</h3>
      {!invoices.length && <p style={{ color: "#888" }}>No EDO invoices found.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {invoices.map((inv) => (
          <div
            key={inv.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 12,
              background: "#fafafa",
              borderRadius: 6,
              border: "1px solid #eee",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{inv.id}</div>
              <div style={{ fontSize: 13, color: "#666" }}>
                {inv.debtor.name} — {inv.usdtEquivalent.toLocaleString()} USDT
              </div>
              <div style={{ fontSize: 12, color: "#999" }}>
                {inv.description} | Due: {inv.dueDate}
              </div>
              <div style={{ fontSize: 12, color: inv.status === "confirmed" ? "#2e7d32" : "#ff9800" }}>
                {inv.status}
              </div>
            </div>
            <button
              onClick={() =>
                onImport({
                  debtorName: inv.debtor.name,
                  amount: inv.usdtEquivalent,
                  dueDate: inv.dueDate,
                })
              }
              style={{
                padding: "6px 16px",
                background: "#1976d2",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 13,
                whiteSpace: "nowrap",
              }}
            >
              Import
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
