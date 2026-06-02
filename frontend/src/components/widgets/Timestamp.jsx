import { Clock } from "lucide-react";
import { fmtTimestamp } from "@/lib/api";

export default function Timestamp({ iso, label = "Generated at", testid = "timestamp" }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono-data text-muted-app" data-testid={testid}>
      <Clock className="h-3 w-3" />
      <span className="uppercase tracking-widest text-[10px]">{label}:</span>
      <span className="text-app">{fmtTimestamp(iso)}</span>
    </span>
  );
}
