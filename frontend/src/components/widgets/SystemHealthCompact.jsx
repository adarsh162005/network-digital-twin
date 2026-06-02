import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

const TONE = {
  ok:   { color: "var(--emerald)", Icon: CheckCircle2 },
  warn: { color: "var(--amber)",   Icon: AlertTriangle },
  bad:  { color: "var(--red)",     Icon: XCircle },
};

export default function SystemHealthCompact({ components = [], testid = "system-health-compact" }) {
  return (
    <div className="surface p-4" data-testid={testid}>
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-app font-mono-data mb-3">// System Health</div>
      <div className="space-y-2">
        {components.map((c) => {
          const t = TONE[c.tone] || TONE.ok;
          const Icon = t.Icon;
          return (
            <div key={c.name} className="flex items-center justify-between text-sm" data-testid={`health-row-${c.name.toLowerCase().replace(/\s+/g, '-')}`}>
              <div className="flex items-center gap-2 text-app">
                <Icon className="h-3.5 w-3.5" style={{ color: t.color }} />
                <span>{c.name}</span>
              </div>
              <span className="font-mono-data text-xs uppercase tracking-widest" style={{ color: t.color }}>
                {c.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
