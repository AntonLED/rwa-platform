import { useState } from "react";
import { Routes, Route } from "react-router-dom";
import InvoiceMarketplace from "./InvoiceMarketplace";
import InvoiceDetail from "./InvoiceDetail";
import Portfolio from "./Portfolio";

export default function InvestorDashboard() {
  const [tab, setTab] = useState<"marketplace" | "portfolio">("marketplace");

  return (
    <Routes>
      <Route
        path="invoice/:id"
        element={<InvoiceDetail />}
      />
      <Route
        path="*"
        element={
          <div>
            <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
              {(["marketplace", "portfolio"] as const).map((t) => (
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
                    textTransform: "capitalize",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            {tab === "marketplace" ? <InvoiceMarketplace /> : <Portfolio />}
          </div>
        }
      />
    </Routes>
  );
}
