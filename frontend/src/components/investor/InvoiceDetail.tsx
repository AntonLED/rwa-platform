import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useInvoiceProgram, Invoice } from "../../hooks/useInvoice";
import { emitRefresh } from "../../hooks/useRefresh";
import StatusBadge from "../shared/StatusBadge";
import RiskBadge from "../shared/RiskBadge";

const USDT_MINT = new PublicKey("Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB");

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const { fetchInvoice, fundInvoice } = useInvoiceProgram();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [txResult, setTxResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [funding, setFunding] = useState(false);

  useEffect(() => {
    if (id) fetchInvoice(id).then(setInvoice).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {[80, 40, 20, 60, 100].map((w, i) => (
        <div key={i} className="skeleton" style={{ height: i === 0 ? 28 : 14, width: `${w}%` }} />
      ))}
    </div>
  );
  if (!invoice) return <div className="alert alert-error">Invoice not found.</div>;

  const total = Number(invoice.totalAmount) / 1e6;
  const funded = Number(invoice.fundedAmount) / 1e6;
  const remaining = total - funded;
  const pct = total > 0 ? (funded / total) * 100 : 0;
  const apy = invoice.interestRateBps / 100;

  async function handleFund(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !publicKey || !amount) return;
    setError(null); setTxResult(null); setFunding(true);
    try {
      const amountLamports = Math.floor(Number(amount) * 1e6);
      const invoiceMint = new PublicKey(invoice!.mint);
      const tx = await fundInvoice(id, amountLamports, USDT_MINT, invoiceMint);
      setTxResult(tx);
      emitRefresh();
    } catch (e: any) { setError(e.message); }
    finally { setFunding(false); }
  }

  const details: { label: string; val: string }[] = [
    { label: "Invoice ID", val: invoice.invoiceId },
    { label: "Creditor", val: invoice.creditor.slice(0, 12) + "..." },
    { label: "Debtor", val: invoice.debtor.slice(0, 12) + "..." },
    { label: "Due Date", val: new Date(invoice.dueDate * 1000).toLocaleDateString() },
    { label: "Created", val: new Date(invoice.createdAt * 1000).toLocaleDateString() },
    { label: "Advance Paid", val: invoice.advancePaid ? "✓ Yes" : "Not yet" },
  ];

  const amounts = [
    { label: "Total Amount", val: `${total.toLocaleString()} USDT`, accent: false },
    { label: "Already Funded", val: `${funded.toLocaleString()} USDT`, accent: false },
    { label: "Remaining", val: `${remaining.toLocaleString()} USDT`, accent: true },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ width: "fit-content" }}>
        ← Back to Marketplace
      </button>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "var(--space-6)", alignItems: "start" }}>
        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <div className="card" style={{ gap: "var(--space-4)", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h1 style={{ fontSize: "var(--text-lg)", fontWeight: 700 }}>{invoice.invoiceId}</h1>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>RWA-backed invoice on Solana</p>
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)" }}>
                <RiskBadge riskLevel={invoice.riskLevel} />
                <StatusBadge status={invoice.status} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-3)" }}>
              {amounts.map(s => (
                <div key={s.label} style={{ background: "var(--surface-offset)", borderRadius: "var(--radius-lg)", padding: "var(--space-3) var(--space-4)" }}>
                  <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: 4 }}>{s.label}</p>
                  <p style={{ fontSize: "var(--text-base)", fontWeight: 700, color: s.accent ? "var(--primary)" : "var(--text)" }}>{s.val}</p>
                </div>
              ))}
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-1)" }}>
                <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Funding Progress</span>
                <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: "var(--primary)" }}>{pct.toFixed(1)}%</span>
              </div>
              <div className="progress-wrap" style={{ height: 10 }}>
                <div className="progress-bar" style={{ width: `${pct}%` }} />
              </div>
            </div>
          </div>

          <div className="card">
            <h2 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-4)" }}>Invoice Details</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-3)" }}>
              {details.map(({ label, val }) => (
                <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 500, fontFamily: ["Invoice ID","Creditor","Debtor"].includes(label) ? "monospace" : "inherit" }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ background: "var(--surface-offset)" }}>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--space-1)" }}>On-chain Document Hash</p>
            <p style={{ fontSize: "var(--text-xs)", fontFamily: "monospace", color: "var(--primary)", wordBreak: "break-all" }}>
              {(invoice as any).documentHash || "—"}
            </p>
          </div>
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div className="card" style={{
            background: "linear-gradient(135deg, var(--primary) 0%, color-mix(in oklch, var(--primary) 70%, #1a4a7a) 100%)",
            color: "var(--primary-fg)", textAlign: "center", padding: "var(--space-8)",
          }}>
            <p style={{ fontSize: "var(--text-xs)", opacity: 0.8, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em" }}>Annual Yield</p>
            <p style={{ fontSize: "var(--text-xl)", fontWeight: 700, lineHeight: 1 }}>{apy}%</p>
            <p style={{ fontSize: "var(--text-xs)", opacity: 0.7, marginTop: "var(--space-1)" }}>Real yield · Not speculative</p>
          </div>

          <div className="card">
            <h2 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-4)" }}>Fund this Invoice</h2>
            {!publicKey ? (
              <div className="alert alert-info">Connect your wallet to invest.</div>
            ) : (
              <form onSubmit={handleFund} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <div className="input-group">
                  <label className="input-label">Amount (USDT)</label>
                  <input
                    className="input" type="number"
                    placeholder={`Max: ${remaining.toLocaleString()}`}
                    value={amount} onChange={e => setAmount(e.target.value)}
                    min="1" max={remaining} step="0.01" required
                  />
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Available: {remaining.toLocaleString()} USDT</span>
                </div>
                {amount && Number(amount) > 0 && (
                  <div style={{ background: "var(--success-subtle)", borderRadius: "var(--radius-lg)", padding: "var(--space-3) var(--space-4)" }}>
                    <p style={{ fontSize: "var(--text-xs)", color: "var(--success)", fontWeight: 500 }}>
                      Estimated return: ~{(Number(amount) * apy / 100 * (invoice.dueDate * 1000 - Date.now()) / 31536000000).toFixed(2)} USDT
                    </p>
                  </div>
                )}
                <button type="submit" className="btn btn-primary" disabled={funding} style={{ justifyContent: "center" }}>
                  {funding ? "⏳ Processing..." : "⚡ Fund Invoice"}
                </button>
              </form>
            )}
            {txResult && <div className="alert alert-success" style={{ marginTop: "var(--space-3)" }}>✓ TX: <span style={{ fontFamily: "monospace" }}>{txResult.slice(0, 24)}...</span></div>}
            {error && <div className="alert alert-error" style={{ marginTop: "var(--space-3)" }}>⚠ {error}</div>}
          </div>

          <div className="card" style={{ background: "var(--surface-offset)" }}>
            <p style={{ fontSize: "var(--text-xs)", fontWeight: 600, marginBottom: "var(--space-2)" }}>🛡 Default Protection</p>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: 1.6 }}>
              In case of debtor default, the platform's Risk Reserve activates a Waterfall mechanism — investors are compensated first.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
