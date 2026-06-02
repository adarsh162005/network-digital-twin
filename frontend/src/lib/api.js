import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
console.log("BACKEND_URL =", BACKEND_URL);
export const API = `${BACKEND_URL}/api`;
export const api = axios.create({ baseURL: API, timeout: 60000 });

export const SCENARIOS = ["Low Traffic", "Medium Traffic", "High Traffic", "Congestion Attack"];

export const RISK_META = {
  Stable:   { color: "var(--emerald)", label: "STABLE",   weight: 1 },
  Moderate: { color: "var(--cyan)",    label: "MODERATE", weight: 2 },
  Elevated: { color: "var(--amber)",   label: "ELEVATED", weight: 3 },
  High:     { color: "var(--red)",     label: "HIGH",     weight: 4 },
  Critical: { color: "var(--red)",     label: "CRITICAL", weight: 5 },
};

export function fmt(v, decimals = 2) {
  if (v === undefined || v === null || Number.isNaN(v)) return "—";
  return Number(v).toFixed(decimals);
}

export function fmtTimestamp(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

export const FEATURE_LABELS = {
  latency_ms: "Latency",
  packet_loss_percent: "Packet Loss",
  throughput_mbps: "Throughput",
  utilization_percent: "Utilization",
  traffic_load_mbps: "Traffic Load",
  active_users: "Active Users",
  jitter_ms: "Jitter",
  queue_occupancy_percent: "Queue Occupancy",
};
export const FEATURE_UNITS = {
  latency_ms: "ms",
  packet_loss_percent: "%",
  throughput_mbps: "Mbps",
  utilization_percent: "%",
  traffic_load_mbps: "Mbps",
  active_users: "",
  jitter_ms: "ms",
  queue_occupancy_percent: "%",
};
