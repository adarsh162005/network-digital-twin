import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from "recharts";

const COLOR = {
  cyan: "var(--cyan)",
  emerald: "var(--emerald)",
  amber: "var(--amber)",
  red: "var(--red)",
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const visible = payload.filter((p) => p.value !== null && p.value !== undefined);
  if (!visible.length) return null;
  return (
    <div className="surface px-3 py-2 font-mono-data text-xs">
      <div className="text-muted-app mb-1">{label}</div>
      {visible.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2" style={{ background: p.color }} />
          <span className="text-app">{p.name}:</span>
          <span className="text-strong-app">{Number(p.value).toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * data: [{label, value}, ...]
 * splitIndex: when set, splits into history (solid) and forecast (dashed)
 * threshold: numeric, draws a horizontal reference line
 */
export default function MetricChart({
  data,
  dataKey = "value",
  color = "cyan",
  label = "",
  height = 210,
  showForecastSplit = false,
  splitIndex = null,
  threshold = null,
  thresholdLabel = "WARN",
  testid,
}) {
  const stroke = COLOR[color] || color;
  const hasSplit = showForecastSplit && Number.isInteger(splitIndex) && splitIndex >= 0 && splitIndex < (data?.length || 0);

  // Transform data into history/forecast columns if splitting
  const chartData = hasSplit
    ? data.map((d, i) => ({
        label: d.label,
        history: i <= splitIndex ? d[dataKey] : null,
        forecast: i >= splitIndex ? d[dataKey] : null,
      }))
    : data;

  return (
    <div className="surface p-4" data-testid={testid}>
      {label ? (
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted-app font-mono-data">{label}</div>
          <div className="flex items-center gap-3">
            {hasSplit ? (
              <div className="flex items-center gap-3 text-[9px] uppercase tracking-widest text-muted-app font-mono-data">
                <span className="flex items-center gap-1"><span className="inline-block h-[2px] w-3" style={{ background: stroke }} /> NOW</span>
                <span className="flex items-center gap-1"><span className="inline-block h-[2px] w-3" style={{ background: stroke, borderTop: "1px dashed", opacity: 0.85 }} /> FORECAST</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 6, right: 14, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--grid-line)" strokeDasharray="2 4" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 9 }} stroke="var(--muted)" interval={Math.max(0, Math.floor((data?.length || 1) / 8))} />
          <YAxis tick={{ fontSize: 9 }} stroke="var(--muted)" width={42} />
          <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }} />
          {threshold !== null && threshold !== undefined ? (
            <ReferenceLine
              y={threshold}
              stroke="var(--threshold)"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: `${thresholdLabel} ${threshold}`, position: "insideTopRight", fill: "var(--threshold)", fontSize: 9, fontFamily: "JetBrains Mono" }}
            />
          ) : null}
          {hasSplit ? (
            <ReferenceLine
              x={chartData[splitIndex]?.label}
              stroke="var(--border-strong)"
              strokeDasharray="3 3"
              label={{ value: "NOW", position: "top", fill: "var(--muted)", fontSize: 9, fontFamily: "JetBrains Mono" }}
            />
          ) : null}
          {hasSplit ? (
            <>
              <Line type="monotone" dataKey="history" name="NOW" stroke={stroke} strokeWidth={1.75} dot={false} isAnimationActive={false} connectNulls={false} />
              <Line type="monotone" dataKey="forecast" name="FORECAST" stroke={stroke} strokeDasharray="5 4" strokeWidth={1.75} dot={false} isAnimationActive={false} connectNulls={false} />
            </>
          ) : (
            <Line type="monotone" dataKey={dataKey} name={label || dataKey} stroke={stroke} strokeWidth={1.75} dot={false} isAnimationActive={false} />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
