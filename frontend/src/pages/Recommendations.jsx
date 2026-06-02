import { useEffect, useState } from "react";
import { api, fmtTimestamp } from "@/lib/api";
import PageHeader from "@/components/widgets/PageHeader";
import RiskBadge from "@/components/widgets/RiskBadge";
import { Lightbulb, ShieldAlert } from "lucide-react";

export default function Recommendations() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    api.get("/history?limit=30").then((r) => {
      const filtered = (r.data.items || []).filter((h) => Array.isArray(h.outputs?.recommendations) && h.outputs.recommendations.length);
      setItems(filtered);
    });
  }, []);

  return (
    <div data-testid="recommendations-page">
      <PageHeader
        title="Recommendations"
        subtitle="AI-generated mitigation plans derived from rule analysis of predicted KPIs and active scenario."
      />

      {items.length === 0 ? (
        <div className="surface p-10 text-center text-muted-app font-mono-data uppercase tracking-widest text-sm">
          Run a prediction or forecast to generate recommendations.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((h) => {
            const high = h.risk_level === "High" || h.risk_level === "Critical";
            return (
              <div key={h.id} className="surface p-5" data-testid={`rec-card-${h.id}`}>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {high ? <ShieldAlert className="h-4 w-4" style={{ color: "var(--red)" }} /> : <Lightbulb className="h-4 w-4" style={{ color: "var(--amber)" }} />}
                    <span className="text-app text-sm">{h.scenario}</span>
                    <span className="text-[10px] uppercase tracking-widest text-muted-app">· {h.kind}</span>
                  </div>
                  <RiskBadge level={h.risk_level} testid={`rec-risk-${h.id}`} />
                </div>
                <ul className="space-y-1.5">
                  {h.outputs.recommendations.map((r, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-app">
                      <span className="mt-1.5 h-1 w-1" style={{ background: "var(--cyan)" }} />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 text-[10px] uppercase tracking-widest text-muted2-app font-mono-data">
                  {fmtTimestamp(h.timestamp)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
