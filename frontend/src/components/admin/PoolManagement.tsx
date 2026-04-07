import { useEffect, useState } from "react";
import { usePool } from "../../hooks/usePool";
import { useRefreshListener } from "../../hooks/useRefresh";

export default function PoolManagement() {
  const { pools, loading, fetchPools, initPool } = usePool();
  const [initResult, setInitResult] = useState<string | null>(null);
  const tick = useRefreshListener();

  useEffect(() => { fetchPools(); }, [tick]);

  async function handleInit(riskLevel: number) {
    try {
      const tx = await initPool(riskLevel);
      setInitResult(`✓ Pool initialized! TX: ${tx.slice(0,20)}...`);
    } catch (e: any) { setInitResult(`⚠ ${e.message}`); }
  }

  if (loading) return (
    <div style={{ display:"flex", flexDirection:"column", gap:"var(--space-3)" }}>
      {[1,2].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
    </div>
  );

  const hasLow = pools.some(p => p.riskLevel === 0);
  const hasHigh = pools.some(p => p.riskLevel === 1);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"var(--space-6)" }}>
      {pools.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Tranche</th><th>Investor APY</th><th>Platform Markup</th><th>Advance Rate</th><th>Total Funded</th></tr>
            </thead>
            <tbody>
              {pools.map(p => (
                <tr key={p.riskLevel}>
                  <td>
                    {p.riskLevel === 0
                      ? <span className="badge badge-green">Senior Tranche</span>
                      : <span className="badge badge-yellow">Junior Tranche</span>}
                  </td>
                  <td style={{ fontWeight:600 }}>{p.baseRateBps / 100}%</td>
                  <td>{p.markupBps / 100}%</td>
                  <td>90% <span style={{ fontSize:"var(--text-xs)", color:"var(--text-muted)" }}>(10% retention)</span></td>
                  <td><strong>{(Number(p.totalFunded) / 1e6).toLocaleString()}</strong> USDT</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="card">
        <h3 style={{ fontSize:"var(--text-base)", fontWeight:600, marginBottom:"var(--space-4)" }}>Initialize Pools</h3>
        <div style={{ display:"flex", gap:"var(--space-3)" }}>
          {!hasLow && <button className="btn btn-primary" onClick={() => handleInit(0)}>Initialize Senior Tranche Pool</button>}
          {!hasHigh && <button className="btn btn-primary" onClick={() => handleInit(1)}>Initialize Junior Tranche Pool</button>}
          {hasLow && hasHigh && <div className="alert alert-success">✓ Both tranches are initialized and active.</div>}
        </div>
        {initResult && <div className="alert alert-info" style={{ marginTop:"var(--space-3)" }}>{initResult}</div>}
      </div>
    </div>
  );
}
