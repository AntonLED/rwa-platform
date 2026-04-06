import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { emitRefresh } from "../../hooks/useRefresh";

interface EdoPreFill {
  debtorName: string;
  amount: number;
  dueDate: string;
}

interface Props {
  preFill?: EdoPreFill | null;
  onClearPreFill?: () => void;
}

export default function SubmitInvoice({ preFill, onClearPreFill }: Props) {
  const { publicKey } = useWallet();
  const [debtorName, setDebtorName] = useState(preFill?.debtorName || "");
  const [amount, setAmount] = useState(preFill?.amount?.toString() || "");
  const [dueDate, setDueDate] = useState(preFill?.dueDate || "");
  const [riskLevel, setRiskLevel] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preFill) {
      setDebtorName(preFill.debtorName);
      setAmount(preFill.amount.toString());
      setDueDate(preFill.dueDate);
    }
  }, [preFill]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey || !file) return;
    setSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(",")[1] || dataUrl);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creditorWallet: publicKey.toBase58(),
          debtorName,
          amount: Number(amount),
          dueDate,
          riskLevel,
          documentBase64: base64,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create invoice");
      setResult(data);
      onClearPreFill?.();
      emitRefresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!publicKey) return <p style={{ color: "#888" }}>Connect wallet to submit invoices.</p>;

  return (
    <div style={{ padding: 16, border: "1px solid #e0e0e0", borderRadius: 8 }}>
      <h3 style={{ marginTop: 0 }}>Submit New Invoice</h3>
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 400 }}>
        <input
          placeholder="Debtor Name"
          value={debtorName}
          onChange={(e) => setDebtorName(e.target.value)}
          required
          style={{ padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
        />
        <input
          type="number"
          placeholder="Amount (USDT)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          step="0.01"
          min="1"
          style={{ padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          required
          style={{ padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
        />
        <select
          value={riskLevel}
          onChange={(e) => setRiskLevel(Number(e.target.value))}
          style={{ padding: 8, borderRadius: 4, border: "1px solid #ccc" }}
        >
          <option value={0}>Low Risk (5% APY)</option>
          <option value={1}>High Risk (12% APY)</option>
        </select>
        <div>
          <label style={{ fontSize: 13, color: "#666" }}>Document (PDF/image):</label>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            required
            style={{ marginTop: 4, display: "block" }}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "10px 0",
            background: "#1976d2",
            color: "#fff",
            border: "none",
            borderRadius: 4,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {submitting ? "Creating..." : "Submit Invoice"}
        </button>
      </form>

      {result && (
        <div style={{ marginTop: 16, padding: 12, background: "#e8f5e9", borderRadius: 8 }}>
          <strong>Invoice Created!</strong>
          <div style={{ fontSize: 13, marginTop: 4 }}>ID: {result.invoiceId}</div>
          <div style={{ fontSize: 13 }}>TX: {result.tx}</div>
          <div style={{ fontSize: 13 }}>
            Document Hash: <code>{result.documentHash}</code>
          </div>
        </div>
      )}
      {error && <p style={{ color: "#c62828", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
