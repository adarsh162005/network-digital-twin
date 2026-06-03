"""Network Digital Twin backend - FastAPI."""
from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from pathlib import Path
from datetime import datetime, timezone
import os, uuid, logging, warnings, asyncio, io, re
import numpy as np
import pandas as pd
import joblib

warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
import tensorflow as tf

ROOT_DIR = Path(__file__).parent
ASSETS = ROOT_DIR / "ml_assets"
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]

client = AsyncIOMotorClient(
    mongo_url,
    serverSelectionTimeoutMS=30000
)

db = client[os.environ["DB_NAME"]]

FEATURES = [
    "latency_ms", "packet_loss_percent", "throughput_mbps", "utilization_percent",
    "traffic_load_mbps", "active_users", "jitter_ms", "queue_occupancy_percent",
]
# Operational thresholds (warning level)
THRESHOLDS = {
    "latency_ms": 100,
    "packet_loss_percent": 5,
    "throughput_mbps": None,
    "utilization_percent": 85,
    "jitter_ms": 15,
    "queue_occupancy_percent": 90,
}
# Metric "higher is bad" classification, for delta coloring on the frontend
DELTA_BIAS = {
    "latency_ms": "bad_up",
    "packet_loss_percent": "bad_up",
    "throughput_mbps": "good_up",
    "utilization_percent": "bad_up",
    "traffic_load_mbps": "neutral",
    "active_users": "neutral",
    "jitter_ms": "bad_up",
    "queue_occupancy_percent": "bad_up",
}
SEQ_LEN = 10
SCENARIOS = {
    "Low Traffic": "ordered_low_traffic.csv",
    "Medium Traffic": "ordered_medium_traffic.csv",
    "High Traffic": "ordered_high_traffic.csv",
    "Congestion Attack": "ordered_congestion.csv",
}
SCENARIO_MULT = {
    "Low Traffic": dict(load=0.8, util=0.85, lat=0.8, ploss=0.5, jit=0.7),
    "Medium Traffic": dict(load=1.0, util=1.0, lat=1.0, ploss=1.0, jit=1.0),
    "High Traffic": dict(load=1.2, util=1.15, lat=1.4, ploss=1.8, jit=1.4),
    "Congestion Attack": dict(load=1.4, util=1.35, lat=2.0, ploss=3.5, jit=2.0),
}
SCENARIO_INSIGHTS = {
    "Low Traffic": "Low utilization scenario. Network is well within capacity; latency and packet loss expected to remain minimal.",
    "Medium Traffic": "Moderate utilization. Typical business-hour traffic profile with stable throughput.",
    "High Traffic": "High traffic conditions may increase utilization and congestion probability. Monitor queue occupancy closely.",
    "Congestion Attack": "Congestion attack scenario predicts severe packet loss and unstable throughput patterns. SLA breach likely.",
}

logger = logging.getLogger("net-twin")
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

logger.info("Loading LSTM model + scaler...")
LSTM_MODEL = tf.keras.models.load_model(str(ASSETS / "trained_lstm_model.h5"), compile=False)
SCALER = joblib.load(str(ASSETS / "lstm_scaler.pkl"))
logger.info(f"LSTM ready. input={LSTM_MODEL.input_shape} output={LSTM_MODEL.output_shape}")

DATA_CACHE: Dict[str, pd.DataFrame] = {}
CUSTOM_META: Dict[str, Dict[str, Any]] = {}  # scenario_name -> {file, rows, uploaded_at}
for name, fname in SCENARIOS.items():
    path = ASSETS / fname
    if path.exists():
        DATA_CACHE[name] = pd.read_csv(path)
        logger.info(f"Loaded {name}: {len(DATA_CACHE[name])} rows")

# Load any persisted custom scenarios (saved as custom_<slug>.csv with metadata in custom_<slug>.json)
import json
for jf in sorted(ASSETS.glob("custom_*.json")):
    try:
        meta = json.loads(jf.read_text())
        csv_path = ASSETS / meta["file"]
        if csv_path.exists():
            df = pd.read_csv(csv_path)
            DATA_CACHE[meta["name"]] = df
            CUSTOM_META[meta["name"]] = meta
            SCENARIO_INSIGHTS[meta["name"]] = meta.get("insight") or f"User-uploaded scenario · {len(df)} rows ingested for digital-twin replay."
            SCENARIO_MULT[meta["name"]] = SCENARIO_MULT["Medium Traffic"]
            logger.info(f"Loaded custom scenario {meta['name']}: {len(df)} rows")
    except Exception as e:
        logger.warning(f"Failed to load custom scenario {jf}: {e}")

