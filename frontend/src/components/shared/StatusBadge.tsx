const MAP: Record<string, string> = {
  Funding: "badge-blue", Funded: "badge-orange", Advanced: "badge-orange",
  Repaid: "badge-green", Defaulted: "badge-red",
};
export default function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${MAP[status] || "badge-gray"}`}>{status}</span>;
}
