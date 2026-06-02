# NetTwin — Network Digital Twin with AI-Based Future Traffic Forecasting

Full-stack AI-powered Network Operations Center (NOC) dashboard that predicts current network KPIs (rule-based + scenario-blended inference) and forecasts future KPIs using an **LSTM** time-series model.

---

## Architecture

```
backend/   FastAPI + TensorFlow/Keras (LSTM) + scikit-learn + MongoDB (Motor)
frontend/  React 19 + Tailwind + Shadcn UI + Recharts + lucide-react + jsPDF
```

| Layer | Stack |
|-------|-------|
| Backend | FastAPI, TensorFlow 2.21, scikit-learn, Pandas, NumPy, Motor (MongoDB async), joblib |
| Frontend | React 19, Tailwind 3, Shadcn UI, Recharts, react-router 7, sonner, jsPDF |
| Database | MongoDB (`history` collection — every prediction persisted) |
| ML assets | `trained_lstm_model.h5` (1, 10, 8 → 8), `lstm_scaler.pkl` (MinMax), 4 ordered CSV scenarios + LSTM training set |

---

## Features

- **Operations Center dashboard** — aggregate KPIs, latest current + latest future predictions, compact system-health panel, live activity feed.
- **Current Prediction** — rule-based + scenario-blended inference (latency, throughput, packet loss, utilization, jitter, queue occupancy) with KPI delta indicators vs scenario mean and threshold-marked trend charts.
- **Future Forecasting** — LSTM recursive multi-step prediction (next 20 steps). Solid history + dashed forecast lines with vertical NOW divider, AI Forecast Summary panel (operational outlook), threshold reference lines.
- **Scenario Comparison** — pick any two scenarios, parallel LSTM forecasts, side-by-side KPI cards + charts + delta table.
- **Custom Scenarios** — upload your own CSV (validated for required 8 columns + ≥10 rows + .csv only), use it in every dropdown, persists across backend restarts.
- **Network History** — full MongoDB-backed log of every prediction with refresh, CSV export, and clear actions.
- **PDF Export** — clean tabular jsPDF report of any prediction/forecast (KPIs, insights, recommendations, timestamps).
- **5-level enterprise risk classifier** — Stable / Moderate / Elevated / High / Critical, derived from the *predicted* KPIs (not the input label).
- **Dark / Light theme toggle** with localStorage persistence.
- **Recommendations engine** — context-specific mitigation steps per scenario and risk level.

---

## API Endpoints (all prefixed `/api`)

| Method | Path | Purpose |
|--------|------|---------|
| GET    | `/`                          | Health-check root |
| GET    | `/scenarios`                 | List built-in + custom scenarios |
| POST   | `/scenarios/upload`          | Upload custom CSV (multipart: `name`, `file`) |
| DELETE | `/scenarios/{name}`          | Delete a custom scenario |
| POST   | `/predict`                   | Current KPI prediction |
| POST   | `/future_predict`            | LSTM future forecast (20 steps) |
| POST   | `/compare`                   | Side-by-side LSTM forecasts for two scenarios |
| GET    | `/history?limit=N`           | List prediction history |
| GET    | `/history/export.csv`        | CSV download of full history |
| DELETE | `/history`                   | Clear all history |
| GET    | `/system_health`             | Runtime status (model, datasets, components, thresholds) |

---

## Local Setup

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# .env must contain
#   MONGO_URL=mongodb://localhost:27017
#   DB_NAME=test_database
#   CORS_ORIGINS=*

uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend

```bash
cd frontend
yarn install
# frontend/.env should contain
#   REACT_APP_BACKEND_URL=http://localhost:8001
yarn start
```

### MongoDB
Any MongoDB instance reachable at the configured `MONGO_URL`.

---

## ML Pipeline

| Step | Detail |
|------|--------|
| LSTM input shape | `(1, 10, 8)` — one sample × 10 timesteps × 8 features |
| Feature order | `latency_ms, packet_loss_percent, throughput_mbps, utilization_percent, traffic_load_mbps, active_users, jitter_ms, queue_occupancy_percent` |
| Scaler | MinMaxScaler [0, 1] persisted as `lstm_scaler.pkl` |
| Forecast horizon | 20 recursive steps |
| Output | 8-dimensional vector per step, inverse-scaled before returning |

---

## Tests

```
backend/tests/test_network_twin.py            # 22 tests (core APIs, LSTM, deltas, health)
backend/tests/test_custom_compare_export.py   # 20 tests (CSV upload, compare, export, persistence)
```

Run: `pytest backend/tests/ -v` → **42/42 pass**.

---

## Operational Thresholds (WARN reference lines on charts)

| KPI | Threshold |
|-----|-----------|
| latency_ms | 100 |
| packet_loss_percent | 5 |
| utilization_percent | 85 |
| jitter_ms | 15 |
| queue_occupancy_percent | 90 |

---

## Risk Classification (predicted-state-based, 5 levels)

| Score | Level |
|-------|-------|
| ≥ 9   | Critical |
| ≥ 6   | High |
| ≥ 4   | Elevated |
| ≥ 2   | Moderate |
| else  | Stable |

Score weights: latency (>120: +3, >80: +2, >50: +1), packet_loss (>5: +3, >2.5: +2, >1: +1), utilization (>92: +3, >80: +2, >65: +1), queue (>90: +2, >75: +1).