app = FastAPI(title="Network Digital Twin")
api = APIRouter(prefix="/api")


# ===== Models =====
class PredictRequest(BaseModel):
    bandwidth_mbps: float = Field(..., gt=0)
    active_users: int = Field(..., gt=0)
    traffic_load_mbps: float = Field(..., gt=0)
    scenario: str

class FutureRequest(BaseModel):
    scenario: str

class HistoryRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    kind: str
    scenario: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    inputs: Dict[str, Any] = {}
    outputs: Dict[str, Any] = {}
    risk_level: str = "Stable"


# ===== Risk classification (5-level enterprise) =====
def classify_risk(latency: float, packet_loss: float, utilization: float, queue: float) -> str:
    score = 0
    if latency > 120: score += 3
    elif latency > 80: score += 2
    elif latency > 50: score += 1
    if packet_loss > 5: score += 3
    elif packet_loss > 2.5: score += 2
    elif packet_loss > 1: score += 1
    if utilization > 92: score += 3
    elif utilization > 80: score += 2
    elif utilization > 65: score += 1
    if queue > 90: score += 2
    elif queue > 75: score += 1

    if score >= 9: return "Critical"
    if score >= 6: return "High"
    if score >= 4: return "Elevated"
    if score >= 2: return "Moderate"
    return "Stable"


def recommendations(scenario: str, lat: float, ploss: float, util: float, risk: str) -> List[str]:
    recs = []
    if util > 80:
        recs.append("Increase available bandwidth or scale routing capacity.")
    if ploss > 2.5:
        recs.append("Enable QoS prioritization to reduce packet loss on critical flows.")
    if lat > 70:
        recs.append("Activate load balancing across redundant paths to lower latency.")
    if scenario == "Congestion Attack":
        recs.append("Trigger DDoS mitigation policies and rate-limit suspicious sources.")
    if risk in ("High", "Critical"):
        recs.append("Notify NOC on-call and consider failover to backup links.")
    if risk == "Critical":
        recs.append("Initiate incident response protocol. Engage upstream provider for capacity scaling.")
    if not recs:
        recs.append("Network operating within normal thresholds. Continue monitoring.")
    return recs


def compute_deltas(predicted: Dict[str, float], baseline: Dict[str, float]) -> Dict[str, Dict[str, Any]]:
    out = {}
    for f in FEATURES:
        h = float(baseline.get(f, 0))
        p = float(predicted.get(f, 0))
        if abs(h) < 1e-6:
            pct = 0.0
        else:
            pct = (p - h) / abs(h) * 100.0
        out[f] = {
            "pct": round(pct, 1),
            "baseline": round(h, 2),
            "bias": DELTA_BIAS.get(f, "neutral"),
        }
    return out


def build_forecast_summary(history_tail: np.ndarray, forecast: np.ndarray) -> List[str]:
    """Generate operational summary text from forecast trends."""
    msgs = []
    hist_mean = history_tail.mean(axis=0)
    fc_mean = forecast.mean(axis=0)

    def pct(idx):
        h = hist_mean[idx]
        return (fc_mean[idx] - h) / abs(h) * 100 if abs(h) > 1e-6 else 0

    lat_change = pct(0)
    if lat_change > 20: msgs.append("Latency expected to increase significantly over the forecast horizon.")
    elif lat_change > 8: msgs.append("Latency expected to rise gradually.")
    elif lat_change < -10: msgs.append("Latency expected to improve relative to recent history.")

    thr_change = pct(2)
    if thr_change < -20: msgs.append("Throughput likely to degrade under sustained load.")
    elif thr_change < -8: msgs.append("Throughput trending slightly downward.")
    elif thr_change > 10: msgs.append("Throughput trending upward.")

    util_max = float(forecast[:, 3].max())
    if util_max > 92: msgs.append("Utilization approaching critical threshold within the forecast window.")
    elif util_max > 80: msgs.append("Utilization rising toward the 85% warning threshold.")

    pl_max = float(forecast[:, 1].max())
    if pl_max > 5: msgs.append("Severe packet loss predicted; SLA breach likely.")
    elif pl_max > 2: msgs.append("Elevated packet loss expected in the forecast window.")

    queue_max = float(forecast[:, 7].max())
    if queue_max > 90: msgs.append("Queue occupancy nearing saturation; congestion risk high.")

    if not msgs:
        msgs.append("Network forecast stable across the horizon. No critical excursions detected.")
    return msgs


