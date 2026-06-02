import { Sparkles } from "lucide-react";

export default function ForecastSummary({ horizon, messages, testid = "forecast-summary" }) {
  if (!messages || messages.length === 0) return null;
  return (
    <div className="surface p-5" data-testid={testid}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" style={{ color: "var(--cyan)" }} />
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-app font-mono-data">// AI Forecast Summary</div>
            <div className="text-sm text-strong-app">Operational outlook · Next {horizon} time steps</div>
          </div>
        </div>
        <span className="chip" data-testid="forecast-horizon-label">Horizon · {horizon} steps</span>
      </div>
      <ul className="space-y-1.5">
        {messages.map((m, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-app">
            <span className="mt-1.5 inline-block h-1 w-1" style={{ background: "var(--cyan)" }} />
            <span className="leading-relaxed">{m}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
