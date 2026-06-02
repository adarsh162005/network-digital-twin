import { useState } from "react";
import { api, fmt } from "@/lib/api";
import PageHeader from "@/components/widgets/PageHeader";
import KpiCard from "@/components/widgets/KpiCard";
import MetricChart from "@/components/widgets/MetricChart";
import RiskBadge from "@/components/widgets/RiskBadge";
import ScenarioSelect from "@/components/widgets/ScenarioSelect";
import ScenarioInsight from "@/components/widgets/ScenarioInsight";
import ForecastSummary from "@/components/widgets/ForecastSummary";
import Timestamp from "@/components/widgets/Timestamp";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BrainCircuit, Activity, Cpu, Network, Database, Waves, Server, Users, Loader2, FileDown } from "lucide-react";
import { exportPredictionPDF } from "@/lib/pdfExport";

const FEATURES = [
  { key: "latency_ms", label: "Latency Forecast (ms)", color: "cyan", thresholdKey: "latency_ms" },
  { key: "throughput_mbps", label: "Throughput Forecast (Mbps)", color: "emerald", thresholdKey: null },
  { key: "packet_loss_percent", label: "Packet Loss Forecast (%)", color: "red", thresholdKey: "packet_loss_percent" },
  { key: "utilization_percent", label: "Utilization Forecast (%)", color: "amber", thresholdKey: "utilization_percent" },
  { key: "jitter_ms", label: "Jitter Forecast (ms)", color: "cyan", thresholdKey: "jitter_ms" },
  { key: "queue_occupancy_percent", label: "Queue Occupancy Forecast (%)", color: "amber", thresholdKey: "queue_occupancy_percent" },
];

