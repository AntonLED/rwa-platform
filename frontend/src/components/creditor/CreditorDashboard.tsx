import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useInvoiceProgram, Invoice } from "../../hooks/useInvoice";
import SubmitInvoice from "./SubmitInvoice";
import EdoImport from "./EdoImport";
import StatusBadge from "../shared/StatusBadge";
import RiskBadge from "../shared/RiskBadge";

export default function CreditorDashboard() {
  const { publicKey } = useWallet();
  const { fetchAllInvoices } = useInvoiceProgram();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [preFill, setPreFill] = useState<{ debtorName: string; amount: number; dueDate: string } | null>(null);
  const [tab, setTab] = useState<"submit" | "edo" | "my">("submit");

  useEffect(() => {
    fetchAllInvoices()
      .then((all) => {
        if (publicKey) {
          setInvoices(all.filter((i) => i.creditor === publicKey.toBase58()));
        } else {
          setInvoices([]);
        }
      })
      .finally(() => setLoading(false));
  }, [publicKey]);

  return (
    <div>
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {(["submit", "edo", "my"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "8px 20px",
              border: "none",
              borderRadius: 6,
              background: tab === t ? "#1976d2" : "#e0e0e0",
              color: tab === t ? "#fff" : "#333",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {t === "submit" ? "Submit Invoice" : t === "edo" ? "EDO Import" : "My Invoices"}
          </button>
        ))}
      </div>

      {tab === "submit" && (
        <SubmitInvoice preFill={preFill} onClearPreFill={() => setPreFill(null)} />
      )}

      {tab === "edo" && (
        <EdoImport
          onImport={(data) => {
            setPreFill(data);
            setTab("submit");
          }}
        />
      )}

      {tab === "my" && (
        <div>
          <h3>My Invoices</h3>
          {loading && <p>Loading...</p>}
          {!loading && !invoices.length && <p style={{ color: "#888" }}>No invoices found.</p>}
          {!loading && invoices.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #e0e0e0", textAlign: "left" }}>
                  <th style={{ padding: 8 }}>ID</th>
                  <th style={{ padding: 8 }}>Amount</th>
                  <th style={{ padding: 8 }}>Funded</th>
                  <th style={{ padding: 8 }}>Status</th>
                  <th style={{ padding: 8 }}>Risk</th>
                  <th style={{ padding: 8 }}>Due</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.invoiceId} style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: 8 }}>{inv.invoiceId}</td>
                    <td style={{ padding: 8 }}>{(Number(inv.totalAmount) / 1e6).toLocaleString()}</td>
                    <td style={{ padding: 8 }}>{(Number(inv.fundedAmount) / 1e6).toLocaleString()}</td>
                    <td style={{ padding: 8 }}><StatusBadge status={inv.status} /></td>
                    <td style={{ padding: 8 }}><RiskBadge riskLevel={inv.riskLevel} /></td>
                    <td style={{ padding: 8 }}>{new Date(inv.dueDate * 1000).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
