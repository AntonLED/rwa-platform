import { useState } from "react";
import { usePool } from "../../hooks/usePool";

export default function PoolManagement() {
  const { pools, loading, refetch } = usePool();
  const [initLoading, setInitLoading] = useState(false);
  const [initResult, setInitResult] = useState<string | null>(null);

  async function initPool(riskLevel: number) {
    setInitLoading(true);
    setInitResult(null);
    try {
      const baseRateBps = riskLevel === 0 ? 500 : 1200;
      const markupBps = riskLevel === 0 ? 100 : 300;
      const res = await fetch("/api/pools/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskLevel, baseRateBps, markupBps }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInitResult(`Pool ${riskLevel} initialized: ${data.tx?.slice(0, 16)}...`);
      refetch();
    } catch (e: any) {
      setInitResult(`Error: ${e.message}`);
    } finally {
      setInitLoading(false);
    }
  }

  if (loading) return <p>Loading pools...</p>;

  const hasLow = pools.some((p) => p.riskLevel === 0);
  const hasHigh = pools.some((p) => p.riskLevel === 1);

  return (
    <div>
      <h3>Pool Management</h3>
      {pools.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, marginBottom: 16 }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #e0e0e0", textAlign: "left" }}>
              <th style={{ padding: 8 }}>Risk Level</th>
              <th style={{ padding: 8 }}>Base Rate</th>
              <th style={{ padding: 8 }}>Markup</th>
              <th style={{ padding: 8 }}>Total Invoices</th>
              <th style={{ padding: 8 }}>Total Funded</th>
            </tr>
          </thead>
          <tbody>
            {pools.map((p) => (
              <tr key={p.riskLevel} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: 8 }}>{p.riskLevel === 0 ? "Low" : "High"}</td>
                <td style={{ padding: 8 }}>{p.baseRateBps / 100}%</td>
                <td style={{ padding: 8 }}>{p.markupBps / 100}%</td>
                <td style={{ padding: 8 }}>{p.totalInvoices}</td>
                <td style={{ padding: 8 }}>{(Number(p.totalFunded) / 1e6).toLocaleString()} USDT</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {!hasLow && (
          <button
            onClick={() => initPool(0)}
            disabled={initLoading}
            style={{
              padding: "8px 20px",
              background: "#4caf50",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Initialize Low Risk Pool
          </button>
        )}
        {!hasHigh && (
          <button
            onClick={() => initPool(1)}
            disabled={initLoading}
            style={{
              padding: "8px 20px",
              background: "#f44336",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Initialize High Risk Pool
          </button>
        )}
        {hasLow && hasHigh && <p style={{ color: "#888" }}>Both pools initialized.</p>}
      </div>
      {initResult && <p style={{ fontSize: 13, marginTop: 8 }}>{initResult}</p>}
    </div>
  );
}