def current_prediction(req: PredictRequest) -> Dict[str, Any]:
    m = SCENARIO_MULT.get(req.scenario, SCENARIO_MULT["Medium Traffic"])
    df = DATA_CACHE.get(req.scenario)

    util_input = min(100.0, (req.traffic_load_mbps / max(req.bandwidth_mbps, 0.1)) * 100.0)
    if df is not None:
        hist_util = float(df["utilization_percent"].mean())
        utilization = round(0.6 * util_input * m["util"] + 0.4 * hist_util, 2)
        user_factor = 1 + min(req.active_users / 500, 1.0)
        latency = round(float(df["latency_ms"].mean()) * m["lat"] * (0.5 + 0.5 * user_factor / 2), 2)
        ploss = round(float(df["packet_loss_percent"].mean()) * m["ploss"] * (0.7 + util_input / 300), 2)
        jitter = round(float(df["jitter_ms"].mean()) * m["jit"], 2)
        queue = round(min(100.0, utilization + np.random.uniform(-3, 6)), 2)
    else:
        utilization = round(util_input * m["util"], 2)
        latency = round(15 + utilization * 0.8 * m["lat"], 2)
        ploss = round(0.2 + (utilization / 25) * m["ploss"], 2)
        jitter = round(2 + (utilization / 12) * m["jit"], 2)
        queue = round(min(100.0, utilization + 5), 2)

    throughput = round(min(req.bandwidth_mbps * 0.99, req.traffic_load_mbps * (1 - ploss / 100)), 2)
    utilization = float(min(100.0, max(0.0, utilization)))
    latency = float(max(1.0, latency))
    ploss = float(max(0.0, min(100.0, ploss)))

    graph = {}
    deltas = {}
    if df is not None:
        tail = df.tail(60).reset_index(drop=True)
        graph = {
            "labels": [f"t-{60-i}" for i in range(len(tail))],
            "latency_ms": [round(float(v), 2) for v in tail["latency_ms"].tolist()],
            "throughput_mbps": [round(float(v), 2) for v in tail["throughput_mbps"].tolist()],
            "packet_loss_percent": [round(float(v), 2) for v in tail["packet_loss_percent"].tolist()],
            "utilization_percent": [round(float(v), 2) for v in tail["utilization_percent"].tolist()],
        }
        baseline = {f: float(df[f].mean()) for f in FEATURES}
        predicted = {
            "latency_ms": latency, "packet_loss_percent": ploss, "throughput_mbps": throughput,
            "utilization_percent": utilization, "traffic_load_mbps": req.traffic_load_mbps,
            "active_users": req.active_users, "jitter_ms": jitter, "queue_occupancy_percent": queue,
        }
        all_deltas = compute_deltas(predicted, baseline)
        # Only meaningful derived KPIs vs scenario mean (skip input-bound ones)
        meaningful = {"latency_ms", "packet_loss_percent", "utilization_percent", "jitter_ms", "queue_occupancy_percent"}
        deltas = {k: v for k, v in all_deltas.items() if k in meaningful}

    risk = classify_risk(latency, ploss, utilization, queue)
    return {
        "predicted_latency_ms": latency,
        "predicted_packet_loss_percent": ploss,
        "predicted_throughput_mbps": throughput,
        "predicted_utilization_percent": utilization,
        "predicted_jitter_ms": jitter,
        "predicted_queue_occupancy_percent": queue,
        "risk_level": risk,
        "recommendations": recommendations(req.scenario, latency, ploss, utilization, risk),
        "graph_data": graph,
        "deltas": deltas,
        "scenario_insight": SCENARIO_INSIGHTS.get(req.scenario, ""),
        "thresholds": THRESHOLDS,
    }


