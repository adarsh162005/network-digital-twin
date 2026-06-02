import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useScenarios } from "@/lib/scenarios";
import { SCENARIOS as FALLBACK } from "@/lib/api";

export default function ScenarioSelect({ value, onChange, testid = "scenario-select", exclude = [] }) {
  const { names } = useScenarios();
  const list = (names && names.length ? names : FALLBACK).filter((n) => !exclude.includes(n));
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        data-testid={testid}
        className="w-[220px] surface font-mono-data uppercase tracking-wider text-xs"
        style={{ borderRadius: 2, color: "var(--text)" }}
      >
        <SelectValue placeholder="Select scenario" />
      </SelectTrigger>
      <SelectContent className="surface font-mono-data" style={{ borderRadius: 2 }}>
        {list.map((s) => (
          <SelectItem
            key={s}
            value={s}
            className="text-xs uppercase tracking-wider focus:bg-[var(--surface-2)]"
            style={{ borderRadius: 2 }}
            data-testid={`scenario-option-${s.toLowerCase().replace(/\s+/g, "-")}`}
          >
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
