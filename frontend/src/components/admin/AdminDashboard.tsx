import { useEffect, useState } from "react";
import { useInvoiceProgram, Invoice } from "../../hooks/useInvoice";
import InvoiceManagement from "./InvoiceManagement";
import PoolManagement from "./PoolManagement";

export default function AdminDashboard() {
  const { fetchAllInvoices } = useInvoiceProgram();
  const [stats, setStats] = useState({ total: 0, funding: 0, funded: 0, repaid: 0, defaulted: 0, totalValue: 0 });

  useEffect(() => {
    fetchAllInvoices().then((all) => {
      setStats({
        total: all.length,
        funding: all.filter((i) => i.status === "Funding").length,
        funded: all.filter((i) => i.status === "Funded" || i.status === "Advanced").length,
        repaid: all.filter((i) => i.status === "Repaid").length,
        defaulted: all.filter((i) => i.status === "Defaulted").length,
        totalValue: all.reduce((s, i) => s + Number(i.totalAmount), 0) / 1e6,
      });
    });
  }, []);

  const cards = [
    { label: "Total Invoices", value: stats.total, color: "#1976d2" },
    { label: "Funding", value: stats.funding, color: "#2196f3" },
    { label: "Funded/Advanced", value: stats.funded, color: "#ff9800" },
    { label: "Repaid", value: stats.repaid, color: "#4caf50" },
    { label: "Defaulted", value: stats.defaulted, color: "#f44336" },
    { label: "Total Value (USDT)", value: stats.totalValue.toLocaleString(), color: "#333" },
  ];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
        {cards.map((c) => (
          <div
            key={c.label}
            style={{
              padding: 16,
              borderRadius: 8,
              border: `2px solid ${c.color}`,
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 12, color: "#666" }}>{c.label}</div>
          </div>
        ))}
      </div>

      <InvoiceManagement />
      <div style={{ marginTop: 24 }}>
        <PoolManagement />
      </div>
    </div>
  );
}
