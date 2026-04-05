export default function RiskBadge({ riskLevel }: { riskLevel: number }) {
  const isLow = riskLevel === 0;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 12,
        background: isLow ? "#e8f5e9" : "#ffebee",
        color: isLow ? "#2e7d32" : "#c62828",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {isLow ? "Low Risk" : "High Risk"}
    </span>
  );
}
