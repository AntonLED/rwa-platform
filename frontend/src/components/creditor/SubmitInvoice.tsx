import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { emitRefresh } from "../../hooks/useRefresh";

interface EdoPreFill { debtorName: string; amount: number; dueDate: string; }
interface Props { preFill?: EdoPreFill | null; onClearPreFill?: () => void; }

export default function SubmitInvoice({ preFill, onClearPreFill }: Props) {
  const { publicKey } = useWallet();
  const [debtorName, setDebtorName] = useState(preFill?.debtorName || "");
  const [amount, setAmount] = useState(preFill?.amount?.toString() || "");
  const [dueDate, setDueDate] = useState(preFill?.dueDate || "");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (preFill) { setDebtorName(preFill.debtorName); setAmount(preFill.amount.toString()); setDueDate(preFill.dueDate); }
  }, [preFill]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey || !file) return;
    setSubmitting(true); setError(null); setResult(null);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => { const d = reader.result as string; resolve(d.split(",")[1] || d); };
        reader.onerror = reject; reader.readAsDataURL(file);
      });
      const res = await fetch("/api/invoices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creditorWallet: publicKey.toBase58(), debtorName, amount: Number(amount), dueDate, documentBase64: base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create invoice");
      setResult(data); onClearPreFill?.(); emitRefresh();
    } catch (e: any) { setError(e.message); }
    finally { setSubmitting(false); }
  }

  const estimatedAdvance = amount ? (Number(amount) * 0.9).toFixed(0) : "—";
  const fee = amount ? (Number(amount) * 0.02).toFixed(2) : "—";

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-8)" }}>
      {/* LEFT: FORM */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <div className="input-group">
          <label className="input-label">Debtor Company Name *</label>
          <input className="input" type="text" placeholder="e.g. Magnum Cash&Carry" value={debtorName} onChange={e => setDebtorName(e.target.value)} required />
        </div>
        <div className="input-group">
          <label className="input-label">Invoice Amount (USDT) *</label>
          <input className="input" type="number" placeholder="50000" value={amount} onChange={e => setAmount(e.target.value)} min="500" step="0.01" required />
        </div>
        <div className="input-group">
          <label className="input-label">Payment Due Date *</label>
          <input className="input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} required />
        </div>
        <div className="card" style={{ background: "var(--surface-offset)", padding: "var(--space-3) var(--space-4)" }}>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: 1.5 }}>
            Risk classification and investor tranche assignment is determined by the platform based on invoice parameters.
          </p>
        </div>

        {/* FILE UPLOAD */}
        <div className="input-group">
          <label className="input-label">Invoice Document (PDF / image) *</label>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
            onClick={() => document.getElementById("file-input")?.click()}
            style={{
              border: `2px dashed ${dragOver ? "var(--primary)" : "var(--border)"}`,
              borderRadius: "var(--radius-lg)", padding: "var(--space-6)",
              textAlign: "center", cursor: "pointer", transition: "all var(--transition)",
              background: dragOver ? "var(--primary-subtle)" : "var(--surface-offset)",
            }}
          >
            {file ? (
              <div>
                <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--success)" }}>✓ {file.name}</p>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: "1.5rem", marginBottom: "var(--space-2)" }}>📎</p>
                <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>Drag & drop or click to upload</p>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)" }}>PDF, JPG, PNG — max 10MB</p>
              </div>
            )}
          </div>
          <input id="file-input" type="file" accept="application/pdf,image/*" style={{ display: "none" }} onChange={e => setFile(e.target.files?.[0] || null)} />
        </div>

        <button type="submit" className="btn btn-primary" disabled={submitting || !file} style={{ justifyContent: "center", padding: "var(--space-3)" }}>
          {submitting ? "⏳ Creating on-chain..." : "🚀 Submit Invoice"}
        </button>

        {error && <div className="alert alert-error">⚠ {error}</div>}

        {result && (
          <div className="alert alert-success" style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <strong>✓ Invoice Created Successfully!</strong>
            <span style={{ fontSize: "var(--text-xs)" }}>ID: <code>{result.invoiceId}</code></span>
            <span style={{ fontSize: "var(--text-xs)" }}>TX: <code>{result.tx?.slice(0, 24)}...</code></span>
            <span style={{ fontSize: "var(--text-xs)" }}>Hash: <code>{result.documentHash?.slice(0, 24)}...</code></span>
          </div>
        )}
      </form>

      {/* RIGHT: CALCULATOR */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div className="card" style={{ background: "var(--surface-offset)" }}>
          <h3 style={{ fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-4)" }}>💰 Payment Calculator</h3>
          {[
            { label: "Invoice Amount", val: amount ? `${Number(amount).toLocaleString()} USDT` : "—" },
            { label: "Advance (90%)", val: `${Number(estimatedAdvance).toLocaleString()} USDT`, accent: "var(--success)" },
            { label: "Platform Fee (~2%)", val: `-${fee} USDT`, accent: "var(--error)" },
            { label: "You Receive Today", val: amount ? `≈ ${(Number(amount) * 0.88).toFixed(0)} USDT` : "—", big: true, accent: "var(--primary)" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", paddingBlock: "var(--space-2)", borderBottom: "1px solid var(--divider)" }}>
              <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>{r.label}</span>
              <span style={{ fontSize: r.big ? "var(--text-lg)" : "var(--text-sm)", fontWeight: r.big ? 700 : 500, color: r.accent || "var(--text)" }}>{r.val}</span>
            </div>
          ))}
          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-faint)", marginTop: "var(--space-3)" }}>
            * Advance paid within 24h after pool reaches 100%. Remaining 10% paid after debtor settles.
          </p>
        </div>

        <div className="card" style={{ background: "var(--creditor-subtle)", borderColor: "var(--creditor)" }}>
          <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--creditor)", marginBottom: "var(--space-2)" }}>🔗 On-chain Verification</p>
          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", lineHeight: 1.6 }}>
            Your document is hashed (SHA-256) and the fingerprint is stored on Solana. The hash — not the file — becomes part of the smart contract. Your data stays private, authenticity is public.
          </p>
        </div>

        <div className="card">
          <p style={{ fontSize: "var(--text-sm)", fontWeight: 600, marginBottom: "var(--space-2)" }}>📋 How it works</p>
          {["Submit invoice + document", "Platform verifies debtor (KYB)", "Investors fund the pool (1–3 days)", "You receive 90% advance in USDT", "Remaining 10% after debtor pays"].map((step, i) => (
            <div key={i} style={{ display: "flex", gap: "var(--space-3)", paddingBlock: "var(--space-2)", borderBottom: i < 4 ? "1px solid var(--divider)" : "none" }}>
              <span style={{ width: 22, height: 22, borderRadius: "var(--radius-full)", background: "var(--primary)", color: "var(--primary-fg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "var(--text-xs)", fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>{step}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
