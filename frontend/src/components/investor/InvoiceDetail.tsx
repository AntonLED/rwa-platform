import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useInvoiceProgram, Invoice, USDT_MINT } from "../../hooks/useInvoice";
import StatusBadge from "../shared/StatusBadge";
import RiskBadge from "../shared/RiskBadge";
import DocumentVerifier from "../shared/DocumentVerifier";

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const { fetchInvoice, fundInvoice, loading } = useInvoiceProgram();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [amount, setAmount] = useState("");
  const [txResult, setTxResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchInvoice(id).then(setInvoice);
    }
  }, [id]);

  if (!invoice) return <p>Loading invoice...</p>;

  const total = Number(invoice.totalAmount) / 1e6;
  const funded = Number(invoice.fundedAmount) / 1e6;
  const remaining = total - funded;
  const apy = invoice.interestRateBps / 100;

  async function handleFund() {
    if (!id || !publicKey || !amount) return;
    setError(null);
    setTxResult(null);
    try {
      const amountLamports = Math.floor(Number(amount) * 1e6);
      const invoiceMint = new PublicKey(invoice!.mint);
      const tx = await fundInvoice(id, amountLamports, USDT_MINT, invoiceMint);
      setTxResult(tx);
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div>
      <button
        onClick={() => navigate("/investor")}
        style={{ background: "none", border: "none", color: "#1976d2", cursor: "pointer", marginBottom: 16 }}
      >
        &larr; Back to Marketplace
      </button>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{invoice.invoiceId}</h2>
        <StatusBadge status={invoice.status} />
        <RiskBadge riskLevel={invoice.riskLevel} />
      </div>

      <table style={{ fontSize: 14, borderCollapse: "collapse" }}>
        <tbody>
          {[
            ["Total Amount", `${total.toLocaleString()} USDT`],
            ["Funded", `${funded.toLocaleString()} USDT`],
            ["Remaining", `${remaining.toLocaleString()} USDT`],
            ["APY", `${apy}%`],
            ["Creditor", invoice.creditor],
            ["Debtor", invoice.debtor],
            ["Due Date", new Date(invoice.dueDate * 1000).toLocaleDateString()],
            ["Created", new Date(invoice.createdAt * 1000).toLocaleDateString()],
            ["Advance Paid", invoice.advancePaid ? "Yes" : "No"],
            ["Mint", invoice.mint],
          ].map(([label, val]) => (
            <tr key={label}>
              <td style={{ padding: "4px 16px 4px 0", color: "#666" }}>{label}</td>
              <td style={{ padding: "4px 0", wordBreak: "break-all" }}>{val}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <DocumentVerifier documentHash={invoice.documentHash} />

      {invoice.status === "Funding" && publicKey && (
        <div style={{ marginTop: 16, padding: 16, border: "1px solid #1976d2", borderRadius: 8 }}>
          <h3 style={{ margin: "0 0 8px" }}>Fund this Invoice</h3>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="number"
              placeholder="Amount (USDT)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ padding: 8, borderRadius: 4, border: "1px solid #ccc", width: 160 }}
              max={remaining}
              step="0.01"
            />
            <button
              onClick={handleFund}
              disabled={loading || !amount}
              style={{
                padding: "8px 24px",
                background: "#1976d2",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              {loading ? "Signing..." : "Fund"}
            </button>
          </div>
          {txResult && (
            <p style={{ color: "#2e7d32", fontSize: 13, marginTop: 8 }}>
              Success! TX: {txResult.slice(0, 20)}...
            </p>
          )}
          {error && <p style={{ color: "#c62828", fontSize: 13, marginTop: 8 }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
