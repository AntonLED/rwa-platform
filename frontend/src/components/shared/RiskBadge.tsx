export default function RiskBadge({ riskLevel }: { riskLevel: number }) {
  return riskLevel === 0
    ? <span className="badge badge-green">Low Risk</span>
    : <span className="badge badge-red">High Risk</span>;
}
