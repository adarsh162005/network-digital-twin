import { useState } from "react";
import { api, fmt } from "@/lib/api";
import PageHeader from "@/components/widgets/PageHeader";
import KpiCard from "@/components/widgets/KpiCard";
import MetricChart from "@/components/widgets/MetricChart";
import RiskBadge from "@/components/widgets/RiskBadge";
import ScenarioSelect from "@/components/widgets/ScenarioSelect";
import ScenarioInsight from "@/components/widgets/ScenarioInsight";
import Timestamp from "@/components/widgets/Timestamp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Activity, Cpu, Network, Database, Waves, Server, Play, Loader2, FileDown } from "lucide-react";
import { exportPredictionPDF } from "@/lib/pdfExport";

export default function CurrentPrediction() {
  const [scenario, setScenario] = useState("High Traffic");
  const [bandwidth, setBandwidth] = useState(100);
  const [users, setUsers] = useState(250);
  const [load, setLoad] = useState(80);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    const bw = Number(bandwidth);
    const us = Number(users);
    const ld = Number(load);
    if (!Number.isFinite(bw) || bw <= 0 || !Number.isFinite(us) || us <= 0 || !Number.isFinite(ld) || ld <= 0) {
      toast.error("Invalid input", {
        description: "Bandwidth, active users, and traffic load must all be positive numbers.",
      });
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/predict", {
        bandwidth_mbps: bw,
        active_users: us,
        traffic_load_mbps: ld,
        scenario,
      });
      setResult(data);
      toast.success("Prediction generated", { description: `Risk: ${data.risk_level}` });
    } catch (e) {
      toast.error("Prediction failed", { description: e?.response?.data?.detail || e.message });
    } finally {
      setLoading(false);
    }
  };

  const chartData = (key) => {
    if (!result?.graph_data?.labels) return [];
    return result.graph_data.labels.map((l, i) => ({ label: l, [key]: result.graph_data[key]?.[i] ?? 0 }));
  };
  const T = result?.thresholds || {};

  return (
    <div data-testid="current-page">
      <PageHeader
        title="Current Prediction"
        subtitle="Predict current network KPIs using scenario-blended inference. Adjust bandwidth, user count, and offered load."
        actions={
          <>
            {result?.timestamp ? <Timestamp iso={result.timestamp} testid="current-timestamp" /> : null}
            {result ? (
              <Button
                data-testid="current-export-pdf"
                onClick={() => exportPredictionPDF(result, scenario, "current")}
                className="rounded-none surface text-app hover:bg-[var(--surface-2)] uppercase tracking-widest text-xs font-mono-data h-9 px-3"
              >
                <FileDown className="h-3.5 w-3.5 mr-2" /> PDF
              </Button>
            ) : null}
            {result ? <RiskBadge level={result.risk_level} size="lg" testid="current-risk-badge" /> : null}
          </>
        }
      />

      <div className="grid grid-cols-12 gap-4">
        {/* Input form */}
        <div className="col-span-12 lg:col-span-4 surface p-5" data-testid="input-panel">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-app font-mono-data mb-4">// Network Inputs</div>
          <div className="space-y-4">
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-app font-mono-data">Scenario</Label>
              <div className="mt-1.5"><ScenarioSelect value={scenario} onChange={setScenario} testid="current-scenario-select" /></div>
            </div>
            <Field testid="input-bandwidth" label="Bandwidth (Mbps)" value={bandwidth} setValue={setBandwidth} />
            <Field testid="input-users" label="Active Users" value={users} setValue={setUsers} />
            <Field testid="input-load" label="Traffic Load (Mbps)" value={load} setValue={setLoad} />
            <Button
              data-testid="run-prediction-btn"
              onClick={handleRun}
              disabled={loading}
              className="w-full rounded-none uppercase tracking-widest text-xs font-mono-data h-10"
              style={{ background: "var(--cyan-soft)", color: "var(--cyan)", border: "1px solid var(--cyan)" }}
            >
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Run Prediction
            </Button>
          </div>
        </div>

        {/* KPI grid */}
        <div className="col-span-12 lg:col-span-8 grid grid-cols-2 md:grid-cols-3 gap-4">
          <KpiCard testid="kpi-latency" label="Latency" value={fmt(result?.predicted_latency_ms)} unit="ms" accent="cyan" icon={Activity} delta={result?.deltas?.latency_ms} sublabel="vs scenario mean" />
          <KpiCard testid="kpi-throughput" label="Throughput" value={fmt(result?.predicted_throughput_mbps)} unit="Mbps" accent="emerald" icon={Network} delta={result?.deltas?.throughput_mbps} sublabel="vs scenario mean" />
          <KpiCard testid="kpi-packet-loss" label="Packet Loss" value={fmt(result?.predicted_packet_loss_percent)} unit="%" accent="red" icon={Database} delta={result?.deltas?.packet_loss_percent} sublabel="vs scenario mean" />
          <KpiCard testid="kpi-utilization" label="Utilization" value={fmt(result?.predicted_utilization_percent)} unit="%" accent="amber" icon={Cpu} delta={result?.deltas?.utilization_percent} sublabel="vs scenario mean" />
          <KpiCard testid="kpi-jitter" label="Jitter" value={fmt(result?.predicted_jitter_ms)} unit="ms" accent="cyan" icon={Waves} delta={result?.deltas?.jitter_ms} sublabel="vs scenario mean" />
          <KpiCard testid="kpi-queue" label="Queue Occupancy" value={fmt(result?.predicted_queue_occupancy_percent)} unit="%" accent="amber" icon={Server} delta={result?.deltas?.queue_occupancy_percent} sublabel="vs scenario mean" />
        </div>

        {/* Scenario insight */}
        {result?.scenario_insight ? (
          <div className="col-span-12">
            <ScenarioInsight scenario={scenario} insight={result.scenario_insight} />
          </div>
        ) : null}

        {/* Charts */}
        {result?.graph_data?.labels?.length ? (
          <>
            <div className="col-span-12 md:col-span-6">
              <MetricChart testid="chart-latency" data={chartData("latency_ms")} dataKey="latency_ms" color="cyan" label="Latency Trend (ms)" threshold={T.latency_ms} thresholdLabel="WARN" />
            </div>
            <div className="col-span-12 md:col-span-6">
              <MetricChart testid="chart-throughput" data={chartData("throughput_mbps")} dataKey="throughput_mbps" color="emerald" label="Throughput Trend (Mbps)" />
            </div>
            <div className="col-span-12 md:col-span-6">
              <MetricChart testid="chart-ploss" data={chartData("packet_loss_percent")} dataKey="packet_loss_percent" color="red" label="Packet Loss Trend (%)" threshold={T.packet_loss_percent} thresholdLabel="WARN" />
            </div>
            <div className="col-span-12 md:col-span-6">
              <MetricChart testid="chart-util" data={chartData("utilization_percent")} dataKey="utilization_percent" color="amber" label="Utilization Trend (%)" threshold={T.utilization_percent} thresholdLabel="WARN" />
            </div>
          </>
        ) : null}

        {/* Recommendations */}
        {result?.recommendations?.length ? (
          <div className="col-span-12 surface p-5" data-testid="current-recommendations">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-app font-mono-data mb-3">// AI Recommendations</div>
            <ul className="space-y-1.5">
              {result.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-app">
                  <span className="mt-1.5 h-1 w-1" style={{ background: "var(--cyan)" }} />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, value, setValue, testid }) {
  const handleChange = (e) => {
    const v = e.target.value;
    if (v === "" || /^\d*\.?\d*$/.test(v)) setValue(v);
  };
  const blockNegative = (e) => {
    if (e.key === "-" || e.key === "+" || e.key === "e" || e.key === "E") e.preventDefault();
  };
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-widest text-muted-app font-mono-data">{label}</Label>
      <Input
        data-testid={testid}
        type="number"
        min="0"
        step="any"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        onKeyDown={blockNegative}
        className="mt-1.5 surface font-mono-data text-app focus-visible:ring-1"
        style={{ borderRadius: 2, color: "var(--text)" }}
      />
    </div>
  );
}
