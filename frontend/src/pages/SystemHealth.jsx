import { useEffect, useState } from "react";
import { api, fmtTimestamp } from "@/lib/api";
import { useScenarios } from "@/lib/scenarios";
import PageHeader from "@/components/widgets/PageHeader";
import SystemHealthCompact from "@/components/widgets/SystemHealthCompact";
import ScenarioManager from "@/components/widgets/ScenarioManager";
import Timestamp from "@/components/widgets/Timestamp";
import { Cpu, Database, Layers, Activity } from "lucide-react";

const RISK_ORDER = ["Stable", "Moderate", "Elevated", "High", "Critical"];
const RISK_COLORS = {
  Stable: "var(--emerald)",
  Moderate: "var(--cyan)",
  Elevated: "var(--amber)",
  High: "var(--red)",
  Critical: "var(--red)",
};

export default function SystemHealth() {
  const [health, setHealth] = useState(null);
  const { scenarios, refresh: refreshScenarios } = useScenarios();

  useEffect(() => {
    api.get("/system_health").then((r) => setHealth(r.data));
    refreshScenarios();
  }, [refreshScenarios]);

  return (
    <div data-testid="health-page">
      <PageHeader
        title="System Health"
        subtitle="Live status of the digital twin runtime: model, datasets, and prediction store."
        actions={health?.generated_at ? <Timestamp iso={health.generated_at} testid="health-timestamp" /> : null}
      />

      <div className="grid grid-cols-12 gap-4">
        <Card icon={Activity} accent="emerald" label="Model" value={health?.model_loaded ? "Operational" : "Offline"} testid="health-model" />
        <Card icon={Cpu} accent="cyan" label="LSTM Input Shape" value={health ? `(${health.lstm_input_shape?.join(", ")})` : "—"} testid="health-shape" />
        <Card icon={Layers} accent="amber" label="Scenarios Loaded" value={health?.scenarios_loaded ?? "—"} testid="health-scenarios" />
        <Card icon={Activity} accent="cyan" label="Total Predictions" value={health?.total_predictions ?? "—"} testid="health-total" />

        <div className="col-span-12 md:col-span-4">
          <SystemHealthCompact components={health?.components || []} />
        </div>

        <div className="col-span-12 md:col-span-4 surface p-5" data-testid="features-list">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-app font-mono-data mb-3">// LSTM Feature Vector</div>
          <ol className="grid grid-cols-1 gap-1.5">
            {(health?.features || []).map((f, i) => (
              <li key={f} className="flex items-center gap-2 text-sm text-app font-mono-data">
                <span className="text-cyan-app text-xs w-6">[{i}]</span>
                <span>{f}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="col-span-12 md:col-span-4 surface p-5" data-testid="scenarios-list">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-app font-mono-data mb-3">// Datasets</div>
          <ul className="space-y-2">
            {scenarios.map((s) => (
              <li key={s.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-app">
                  <Database className="h-3.5 w-3.5 text-cyan-app" />
                  {s.name}
                  {s.custom ? <span className="chip" style={{ color: "var(--cyan)" }}>CUSTOM</span> : null}
                </span>
                <span className="font-mono-data text-xs" style={{ color: s.available ? "var(--emerald)" : "var(--red)" }}>
                  {s.available ? `${s.rows} rows` : "missing"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Custom Scenario Manager */}
        <div className="col-span-12">
          <ScenarioManager />
        </div>

        <div className="col-span-12 surface p-5" data-testid="risk-distribution">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-app font-mono-data mb-3">// Recent Risk Distribution (last 20)</div>
          <div className="flex items-end gap-6 h-36">
            {RISK_ORDER.map((k) => {
              const v = health?.risk_counts_recent?.[k] ?? 0;
              const maxV = Math.max(1, ...RISK_ORDER.map((kk) => health?.risk_counts_recent?.[kk] ?? 0));
              const h = `${(v / maxV) * 100}%`;
              const color = RISK_COLORS[k];
              return (
                <div key={k} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex justify-center items-end h-24">
                    <div className="w-10" style={{ height: h, background: color, opacity: 0.85 }} />
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-app font-mono-data">{k}</div>
                  <div className="text-app font-mono-data text-sm">{v}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="col-span-12 surface p-5" data-testid="thresholds-list">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-app font-mono-data mb-3">// Operational Thresholds</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {health?.thresholds ? Object.entries(health.thresholds).filter(([_, v]) => v !== null).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border p-2.5" style={{ borderColor: "var(--border)" }}>
                <span className="text-xs text-muted-app font-mono-data">{k}</span>
                <span className="text-sm font-mono-data text-amber-app">≥ {v}</span>
              </div>
            )) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ icon: Icon, label, value, accent = "cyan", testid }) {
  const colors = { cyan: "var(--cyan)", emerald: "var(--emerald)", amber: "var(--amber)", red: "var(--red)" };
  const c = colors[accent] || colors.cyan;
  return (
    <div className="col-span-6 md:col-span-3 surface p-4" data-testid={testid}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-app font-mono-data">{label}</span>
        {Icon ? <Icon className="h-3.5 w-3.5" style={{ color: c }} /> : null}
      </div>
      <div className="font-mono-data text-xl" style={{ color: c }}>{value}</div>
    </div>
  );
}