def future_prediction(scenario: str) -> Dict[str, Any]:
    df = DATA_CACHE.get(scenario)
    if df is None or len(df) < SEQ_LEN:
        raise HTTPException(status_code=400, detail=f"No dataset available for scenario {scenario}")

    seq = df[FEATURES].tail(SEQ_LEN).to_numpy().astype(np.float32)
    scaled = SCALER.transform(seq)
    x = scaled.reshape(1, SEQ_LEN, 8)
    y_scaled = LSTM_MODEL.predict(x, verbose=0)[0]
    y = SCALER.inverse_transform(y_scaled.reshape(1, -1))[0]
    pred = {f: round(float(v), 2) for f, v in zip(FEATURES, y)}

    horizon = 20
    current_seq = scaled.copy()
    forecast_steps = []
    for _ in range(horizon):
        xs = current_seq.reshape(1, SEQ_LEN, 8)
        ys = LSTM_MODEL.predict(xs, verbose=0)[0]
        forecast_steps.append(ys.copy())
        current_seq = np.vstack([current_seq[1:], ys.reshape(1, -1)])
    forecast = SCALER.inverse_transform(np.array(forecast_steps))

    tail = df[FEATURES].tail(30).to_numpy()
    combined = np.vstack([tail, forecast])
    labels = [f"t-{30-i}" for i in range(30)] + [f"t+{i+1}" for i in range(horizon)]

    graph_data = {"labels": labels, "history_len": 30, "forecast_len": horizon}
    for i, fname in enumerate(FEATURES):
        graph_data[fname] = [round(float(v), 2) for v in combined[:, i].tolist()]

    risk = classify_risk(
        pred["latency_ms"], pred["packet_loss_percent"],
        pred["utilization_percent"], pred["queue_occupancy_percent"],
    )

    last_hist = df[FEATURES].iloc[-1].to_dict()
    deltas = compute_deltas(pred, {f: float(last_hist[f]) for f in FEATURES})
    summary = build_forecast_summary(tail, forecast)

    return {
        "future_latency_ms": pred["latency_ms"],
        "future_packet_loss_percent": pred["packet_loss_percent"],
        "future_throughput_mbps": pred["throughput_mbps"],
        "future_utilization_percent": pred["utilization_percent"],
        "future_traffic_load_mbps": pred["traffic_load_mbps"],
        "future_active_users": pred["active_users"],
        "future_jitter_ms": pred["jitter_ms"],
        "future_queue_occupancy_percent": pred["queue_occupancy_percent"],
        "risk_level": risk,
        "recommendations": recommendations(scenario, pred["latency_ms"], pred["packet_loss_percent"], pred["utilization_percent"], risk),
        "graph_data": graph_data,
        "deltas": deltas,
        "scenario_insight": SCENARIO_INSIGHTS.get(scenario, ""),
        "forecast_summary": summary,
        "forecast_horizon": horizon,
        "thresholds": THRESHOLDS,
    }


# ===== Endpoints =====
@api.get("/")
async def root():
    return {"service": "Network Digital Twin", "status": "ok"}


@api.get("/scenarios")
async def list_scenarios():
    all_names = list(SCENARIOS.keys()) + [n for n in DATA_CACHE if n not in SCENARIOS]
    return {"scenarios": [
        {
            "name": n,
            "available": n in DATA_CACHE,
            "rows": int(len(DATA_CACHE[n])) if n in DATA_CACHE else 0,
            "insight": SCENARIO_INSIGHTS.get(n, ""),
            "custom": n not in SCENARIOS,
            "uploaded_at": CUSTOM_META.get(n, {}).get("uploaded_at"),
        }
        for n in all_names
    ]}


