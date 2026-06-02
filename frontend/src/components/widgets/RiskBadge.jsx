import { RISK_META } from "@/lib/api";

export default function RiskBadge({ level = "Stable", size = "md", testid = "risk-badge" }) {
  const meta = RISK_META[level] || RISK_META.Stable;
  const sizeCls = size === "lg" ? "px-3 py-1.5 text-xs" : "px-2 py-1 text-[10px]";
  return (
    <span
      data-testid={testid}
      className={`inline-flex items-center gap-2 ${sizeCls} uppercase tracking-[0.16em] font-mono-data font-semibold`}
      style={{
        color: meta.color,
        background: `${meta.color}14`,
        border: `1px solid ${meta.color}55`,
      }}
    >
      <span className="status-dot" style={{ background: meta.color }} />
      {meta.label}
    </span>
  );
}
