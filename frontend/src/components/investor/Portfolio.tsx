import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useInvestorPositions } from "../../hooks/useInvestorPositions";
import { useInvoiceProgram, Invoice, USDT_MINT } from "../../hooks/useInvoice";
import { emitRefresh } from "../../hooks/useRefresh";
import StatusBadge from "../shared/StatusBadge";

export default function Portfolio() {
  const { publicKey } = useWallet();
  const { positions, loading, fetchPositions } = useInvestorPositions();
  const { fetchAllInvoices, claimReturns } = useInvoiceProgram();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [claimResult, setClaimResult] = useState<Record<string, string>>({});
  const [claimError, setClaimError] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchAllInvoices().then(all => { setInvoices(all); fetchPositions(all); });
  }, [publicKey]);

  if (!publicKey) return (
    <div className="empty-state">
      <div className="empty-state-icon">🔒</div>
      <h3>Connect your wallet</h3>
      <p>Connect Phantom or Solflare to see your investment portfolio.</p>
    </div>
  );

  if (loading) return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 48 }} />)}
    </div>
  );

  if (!positions.length) return (
    <div className="empty-state">
      <div className="empty-state-icon">💼</div>
      <h3>No investments yet</h3>
      <p>Browse the marketplace and fund your first invoice to start earning Real Yield.</p>
    </div>
  );

  const totalInvested = positions.reduce((s, p) => s + Number(p.amount) / 1e6, 0);

  async function handleClaim(invoiceId: string) {
    const inv = invoices.find(i => i.invoiceId === invoiceId);
    if (!inv) return;
    try {
      const tx = await claimReturns(invoiceId, USDT_MINT, new PublicKey(inv.mint));
      setClaimResult(p => ({ ...p, [invoiceId]: tx }));
      emitRefresh();
    } catch (e: any) { setClaimError(p => ({ ...p, [invoiceId]: e.message })); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* SUMMARY */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--space-4)" }}>
        <div className="stat-card">
          <span className="stat-label">Total Invested</span>
          <span className="stat-value">{totalInvested.toLocaleString()} <span style={{ fontSize: "var(--text-xs)", fontWeight: 400, color: "var(--text-muted)" }}>USDT</span></span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active Positions</span>
          <span className="stat-value">{positions.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Ready to Claim</span>
          <span className="stat-value" style={{ color: "var(--success)" }}>
            {positions.filter(p => {
              const inv = invoices.find(i => i.invoiceId === p.invoiceId);
              return !p.claimed && (inv?.status === "Repaid" || inv?.status === "Defaulted");
            }).length}
          </span>
        </div>
      </div>

      {/* TABLE */}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Amount</th>
              <th>Tranche</th>
              <th>Status</th>
              <th>APY</th>
              <th>Due Date</th>
              <th>Claimed</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {positions.map(pos => {
              const inv = invoices.find(i => i.invoiceId === pos.invoiceId);
              const canClaim = !pos.claimed && (inv?.status === "Repaid" || inv?.status === "Defaulted");
              return (
                <tr key={pos.invoiceId}>
                  <td><span style={{ fontFamily: "monospace", fontSize: "var(--text-xs)" }}>{pos.invoiceId.slice(0, 18)}...</span></td>
                  <td><strong>{(Number(pos.amount) / 1e6).toLocaleString()}</strong> USDT</td>
                  <td>
                    {pos.tranche === 0
                      ? <span className="badge badge-green">Senior</span>
                      : <span className="badge badge-yellow">Junior</span>}
                  </td>
                  <td>{inv ? <StatusBadge status={inv.status} /> : "—"}</td>
                  <td style={{ color: "var(--success)", fontWeight: 600 }}>{inv ? inv.interestRateBps / 100 : "—"}%</td>
                  <td>{inv ? new Date(inv.dueDate * 1000).toLocaleDateString() : "—"}</td>
                  <td>{pos.claimed ? <span className="badge badge-green">Claimed</span> : <span className="badge badge-gray">Pending</span>}</td>
                  <td>
                    {canClaim && (
                      <button className="btn btn-primary btn-sm" onClick={() => handleClaim(pos.invoiceId)}>
                        Claim Returns
                      </button>
                    )}
                    {claimResult[pos.invoiceId] && <span className="badge badge-green">✓ Done</span>}
                    {claimError[pos.invoiceId] && <span style={{ fontSize: "var(--text-xs)", color: "var(--error)" }}>{claimError[pos.invoiceId]}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
