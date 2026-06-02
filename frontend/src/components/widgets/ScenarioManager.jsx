import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { useScenarios } from "@/lib/scenarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Trash2, FileSpreadsheet, Loader2 } from "lucide-react";

const REQ = ["latency_ms", "packet_loss_percent", "throughput_mbps", "utilization_percent", "traffic_load_mbps", "active_users", "jitter_ms", "queue_occupancy_percent"];

export default function ScenarioManager({ testid = "scenario-manager" }) {
  const { scenarios, refresh } = useScenarios();
  const [name, setName] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();

  const customs = scenarios.filter((s) => s.custom);

  const upload = async () => {
    if (!name.trim() || !file) { toast.error("Name and CSV required"); return; }
    const lower = (file.name || "").toLowerCase();
    if (!lower.endsWith(".csv")) {
      toast.error("Only .csv files allowed", { description: `Got "${file.name}". Please upload a valid CSV file.` });
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("file", file);
      const { data } = await api.post("/scenarios/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Uploaded "${data.name}"`, { description: `${data.rows} rows ingested` });
      setName(""); setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      await refresh();
    } catch (e) {
      toast.error("Upload failed", { description: e?.response?.data?.detail || e.message });
    } finally { setUploading(false); }
  };

  const remove = async (n) => {
    if (!window.confirm(`Delete custom scenario "${n}"?`)) return;
    try {
      await api.delete(`/scenarios/${encodeURIComponent(n)}`);
      toast.success(`Deleted ${n}`);
      await refresh();
    } catch (e) {
      toast.error("Delete failed", { description: e?.response?.data?.detail || e.message });
    }
  };

  return (
    <div className="surface p-5" data-testid={testid}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-app font-mono-data">// Custom Scenarios</div>
          <div className="text-sm text-strong-app mt-1">Upload your own CSV for digital-twin replay</div>
        </div>
        <FileSpreadsheet className="h-4 w-4 text-cyan-app" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end mb-4">
        <div>
          <Label className="text-[10px] uppercase tracking-widest text-muted-app font-mono-data">Scenario name</Label>
          <Input
            data-testid="custom-scenario-name"
            value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Office Branch A"
            className="mt-1.5 surface font-mono-data text-app" style={{ borderRadius: 2 }}
          />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-widest text-muted-app font-mono-data">CSV file</Label>
          <input
            ref={inputRef}
            data-testid="custom-scenario-file"
            type="file" accept=".csv"
            onChange={(e) => {
              const f = e.target.files?.[0] || null;
              if (f && !(f.name || "").toLowerCase().endsWith(".csv")) {
                toast.error("Only .csv files allowed", { description: `Got "${f.name}".` });
                if (inputRef.current) inputRef.current.value = "";
                setFile(null);
                return;
              }
              setFile(f);
            }}
            className="mt-1.5 block w-full text-xs file:mr-3 file:py-2 file:px-3 file:border-0 file:text-xs file:font-mono-data file:uppercase file:tracking-wider text-app surface px-2 py-1.5"
            style={{
              borderRadius: 2,
              color: "var(--text)",
            }}
          />
        </div>
        <Button
          data-testid="custom-scenario-upload-btn"
          onClick={upload} disabled={uploading || !name || !file}
          className="rounded-none uppercase tracking-widest text-xs font-mono-data h-10"
          style={{ background: "var(--cyan-soft)", color: "var(--cyan)", border: "1px solid var(--cyan)" }}
        >
          {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
          Upload Scenario
        </Button>
      </div>

      <div className="text-[10px] uppercase tracking-widest text-muted2-app font-mono-data mb-2">
        Required columns: {REQ.join(", ")} · min 10 rows
      </div>

      {customs.length > 0 ? (
        <div className="border-t pt-3 mt-3" style={{ borderColor: "var(--border)" }}>
          <div className="text-[10px] uppercase tracking-widest text-muted-app font-mono-data mb-2">Uploaded scenarios</div>
          <ul className="space-y-1.5">
            {customs.map((s) => (
              <li key={s.name} className="flex items-center justify-between text-sm" data-testid={`custom-scenario-${s.name.replace(/\s+/g, '-').toLowerCase()}`}>
                <span className="flex items-center gap-2 text-app">
                  <span className="chip" style={{ color: "var(--cyan)" }}>CUSTOM</span>
                  <span>{s.name}</span>
                  <span className="text-muted2-app font-mono-data text-xs">· {s.rows} rows</span>
                </span>
                <Button
                  variant="ghost" size="sm"
                  data-testid={`delete-scenario-${s.name.replace(/\s+/g, '-').toLowerCase()}`}
                  onClick={() => remove(s.name)}
                  className="h-7 px-2 text-xs uppercase tracking-widest font-mono-data hover:bg-[var(--red-soft)]"
                  style={{ color: "var(--red)", borderRadius: 2 }}
                >
                  <Trash2 className="h-3 w-3 mr-1" /> Remove
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
