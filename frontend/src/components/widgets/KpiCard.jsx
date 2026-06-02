import { ArrowDown, ArrowUp, Minus } from "lucide-react";

const ACCENT = {
  cyan: "var(--cyan)",
  emerald: "var(--emerald)",
  amber: "var(--amber)",
  red: "var(--red)",
  muted: "var(--muted)",
};

/**
 * delta: { pct: number, bias: 'bad_up'|'good_up'|'neutral' }
 */
export default function KpiCard({ label, value, unit = "", accent = "cyan", icon: Icon, sublabel = "", delta = null, testid }) {
  const color = ACCENT[accent] || ACCENT.cyan;

  let deltaColor = "var(--muted)";
  let DeltaIcon = Minus;
  if (delta && typeof delta.pct === "number" && Math.abs(delta.pct) >= 0.5) {
    const up = delta.pct > 0;
    DeltaIcon = up ? ArrowUp : ArrowDown;
    if (delta.bias === "bad_up") deltaColor = up ? "var(--red)" : "var(--emerald)";
    else if (delta.bias === "good_up") deltaColor = up ? "var(--emerald)" : "var(--red)";
    else deltaColor = "var(--muted)";
  }

  return (
    <div className="surface p-4 fade-in" data-testid={testid}>
      <div className="flex items-start justify-between mb-2.5">
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-app font-mono-data">{label}</div>
        {Icon ? <Icon className="h-3.5 w-3.5" style={{ color }} /> : null}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="font-mono-data text-[28px] leading-none font-semibold" style={{ color }}>{value}</span>
        {unit ? <span className="text-[11px] text-muted-app font-mono-data">{unit}</span> : null}
      </div>
      <div className="mt-2 flex items-center justify-between min-h-[16px]">
        <span className="text-[10px] uppercase tracking-wider text-muted2-app">{sublabel}</span>
        {delta && typeof delta.pct === "number" ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono-data" style={{ color: deltaColor }} data-testid={`${testid}-delta`}>
            <DeltaIcon className="h-3 w-3" />
            {delta.pct > 0 ? "+" : ""}{delta.pct.toFixed(1)}%
          </span>
        ) : null}
      </div>
    </div>
  );
}
