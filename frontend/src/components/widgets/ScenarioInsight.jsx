import { Info } from "lucide-react";

export default function ScenarioInsight({ scenario, insight, testid = "scenario-insight" }) {
  if (!insight) return null;
  return (
    <div className="surface px-4 py-3 flex items-start gap-3" data-testid={testid}>
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "var(--cyan)" }} />
      <div className="flex-1">
        <div className="text-[10px] uppercase tracking-[0.16em] text-muted-app font-mono-data">
          // Scenario Insight {scenario ? `· ${scenario}` : ""}
        </div>
        <p className="mt-1 text-sm text-app leading-relaxed">{insight}</p>
      </div>
    </div>
  );
}
