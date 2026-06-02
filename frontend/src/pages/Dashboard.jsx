import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, fmt, fmtTimestamp } from "@/lib/api";
import PageHeader from "@/components/widgets/PageHeader";
import KpiCard from "@/components/widgets/KpiCard";
import RiskBadge from "@/components/widgets/RiskBadge";
import SystemHealthCompact from "@/components/widgets/SystemHealthCompact";
import { Activity, Network, Layers, AlertTriangle, BrainCircuit, ArrowRight, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [health, setHealth] = useState(null);
  const [history, setHistory] = useState([]);
  const nav = useNavigate();

  useEffect(() => {
    api.get("/system_health").then((r) => setHealth(r.data));
    api.get("/history?limit=10").then((r) => setHistory(r.data.items || []));
  }, []);

  const latestCurrent = history.find((h) => h.kind === "current");
  const latestFuture = history.find((h) => h.kind === "future");

  return (
    <div data-testid="dashboard-page">
      <PageHeader
        title="Operations Center"
        subtitle="AI-assisted Network Operations Center. Predict current KPIs, forecast future state with LSTM, and surface risk before it impacts your SLA."
        actions={
          <>
            <Button data-testid="run-current-cta" onClick={() => nav("/current")} className="rounded-none surface text-app hover:bg-[var(--surface-2)] uppercase tracking-widest text-xs font-mono-data h-9 px-3">
              Run Current <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
            <Button data-testid="run-future-cta" onClick={() => nav("/future")} className="rounded-none uppercase tracking-widest text-xs font-mono-data h-9 px-3"
              style={{ background: "var(--cyan-soft)", color: "var(--cyan)", border: "1px solid var(--cyan)" }}>
              Forecast (LSTM) <BrainCircuit className="ml-2 h-3.5 w-3.5" />
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-12 gap-4">
        {/* Top KPIs */}
        <div className="col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard testid="kpi-total-predictions" label="Total Predictions" value={health?.total_predictions ?? "—"} accent="cyan" icon={Activity} sublabel="across sessions" />
          <KpiCard testid="kpi-scenarios" label="Scenarios Loaded" value={health?.scenarios_loaded ?? "—"} accent="emerald" icon={Layers} sublabel="datasets cached" />
          <KpiCard testid="kpi-lstm-shape" label="LSTM Input" value={health ? `${health.lstm_input_shape?.[0]}×${health.lstm_input_shape?.[1]}` : "—"} accent="amber" icon={Cpu} sublabel="seq × features" />
          <KpiCard testid="kpi-risk-recent" label="Recent High/Critical" value={(health?.risk_counts_recent?.High ?? 0) + (health?.risk_counts_recent?.Critical ?? 0)} accent="red" icon={AlertTriangle} sublabel="last 20 predictions" />
        </div>

        {/* Latest current */}
        <div className="col-span-12 lg:col-span-6 surface p-5" data-testid="latest-current-panel">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-app font-mono-data">// Current Prediction · Latest</div>
              <div className="text-base text-strong-app mt-1 flex items-center gap-2"><Activity className="h-4 w-4 text-cyan-app" /> Realtime KPI Inference</div>
            </div>
            {latestCurrent ? <RiskBadge level={latestCurrent.risk_level} testid="latest-current-risk" /> : null}
          </div>
          {latestCurrent ? (
            <>
              <div className="grid grid-cols-3 gap-2.5">
                <Mini label="Latency" v={fmt(latestCurrent.outputs?.predicted_latency_ms)} u="ms" />
                <Mini label="Throughput" v={fmt(latestCurrent.outputs?.predicted_throughput_mbps)} u="Mbps" />
                <Mini label="Pkt Loss" v={fmt(latestCurrent.outputs?.predicted_packet_loss_percent)} u="%" />
                <Mini label="Utilization" v={fmt(latestCurrent.outputs?.predicted_utilization_percent)} u="%" />
                <Mini label="Jitter" v={fmt(latestCurrent.outputs?.predicted_jitter_ms)} u="ms" />
                <Mini label="Queue Occ." v={fmt(latestCurrent.outputs?.predicted_queue_occupancy_percent)} u="%" />
              </div>
              <div className="mt-3 text-[10px] uppercase tracking-widest text-muted2-app font-mono-data">
                Generated · {fmtTimestamp(latestCurrent.timestamp)} · {latestCurrent.scenario}
              </div>
            </>
          ) : <EmptyMsg label="No current predictions yet" />}
        </div>

        {/* Latest future */}
        <div className="col-span-12 lg:col-span-6 surface p-5" data-testid="latest-future-panel">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-app font-mono-data">// Future Forecast · LSTM</div>
              <div className="text-base text-strong-app mt-1 flex items-center gap-2"><BrainCircuit className="h-4 w-4 text-emerald-app" /> Predicted Next-Step KPIs</div>
            </div>
            {latestFuture ? <RiskBadge level={latestFuture.risk_level} testid="latest-future-risk" /> : null}
          </div>
          {latestFuture ? (
            <>
              <div className="grid grid-cols-3 gap-2.5">
                <Mini label="Latency" v={fmt(latestFuture.outputs?.future_latency_ms)} u="ms" />
                <Mini label="Throughput" v={fmt(latestFuture.outputs?.future_throughput_mbps)} u="Mbps" />
                <Mini label="Pkt Loss" v={fmt(latestFuture.outputs?.future_packet_loss_percent)} u="%" />
                <Mini label="Utilization" v={fmt(latestFuture.outputs?.future_utilization_percent)} u="%" />
                <Mini label="Jitter" v={fmt(latestFuture.outputs?.future_jitter_ms)} u="ms" />
                <Mini label="Queue Occ." v={fmt(latestFuture.outputs?.future_queue_occupancy_percent)} u="%" />
              </div>
              <div className="mt-3 text-[10px] uppercase tracking-widest text-muted2-app font-mono-data">
                Generated · {fmtTimestamp(latestFuture.timestamp)} · {latestFuture.scenario}
              </div>
            </>
          ) : <EmptyMsg label="No forecasts yet" />}
        </div>

        {/* System Health compact + Activity */}
        <div className="col-span-12 lg:col-span-4">
          <SystemHealthCompact components={health?.components || []} />
        </div>
        <div className="col-span-12 lg:col-span-8 surface p-5" data-testid="activity-feed">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-app font-mono-data">// Live Activity Feed</div>
            <Network className="h-4 w-4 text-cyan-app" />
          </div>
          {history.length === 0 ? <EmptyMsg label="No activity yet" /> : (
            <div className="divide-y" style={{ borderColor: "var(--border)" }}>
              {history.map((h) => (
                <div key={h.id} className="py-2 flex items-center justify-between text-sm" style={{ borderColor: "var(--border)" }}>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono-data uppercase tracking-widest px-2 py-0.5 border"
                      style={{
                        color: h.kind === "future" ? "var(--emerald)" : "var(--cyan)",
                        borderColor: h.kind === "future" ? "var(--emerald)" : "var(--cyan)",
                      }}>
                      {h.kind}
                    </span>
                    <span className="text-app">{h.scenario}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <RiskBadge level={h.risk_level} testid={`activity-risk-${h.id}`} />
                    <span className="text-xs text-muted-app font-mono-data">{fmtTimestamp(h.timestamp)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Mini({ label, v, u }) {
  return (
    <div className="border p-2.5" style={{ borderColor: "var(--border)" }}>
      <div className="text-[9px] uppercase tracking-widest text-muted-app font-mono-data">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-mono-data text-lg text-app">{v}</span>
        <span className="text-[10px] text-muted2-app font-mono-data">{u}</span>
      </div>
    </div>
  );
}
function EmptyMsg({ label }) {
  return <div className="text-sm text-muted-app py-6 text-center font-mono-data uppercase tracking-widest">{label}</div>;
}
