import { useState } from "react";

interface Props {
  documentHash: string;
}

export default function DocumentVerifier({ documentHash }: Props) {
  const [result, setResult] = useState<"match" | "mismatch" | null>(null);
  const [fileHash, setFileHash] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    setFileHash(hex);
    setResult(hex === documentHash ? "match" : "mismatch");
  }

  return (
    <div style={{ margin: "12px 0", padding: 12, background: "#f5f5f5", borderRadius: 8 }}>
      <strong>Document Verification</strong>
      <div style={{ fontSize: 12, color: "#666", margin: "4px 0" }}>
        On-chain hash: <code>{documentHash}</code>
      </div>
      <input type="file" onChange={handleFile} style={{ margin: "8px 0" }} />
      {fileHash && (
        <div style={{ fontSize: 12, color: "#666" }}>
          File hash: <code>{fileHash}</code>
        </div>
      )}
      {result === "match" && (
        <div style={{ color: "#2e7d32", fontWeight: 600, marginTop: 4 }}>
          Document verified — hashes match
        </div>
      )}
      {result === "mismatch" && (
        <div style={{ color: "#c62828", fontWeight: 600, marginTop: 4 }}>
          Mismatch — document does not match on-chain hash
        </div>
      )}
    </div>
  );
}
