import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useInvoiceProgram, Invoice, USDT_MINT } from "../../hooks/useInvoice";
import { useInvestorPositions } from "../../hooks/useInvestorPositions";
import StatusBadge from "../shared/StatusBadge";

export default function Portfolio() {
  const { publicKey } = useWallet();
  const { fetchAllInvoices, claimReturns, loading: claimLoading } = useInvoiceProgram();
  const { positions, loading, fetchPositions } = useInvestorPositions();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [claimResult, setClaimResult] = useState<Record<string, string>>({});
  const [claimError, setClaimError] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!publicKey) return;
    fetchAllInvoices().then((all) => {
      setInvoices(all);
      fetchPositions(all);
    });
  }, [publicKey]);

  if (!publicKey) return <p style={{ color: "#888" }}>Connect wallet to see portfolio.</p>;
  if (loading) return <p>Loading positions...</p>;
  if (!positions.length) return <p style={{ color: "#888" }}>No investments yet.</p>;

  function getInvoice(invoiceId: string) {
    return invoices.find((i) => i.invoiceId === invoiceId);
  }

  async function handleClaim(invoiceId: string) {
    const inv = getInvoice(invoiceId);
    if (!inv) return;
    try {
      const tx = await claimReturns(invoiceId, USDT_MINT, new PublicKey(inv.mint));
      setClaimResult((p) => ({ ...p, [invoiceId]: tx }));
    } catch (e: any) {
      setClaimError((p) => ({ ...p, [invoiceId]: e.message }));
    }
  }

  return (
    <div>
      <h3>My Portfolio</h3>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #e0e0e0", textAlign: "left" }}>
            <th style={{ padding: 8 }}>Invoice</th>
            <th style={{ padding: 8 }}>Amount</th>
            <th style={{ padding: 8 }}>Status</th>
            <th style={{ padding: 8 }}>Claimed</th>
            <th style={{ padding: 8 }}>Action</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => {
            const inv = getInvoice(pos.invoiceId);
            const canClaim = inv?.status === "Repaid" && !pos.claimed;
            return (
              <tr key={pos.invoiceId} style={{ borderBottom: "1px solid #f0f0f0" }}>
                <td style={{ padding: 8 }}>{pos.invoiceId}</td>
                <td style={{ padding: 8 }}>{(Number(pos.amount) / 1e6).toLocaleString()} USDT</td>
                <td style={{ padding: 8 }}>{inv ? <StatusBadge status={inv.status} /> : "—"}</td>
                <td style={{ padding: 8 }}>{pos.claimed ? "Yes" : "No"}</td>
                <td style={{ padding: 8 }}>
                  {canClaim && (
                    <button
                      onClick={() => handleClaim(pos.invoiceId)}
                      disabled={claimLoading}
                      style={{
                        padding: "4px 12px",
                        background: "#4caf50",
                        color: "#fff",
                        border: "none",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                    >
                      Claim
                    </button>
                  )}
                  {claimResult[pos.invoiceId] && (
                    <span style={{ color: "#2e7d32", fontSize: 12, marginLeft: 8 }}>Done</span>
                  )}
                  {claimError[pos.invoiceId] && (
                    <span style={{ color: "#c62828", fontSize: 12, marginLeft: 8 }}>
                      {claimError[pos.invoiceId]}
                    </span>
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