export default function FutureForecasting() {
  const [scenario, setScenario] = useState("High Traffic");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/future_predict", { scenario });
      setResult(data);
      toast.success("LSTM forecast generated", { description: `Predicted risk: ${data.risk_level}` });
    } catch (e) {
      toast.error("Forecast failed", { description: e?.response?.data?.detail || e.message });
    } finally { setLoading(false); }
  };

  const chartData = (key) => {
    if (!result?.graph_data?.labels) return [];
    return result.graph_data.labels.map((l, i) => ({ label: l, [key]: result.graph_data[key]?.[i] ?? 0 }));
  };
  const splitIndex = result?.graph_data?.history_len ? result.graph_data.history_len - 1 : null;
  const T = result?.thresholds || {};

  return (
    <div data-testid="future-page">
      <PageHeader
        title="Future Forecasting"
        subtitle="LSTM-driven sequence prediction. The model ingests the last 10 telemetry steps × 8 features and projects the next 20 steps."
        actions={
          <>
            <ScenarioSelect value={scenario} onChange={setScenario} testid="future-scenario-select" />
            <Button
              data-testid="run-forecast-btn"
              onClick={handleRun}
              disabled={loading}
              className="rounded-none uppercase tracking-widest text-xs font-mono-data h-9 px-4"
              style={{ background: "var(--emerald-soft)", color: "var(--emerald)", border: "1px solid var(--emerald)" }}
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BrainCircuit className="h-4 w-4 mr-2" />}
              Run LSTM Forecast
            </Button>
            {result?.timestamp ? <Timestamp iso={result.timestamp} testid="future-timestamp" /> : null}
            {result ? (
              <Button
                data-testid="future-export-pdf"
                onClick={() => exportPredictionPDF(result, scenario, "future")}
                className="rounded-none surface text-app hover:bg-[var(--surface-2)] uppercase tracking-widest text-xs font-mono-data h-9 px-3"
              >
                <FileDown className="h-3.5 w-3.5 mr-2" /> PDF
              </Button>
            ) : null}
            {result ? <RiskBadge level={result.risk_level} size="lg" testid="future-risk-badge" /> : null}
          </>
        }
      />

      {/* LSTM info banner */}
      <div className="surface px-4 py-3 mb-4 flex items-center justify-between flex-wrap gap-3" data-testid="lstm-info-banner">
        <div className="flex items-center gap-3">
          <BrainCircuit className="h-4 w-4" style={{ color: "var(--emerald)" }} />
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-app font-mono-data">// Model · Sequential Forecasting</div>
            <div className="text-sm text-strong-app">LSTM (1, 10, 8) · MinMax scaled · Recursive multi-step</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest font-mono-data">
          <span className="chip" data-testid="forecast-horizon-chip">Forecast Horizon · {result?.forecast_horizon ?? 20} Steps</span>
          <span className="inline-flex items-center gap-2 text-muted-app">
            <span className="status-dot" style={{ background: "var(--emerald)" }} />
            <span>Ready</span>
          </span>
        </div>
      </div>

      {/* Predicted KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KpiCard testid="kpi-future-latency" label="Future Latency" value={fmt(result?.future_latency_ms)} unit="ms" accent="cyan" icon={Activity} delta={result?.deltas?.latency_ms} sublabel="vs last observed" />
        <KpiCard testid="kpi-future-throughput" label="Future Throughput" value={fmt(result?.future_throughput_mbps)} unit="Mbps" accent="emerald" icon={Network} delta={result?.deltas?.throughput_mbps} sublabel="vs last observed" />
        <KpiCard testid="kpi-future-ploss" label="Future Pkt Loss" value={fmt(result?.future_packet_loss_percent)} unit="%" accent="red" icon={Database} delta={result?.deltas?.packet_loss_percent} sublabel="vs last observed" />
        <KpiCard testid="kpi-future-util" label="Future Utilization" value={fmt(result?.future_utilization_percent)} unit="%" accent="amber" icon={Cpu} delta={result?.deltas?.utilization_percent} sublabel="vs last observed" />
        <KpiCard testid="kpi-future-load" label="Future Load" value={fmt(result?.future_traffic_load_mbps)} unit="Mbps" accent="cyan" icon={Waves} delta={result?.deltas?.traffic_load_mbps} sublabel="vs last observed" />
        <KpiCard testid="kpi-future-users" label="Future Users" value={fmt(result?.future_active_users, 0)} unit="" accent="emerald" icon={Users} delta={result?.deltas?.active_users} sublabel="vs last observed" />
        <KpiCard testid="kpi-future-jitter" label="Future Jitter" value={fmt(result?.future_jitter_ms)} unit="ms" accent="cyan" icon={Waves} delta={result?.deltas?.jitter_ms} sublabel="vs last observed" />
        <KpiCard testid="kpi-future-queue" label="Future Queue Occ." value={fmt(result?.future_queue_occupancy_percent)} unit="%" accent="amber" icon={Server} delta={result?.deltas?.queue_occupancy_percent} sublabel="vs last observed" />
      </div>

      {/* AI summary + scenario insight */}
      {result ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="lg:col-span-2">
            {result.forecast_summary?.length ? (
              <ForecastSummary horizon={result.forecast_horizon ?? 20} messages={result.forecast_summary} />
            ) : null}
          </div>
          <div>
            {result.scenario_insight ? <ScenarioInsight scenario={scenario} insight={result.scenario_insight} /> : null}
          </div>
        </div>
      ) : null}

      {/* Forecast charts */}
      {result?.graph_data?.labels?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <MetricChart
              key={f.key}
              testid={`chart-future-${f.key}`}
              data={chartData(f.key)}
              dataKey={f.key}
              color={f.color}
              label={f.label}
              showForecastSplit
              splitIndex={splitIndex}
              threshold={f.thresholdKey ? T[f.thresholdKey] : null}
              thresholdLabel="WARN"
              height={220}
            />
          ))}
        </div>
      ) : (
        <div className="surface p-10 text-center text-muted-app font-mono-data uppercase tracking-widest text-sm">
          Run LSTM forecast to see predicted trajectories
        </div>
      )}

      {/* Recommendations */}
      {result?.recommendations?.length ? (
        <div className="mt-4 surface p-5" data-testid="future-recommendations">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-app font-mono-data mb-3">// AI Mitigation Plan</div>
          <ul className="space-y-1.5">
            {result.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-app">
                <span className="mt-1.5 h-1 w-1" style={{ background: "var(--emerald)" }} />
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
