import { useState } from "react";
import { api, fmt, fmtTimestamp } from "@/lib/api";
import PageHeader from "@/components/widgets/PageHeader";
import KpiCard from "@/components/widgets/KpiCard";
import MetricChart from "@/components/widgets/MetricChart";
import RiskBadge from "@/components/widgets/RiskBadge";
import ScenarioSelect from "@/components/widgets/ScenarioSelect";
import ForecastSummary from "@/components/widgets/ForecastSummary";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BrainCircuit, Activity, Cpu, Network, Database, Loader2, GitCompareArrows, FileDown } from "lucide-react";
import { exportPredictionPDF } from "@/lib/pdfExport";

const FEATURES = [
  { key: "latency_ms", label: "Latency Forecast (ms)", color: "cyan", thresholdKey: "latency_ms" },
  { key: "throughput_mbps", label: "Throughput Forecast (Mbps)", color: "emerald", thresholdKey: null },
  { key: "packet_loss_percent", label: "Packet Loss Forecast (%)", color: "red", thresholdKey: "packet_loss_percent" },
  { key: "utilization_percent", label: "Utilization Forecast (%)", color: "amber", thresholdKey: "utilization_percent" },
];

export default function Compare() {
  const [a, setA] = useState("Low Traffic");
  const [b, setB] = useState("Congestion Attack");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    if (a === b) { toast.error("Pick two different scenarios"); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/compare", { scenarios: [a, b] });
      setResults(data);
      toast.success("Comparison generated");
    } catch (e) {
      toast.error("Compare failed", { description: e?.response?.data?.detail || e.message });
    } finally { setLoading(false); }
  };

  return (
    <div data-testid="compare-page">
      <PageHeader
        title="Scenario Comparison"
        subtitle="Run LSTM forecasts for two scenarios in parallel. Compare predicted KPIs, risk, and trajectories side-by-side."
        actions={
          <>
            <ScenarioSelect value={a} onChange={setA} testid="compare-scenario-a" exclude={[b]} />
            <span className="text-muted-app font-mono-data text-xs px-1">VS</span>
            <ScenarioSelect value={b} onChange={setB} testid="compare-scenario-b" exclude={[a]} />
            <Button
              data-testid="compare-run-btn"
              onClick={run} disabled={loading}
              className="rounded-none uppercase tracking-widest text-xs font-mono-data h-9 px-4"
              style={{ background: "var(--cyan-soft)", color: "var(--cyan)", border: "1px solid var(--cyan)" }}
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GitCompareArrows className="h-4 w-4 mr-2" />}
              Compare
            </Button>
          </>
        }
      />

      {!results ? (
        <div className="surface p-10 text-center text-muted-app font-mono-data uppercase tracking-widest text-sm">
          Select two scenarios and run comparison to view side-by-side forecast.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {results.results.map((r, idx) => (
              <ScenarioColumn key={idx} r={r} testid={`compare-col-${idx}`} />
            ))}
          </div>

          {/* Comparison KPI table */}
          <div className="surface p-5 mt-4" data-testid="compare-delta-table">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-app font-mono-data mb-3">// KPI Comparison</div>
            <table className="w-full font-mono-data text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }} className="text-[10px] uppercase tracking-widest text-muted-app">
                  <th className="text-left py-2 px-2">KPI</th>
                  <th className="text-right py-2 px-2">{results.results[0].scenario}</th>
                  <th className="text-right py-2 px-2">{results.results[1].scenario}</th>
                  <th className="text-right py-2 px-2">Δ (B − A)</th>
                </tr>
              </thead>
              <tbody>
                {compareRows(results.results).map((row, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-2 px-2 text-app">{row.label}</td>
                    <td className="py-2 px-2 text-right text-app">{fmt(row.a)} {row.unit}</td>
                    <td className="py-2 px-2 text-right text-app">{fmt(row.b)} {row.unit}</td>
                    <td className="py-2 px-2 text-right font-mono-data" style={{ color: row.deltaColor }}>
                      {row.delta >= 0 ? "+" : ""}{fmt(row.delta)} {row.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 text-[10px] uppercase tracking-widest text-muted2-app font-mono-data">
              Generated · {fmtTimestamp(results.generated_at)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ScenarioColumn({ r, testid }) {
  const split = r.graph_data?.history_len ? r.graph_data.history_len - 1 : null;
  const T = r.thresholds || {};
  const chartData = (key) =>
    r.graph_data?.labels?.map((l, i) => ({ label: l, [key]: r.graph_data[key]?.[i] ?? 0 })) || [];

  return (
    <div className="surface p-4 space-y-3" data-testid={testid}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-app font-mono-data">// {r.scenario}</div>
          <div className="text-sm text-strong-app mt-1 flex items-center gap-2">
            <BrainCircuit className="h-4 w-4 text-emerald-app" /> LSTM Forecast
          </div>
        </div>
        <div className="flex items-center gap-2">
          <RiskBadge level={r.risk_level} testid={`${testid}-risk`} />
          <Button
            variant="ghost" size="sm"
            data-testid={`${testid}-pdf`}
            onClick={() => exportPredictionPDF(r, r.scenario, "future")}
            className="h-7 px-2 text-xs uppercase tracking-widest font-mono-data text-muted-app hover:text-app"
            style={{ borderRadius: 2 }}
          >
            <FileDown className="h-3 w-3 mr-1" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Mini label="Latency" v={fmt(r.future_latency_ms)} u="ms" />
        <Mini label="Throughput" v={fmt(r.future_throughput_mbps)} u="Mbps" />
        <Mini label="Pkt Loss" v={fmt(r.future_packet_loss_percent)} u="%" />
        <Mini label="Utilization" v={fmt(r.future_utilization_percent)} u="%" />
        <Mini label="Jitter" v={fmt(r.future_jitter_ms)} u="ms" />
        <Mini label="Queue Occ." v={fmt(r.future_queue_occupancy_percent)} u="%" />
      </div>

      {r.forecast_summary?.length ? (
        <ForecastSummary horizon={r.forecast_horizon || 20} messages={r.forecast_summary} testid={`${testid}-summary`} />
      ) : null}

      <div className="grid grid-cols-1 gap-3">
        {FEATURES.map((f) => (
          <MetricChart
            key={f.key}
            testid={`${testid}-chart-${f.key}`}
            data={chartData(f.key)} dataKey={f.key} color={f.color}
            label={f.label}
            showForecastSplit splitIndex={split}
            threshold={f.thresholdKey ? T[f.thresholdKey] : null}
            thresholdLabel="WARN" height={180}
          />
        ))}
      </div>
    </div>
  );
}

function Mini({ label, v, u }) {
  return (
    <div className="border p-2.5" style={{ borderColor: "var(--border)" }}>
      <div className="text-[9px] uppercase tracking-widest text-muted-app font-mono-data">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-mono-data text-base text-app">{v}</span>
        <span className="text-[10px] text-muted2-app font-mono-data">{u}</span>
      </div>
    </div>
  );
}

function compareRows(results) {
  const [A, B] = results;
  const items = [
    { label: "Latency", a: A.future_latency_ms, b: B.future_latency_ms, unit: "ms", biasBad: true },
    { label: "Throughput", a: A.future_throughput_mbps, b: B.future_throughput_mbps, unit: "Mbps", biasBad: false },
    { label: "Packet Loss", a: A.future_packet_loss_percent, b: B.future_packet_loss_percent, unit: "%", biasBad: true },
    { label: "Utilization", a: A.future_utilization_percent, b: B.future_utilization_percent, unit: "%", biasBad: true },
    { label: "Jitter", a: A.future_jitter_ms, b: B.future_jitter_ms, unit: "ms", biasBad: true },
    { label: "Queue Occupancy", a: A.future_queue_occupancy_percent, b: B.future_queue_occupancy_percent, unit: "%", biasBad: true },
  ];
  return items.map((it) => {
    const delta = (it.b ?? 0) - (it.a ?? 0);
    let deltaColor = "var(--muted)";
    if (Math.abs(delta) > 0.05) {
      const positive = delta > 0;
      deltaColor = (it.biasBad ? positive : !positive) ? "var(--red)" : "var(--emerald)";
    }
    return { ...it, delta, deltaColor };
  });
}