_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 _\-]{1,39}$")
def _slug(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_").lower()


@api.post("/scenarios/upload")
async def upload_scenario(name: str = Form(...), file: UploadFile = File(...)):
    if not _NAME_RE.match(name):
        raise HTTPException(status_code=400, detail="Invalid name. Letters, digits, spaces, _, - allowed (2-40 chars, must start alphanumeric).")
    if name in SCENARIOS:
        raise HTTPException(status_code=400, detail="Name conflicts with a built-in scenario.")
    # Enforce CSV-only by extension AND content-type
    fname_in = (file.filename or "").lower()
    if not fname_in.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only .csv files are accepted. Please upload a valid CSV file.")
    ctype = (file.content_type or "").lower()
    if ctype and ctype not in ("text/csv", "application/csv", "application/vnd.ms-excel", "application/octet-stream", "text/plain"):
        raise HTTPException(status_code=400, detail=f"Only CSV files are accepted. Received content type: {file.content_type}")
    content = await file.read()
    if len(content) > 5_000_000:
        raise HTTPException(status_code=400, detail="File too large (max 5 MB).")
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"CSV parse error: {e}")
    missing = [f for f in FEATURES if f not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing required columns: {missing}. Required: {FEATURES}")
    if len(df) < SEQ_LEN:
        raise HTTPException(status_code=400, detail=f"Need at least {SEQ_LEN} rows for LSTM forecasting; got {len(df)}.")

    slug = _slug(name)
    fname = f"custom_{slug}.csv"
    df.to_csv(ASSETS / fname, index=False)
    meta = {
        "name": name, "file": fname, "rows": int(len(df)),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "insight": f"User-uploaded scenario · {len(df)} rows ingested for digital-twin replay.",
    }
    (ASSETS / f"custom_{slug}.json").write_text(json.dumps(meta))
    DATA_CACHE[name] = df
    CUSTOM_META[name] = meta
    SCENARIO_INSIGHTS[name] = meta["insight"]
    SCENARIO_MULT[name] = SCENARIO_MULT["Medium Traffic"]
    return {"name": name, "rows": len(df), "uploaded_at": meta["uploaded_at"]}


@api.delete("/scenarios/{name}")
async def delete_scenario(name: str):
    if name in SCENARIOS:
        raise HTTPException(status_code=400, detail="Cannot delete a built-in scenario.")
    if name not in DATA_CACHE:
        raise HTTPException(status_code=404, detail="Scenario not found.")
    slug = _slug(name)
    for ext in ("csv", "json"):
        p = ASSETS / f"custom_{slug}.{ext}"
        if p.exists(): p.unlink()
    DATA_CACHE.pop(name, None)
    CUSTOM_META.pop(name, None)
    SCENARIO_INSIGHTS.pop(name, None)
    SCENARIO_MULT.pop(name, None)
    return {"deleted": name}


@api.post("/predict")
async def predict(req: PredictRequest):
    if req.scenario not in DATA_CACHE:
        raise HTTPException(status_code=400, detail="Unknown scenario")
    result = current_prediction(req)
    rec = HistoryRecord(
        kind="current", scenario=req.scenario,
        inputs=req.model_dump(),
        outputs={k: v for k, v in result.items() if k != "graph_data"},
        risk_level=result["risk_level"],
    )
    doc = rec.model_dump()
    doc["timestamp"] = doc["timestamp"].isoformat()
    doc["graph_data"] = result["graph_data"]
    await db.history.insert_one(doc)
    result["id"] = rec.id
    result["timestamp"] = rec.timestamp.isoformat()
    return result


@api.post("/future_predict")
async def future_predict(req: FutureRequest):
    if req.scenario not in DATA_CACHE:
        raise HTTPException(status_code=400, detail="Unknown scenario")
    result = await asyncio.to_thread(future_prediction, req.scenario)
    rec = HistoryRecord(
        kind="future", scenario=req.scenario,
        inputs=req.model_dump(),
        outputs={k: v for k, v in result.items() if k != "graph_data"},
        risk_level=result["risk_level"],
    )
    doc = rec.model_dump()
    doc["timestamp"] = doc["timestamp"].isoformat()
    doc["graph_data"] = result["graph_data"]
    await db.history.insert_one(doc)
    result["id"] = rec.id
    result["timestamp"] = rec.timestamp.isoformat()
    return result


@api.get("/history")
async def get_history(limit: int = 50):
    docs = await db.history.find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return {"items": docs}


@api.delete("/history")
async def clear_history():
    res = await db.history.delete_many({})
    return {"deleted": res.deleted_count}


@api.get("/history/export.csv")
async def export_history_csv(limit: int = 1000):
    docs = await db.history.find({}, {"_id": 0, "graph_data": 0}).sort("timestamp", -1).to_list(limit)
    rows = []
    for d in docs:
        out = d.get("outputs", {})
        rows.append({
            "id": d.get("id"),
            "timestamp": d.get("timestamp"),
            "kind": d.get("kind"),
            "scenario": d.get("scenario"),
            "risk_level": d.get("risk_level"),
            "latency_ms": out.get("predicted_latency_ms") or out.get("future_latency_ms"),
            "throughput_mbps": out.get("predicted_throughput_mbps") or out.get("future_throughput_mbps"),
            "packet_loss_percent": out.get("predicted_packet_loss_percent") or out.get("future_packet_loss_percent"),
            "utilization_percent": out.get("predicted_utilization_percent") or out.get("future_utilization_percent"),
            "jitter_ms": out.get("predicted_jitter_ms") or out.get("future_jitter_ms"),
            "queue_occupancy_percent": out.get("predicted_queue_occupancy_percent") or out.get("future_queue_occupancy_percent"),
            "recommendations": " | ".join(out.get("recommendations", []) or []),
        })
    df = pd.DataFrame(rows)
    stream = io.StringIO()
    df.to_csv(stream, index=False)
    return Response(
        content=stream.getvalue(), media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=nettwin_history.csv"},
    )


class CompareRequest(BaseModel):
    scenarios: List[str] = Field(..., min_length=2, max_length=2)


@api.post("/compare")
async def compare_scenarios(req: CompareRequest):
    if len(set(req.scenarios)) != 2:
        raise HTTPException(status_code=400, detail="Provide two different scenarios.")
    # Pre-validate both names before running expensive LSTM inference
    for s in req.scenarios:
        if s not in DATA_CACHE:
            raise HTTPException(status_code=400, detail=f"Unknown scenario: {s}")
    results = []
    for s in req.scenarios:
        r = await asyncio.to_thread(future_prediction, s)
        r["scenario"] = s
        results.append(r)
    return {"results": results, "generated_at": datetime.now(timezone.utc).isoformat()}


@api.get("/system_health")
async def system_health():
    recent = []

    try:
        recent = await db.history.find(
            {},
            {"_id": 0, "graph_data": 0}
        ).sort("timestamp", -1).to_list(20)

    except Exception as e:
        return {
            "status": "degraded",
            "mongo_error": str(e),
            "message": "MongoDB query failed"
        }
    risk_counts = {"Stable": 0, "Moderate": 0, "Elevated": 0, "High": 0, "Critical": 0}
    for r in recent:
        lvl = r.get("risk_level", "Stable")
        risk_counts[lvl] = risk_counts.get(lvl, 0) + 1

    # Component health checks
    db_ok = True
    mongo_error = None

    try:
        await client.admin.command("ping")
    except Exception as e:
        db_ok = False
        mongo_error = str(e)

    components = [
        {"name": "Backend API", "status": "Operational", "tone": "ok"},
        {"name": "Forecast Engine", "status": "Active", "tone": "ok"},
        {"name": "LSTM Model", "status": "Healthy", "tone": "ok"},
        {"name": "Database", "status": "Connected" if db_ok else "Disconnected", "tone": "ok" if db_ok else "bad"},
        {"name": "Scenario Datasets", "status": f"{len(DATA_CACHE)}/4 Loaded", "tone": "ok" if len(DATA_CACHE) == 4 else "warn"},
    ]

    return {
        "model_loaded": True,
        "mongo_error": mongo_error,
        "lstm_input_shape": list(LSTM_MODEL.input_shape[1:]),
        "scenarios_loaded": len(DATA_CACHE),
        "scenarios": list(DATA_CACHE.keys()),
        "total_predictions": await db.history.count_documents({}),
        "risk_counts_recent": risk_counts,
        "features": FEATURES,
        "thresholds": THRESHOLDS,
        "components": components,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }



from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://network-digital-twin.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
