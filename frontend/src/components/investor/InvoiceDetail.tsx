import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, getAccount, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { useInvoiceProgram, Invoice, USDT_MINT } from "../../hooks/useInvoice";
import { usePool } from "../../hooks/usePool";
import { emitRefresh } from "../../hooks/useRefresh";
import StatusBadge from "../shared/StatusBadge";

export default function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const { fetchInvoice, fundInvoice } = useInvoiceProgram();
  const { pools } = usePool();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [usdtBalance, setUsdtBalance] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [tranche, setTranche] = useState<0 | 1>(0);
  const [txResult, setTxResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [funding, setFunding] = useState(false);

  useEffect(() => {
    if (id) fetchInvoice(id).then(setInvoice).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!publicKey) return;
    const ata = getAssociatedTokenAddressSync(USDT_MINT, publicKey, false, TOKEN_2022_PROGRAM_ID);
    getAccount(connection, ata, "confirmed", TOKEN_2022_PROGRAM_ID)
      .then(acc => setUsdtBalance(Number(acc.amount) / 1e6))
      .catch(() => setUsdtBalance(0));
  }, [publicKey, txResult]);

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

  // Per-tranche APY from pool config
  const seniorApy = (pools.find(p => p.riskLevel === 0)?.baseRateBps ?? 500) / 100;
  const juniorApy = (pools.find(p => p.riskLevel === 1)?.baseRateBps ?? 1200) / 100;
  const selectedApy = tranche === 0 ? seniorApy : juniorApy;

  async function handleFund(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !publicKey || !amount) return;
    setError(null); setTxResult(null); setFunding(true);
    try {
      const amountLamports = Math.floor(Number(amount) * 1e6);
      const invoiceMint = new PublicKey(invoice!.mint);
      const tx = await fundInvoice(id, amountLamports, USDT_MINT, invoiceMint, tranche);
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
            background: tranche === 0
              ? "linear-gradient(135deg, var(--success) 0%, color-mix(in oklch, var(--success) 70%, #004d2e) 100%)"
              : "linear-gradient(135deg, #d97706 0%, #92400e 100%)",
            color: "#fff", textAlign: "center", padding: "var(--space-8)",
          }}>
            <p style={{ fontSize: "var(--text-xs)", opacity: 0.85, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {tranche === 0 ? "Senior Tranche APY" : "Junior Tranche APY"}
            </p>
            <p style={{ fontSize: "var(--text-xl)", fontWeight: 700, lineHeight: 1 }}>{selectedApy}%</p>
            <p style={{ fontSize: "var(--text-xs)", opacity: 0.75, marginTop: "var(--space-1)" }}>
              {tranche === 0 ? "Priority payout · Lower risk" : "Subordinated · Higher yield"}
            </p>
          </div>

          <div className="card">
            <h2 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-4)" }}>Fund this Invoice</h2>
            {!publicKey ? (
              <div className="alert alert-info">Connect your wallet to invest.</div>
            ) : (
              <form onSubmit={handleFund} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <div className="input-group">
                  <label className="input-label">Choose Tranche</label>
                  {([
                    { value: 0 as const, label: "Senior Tranche", desc: `${seniorApy}% APY · Priority payout in default`, color: "var(--success)" },
                    { value: 1 as const, label: "Junior Tranche", desc: `${juniorApy}% APY · Subordinated, higher yield`, color: "var(--warning)" },
                  ]).map(t => (
                    <div
                      key={t.value}
                      onClick={() => setTranche(t.value)}
                      style={{
                        display: "flex", alignItems: "center", gap: "var(--space-3)",
                        padding: "var(--space-3) var(--space-4)", marginBottom: "var(--space-2)",
                        borderRadius: "var(--radius-lg)", cursor: "pointer",
                        border: `2px solid ${tranche === t.value ? t.color : "var(--border)"}`,
                        background: tranche === t.value ? `color-mix(in oklch, ${t.color} 10%, transparent)` : "var(--surface-offset)",
                        transition: "all var(--transition)",
                      }}
                    >
                      <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${t.color}`, background: tranche === t.value ? t.color : "transparent", flexShrink: 0 }} />
                      <div>
                        <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--text)" }}>{t.label}</p>
                        <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{t.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="input-group">
                  <label className="input-label">Amount (USDT)</label>
                  <input
                    className="input" type="number"
                    placeholder={`Max: ${remaining.toLocaleString()}`}
                    value={amount} onChange={e => setAmount(e.target.value)}
                    min="1" max={remaining} step="0.01" required
                  />
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    Invoice remaining: {remaining.toLocaleString()} USDT
                    {usdtBalance !== null && (
                      <span style={{ marginLeft: 8, color: usdtBalance > 0 ? "var(--success)" : "var(--error)" }}>
                        · Your balance: {usdtBalance.toLocaleString()} USDT
                      </span>
                    )}
                  </span>
                </div>
                {amount && Number(amount) > 0 && (
                  <div style={{ background: "var(--success-subtle)", borderRadius: "var(--radius-lg)", padding: "var(--space-3) var(--space-4)" }}>
                    <p style={{ fontSize: "var(--text-xs)", color: "var(--success)", fontWeight: 500 }}>
                      Estimated return: ~{(Number(amount) * selectedApy / 100 * Math.max(1, (invoice.dueDate * 1000 - Date.now()) / 31536000000)).toFixed(2)} USDT
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
            <p style={{ fontSize: "var(--text-xs)", fontWeight: 600, marginBottom: "var(--space-2)" }}>🛡 Waterfall Default Protection</p>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: 1.6 }}>
              <strong style={{ color: "var(--success)" }}>Senior tranche</strong> investors are paid first from any recovery proceeds.{" "}
              <strong style={{ color: "var(--warning)" }}>Junior tranche</strong> investors receive the remainder after Senior is fully settled.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
