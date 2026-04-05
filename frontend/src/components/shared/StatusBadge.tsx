const COLORS: Record<string, string> = {
  Funding: "#2196f3",
  Funded: "#ff9800",
  Advanced: "#e65100",
  Repaid: "#4caf50",
  Defaulted: "#f44336",
};

export default function StatusBadge({ status }: { status: string }) {
  const bg = COLORS[status] || "#999";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 12,
        background: bg,
        color: "#fff",
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {status}
    </span>
  );
}
