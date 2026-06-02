import { useEffect, useState } from "react";
import { api, fmt, fmtTimestamp } from "@/lib/api";
import PageHeader from "@/components/widgets/PageHeader";
import RiskBadge from "@/components/widgets/RiskBadge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trash2, RefreshCw, Download } from "lucide-react";
import { API } from "@/lib/api";

export default function HistoryPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/history?limit=200");
      setItems(data.items || []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const clearAll = async () => {
    if (!window.confirm("Clear all prediction history?")) return;
    const { data } = await api.delete("/history");
    toast.success(`Cleared ${data.deleted} records`);
    load();
  };

  return (
    <div data-testid="history-page">
      <PageHeader
        title="Network History"
        subtitle="Every current prediction and future forecast is persisted to MongoDB. Inspect trends across sessions."
        actions={
          <>
            <Button data-testid="refresh-history-btn" onClick={load} className="rounded-none surface text-app hover:bg-[var(--surface-2)] uppercase tracking-widest text-xs font-mono-data h-9 px-3">
              <RefreshCw className="h-3.5 w-3.5 mr-2" /> Refresh
            </Button>
            <a
              data-testid="export-history-csv"
              href={`${API}/history/export.csv`}
              className="inline-flex items-center rounded-none surface text-app hover:bg-[var(--surface-2)] uppercase tracking-widest text-xs font-mono-data h-9 px-3"
              download
            >
              <Download className="h-3.5 w-3.5 mr-2" /> Export CSV
            </a>
            <Button data-testid="clear-history-btn" onClick={clearAll} className="rounded-none uppercase tracking-widest text-xs font-mono-data h-9 px-3"
              style={{ background: "var(--red-soft)", color: "var(--red)", border: "1px solid var(--red)" }}>
              <Trash2 className="h-3.5 w-3.5 mr-2" /> Clear All
            </Button>
          </>
        }
      />

      <div className="surface overflow-x-auto" data-testid="history-table">
        <table className="w-full font-mono-data text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-widest text-muted-app" style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="text-left px-4 py-3">Time</th>
              <th className="text-left px-4 py-3">Kind</th>
              <th className="text-left px-4 py-3">Scenario</th>
              <th className="text-right px-4 py-3">Latency</th>
              <th className="text-right px-4 py-3">Throughput</th>
              <th className="text-right px-4 py-3">Pkt Loss</th>
              <th className="text-right px-4 py-3">Util</th>
              <th className="text-center px-4 py-3">Risk</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-10 text-muted-app uppercase tracking-widest">
                {loading ? "Loading…" : "No history yet"}
              </td></tr>
            ) : items.map((h) => {
              const lat = h.outputs?.predicted_latency_ms ?? h.outputs?.future_latency_ms;
              const thr = h.outputs?.predicted_throughput_mbps ?? h.outputs?.future_throughput_mbps;
              const pl = h.outputs?.predicted_packet_loss_percent ?? h.outputs?.future_packet_loss_percent;
              const ut = h.outputs?.predicted_utilization_percent ?? h.outputs?.future_utilization_percent;
              return (
                <tr key={h.id} className="hover:bg-[var(--surface-2)]" style={{ borderBottom: "1px solid var(--border)" }} data-testid={`history-row-${h.id}`}>
                  <td className="px-4 py-2 text-muted-app">{fmtTimestamp(h.timestamp)}</td>
                  <td className="px-4 py-2">
                    <span className="text-[10px] uppercase px-2 py-0.5 border"
                      style={{ color: h.kind === "future" ? "var(--emerald)" : "var(--cyan)", borderColor: h.kind === "future" ? "var(--emerald)" : "var(--cyan)" }}>
                      {h.kind}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-app">{h.scenario}</td>
                  <td className="px-4 py-2 text-right text-app">{fmt(lat)}</td>
                  <td className="px-4 py-2 text-right text-app">{fmt(thr)}</td>
                  <td className="px-4 py-2 text-right text-app">{fmt(pl)}</td>
                  <td className="px-4 py-2 text-right text-app">{fmt(ut)}</td>
                  <td className="px-4 py-2 text-center"><RiskBadge level={h.risk_level} testid={`risk-${h.id}`} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
