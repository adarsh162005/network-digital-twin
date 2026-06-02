# Network Digital Twin — PRD

## Problem Statement
Build a full-stack AI-powered Network Digital Twin that simulates, monitors, predicts current network KPIs, and forecasts future KPIs using an LSTM time-series model. Provides risk classification, recommendations, and an enterprise NOC-style dashboard.

## Tech Stack
- Backend: FastAPI + TensorFlow/Keras (LSTM) + scikit-learn (MinMaxScaler) + Pandas/NumPy + MongoDB (Motor)
- Frontend: React 19 + Tailwind + Shadcn UI + Recharts + lucide-react

## Architecture
- LSTM model: input shape (1, 10, 8), output (8). Loaded at startup from `/app/backend/ml_assets/trained_lstm_model.h5` with `lstm_scaler.pkl` (MinMaxScaler).
- 4 scenario CSV datasets cached in memory (1500 rows each): Low/Medium/High Traffic + Congestion Attack.
- Current prediction: rule-based + scenario-historical blend (utilization derived from input, latency/jitter/queue/packet-loss blended from scenario mean).
- Future forecasting: LSTM ingests last 10 telemetry steps × 8 features → recursive multi-step rollout (20 future steps). Returns 30 history + 20 forecast for charting.
- Risk classifier (Low/Medium/High) scores latency, packet loss, utilization, queue occupancy.
- All predictions persisted to MongoDB `history` collection (ISO-string timestamps, no raw ObjectIds returned).

## API Endpoints (all `/api`)
- GET `/scenarios` — list scenarios + row counts
- POST `/predict` — current KPI prediction (inputs: bandwidth_mbps, active_users, traffic_load_mbps, scenario)
- POST `/future_predict` — LSTM forecast (input: scenario)
- GET `/history?limit=N` — past predictions
- DELETE `/history` — clear all
- GET `/system_health` — model + dataset health

## Frontend Pages
- `/` Dashboard (Operations Center: aggregate KPIs, latest current + latest future, activity feed)
- `/current` Current Prediction (input form + 6 KPI cards + 4 trend charts + recommendations)
- `/future` Future Forecasting (LSTM banner + 8 KPI cards + 6 forecast charts with NOW split line + AI mitigation plan)
- `/history` Network History (sortable table, refresh, clear)
- `/recommendations` Recommendations (per-prediction AI mitigation cards)
- `/health` System Health (model status, feature vector, dataset list, risk distribution bars)

## Design
- Dark NOC theme: obsidian `#050505` base, neon cyan/emerald/amber/red data-semantic accents.
- IBM Plex Sans body, JetBrains Mono for all KPI numerics. Background grid texture, glow shadows, monochromatic chart grids.
- All interactive elements + KPI values carry `data-testid`.

## Test Status
- Backend: 17/17 pytest cases pass (iteration_1.json, success_rate 100%).
- Frontend: screenshot-verified, no lint issues.

## Completed (May 29 2026)
- All 6 pages and backend endpoints functional with real CSVs (low/medium/high/congestion).
- LSTM + MinMaxScaler loading verified, recursive 20-step forecast working.
- MongoDB history persistence working across sessions.

## Backlog (P1/P2)
- P1: Allow user-uploaded CSV import for custom scenarios.
- P1: Real-time streaming mode (websocket) auto-refreshing predictions every N seconds.
- P2: Compare-mode (two scenarios side-by-side forecast graphs).
- P2: PDF export of dashboard snapshots.
- P2: Per-user prediction sessions (requires auth).
- P2: Retrain LSTM from uploaded `ordered_lstm_ready_dataset.csv` on demand.

---
## Enhancement Pass (May 29 2026 · v1.1)

### Added — Backend
- 5-level risk classification: **Stable / Moderate / Elevated / High / Critical** (replaces 3-level Low/Medium/High).
- Per-feature **deltas** dict (`{pct, baseline, bias}`) on `/predict` (5 derived KPIs vs scenario mean) and `/future_predict` (all 8 features vs last observed).
- **Scenario insights** dict — contextual operational text returned with every prediction and listed on `/scenarios`.
- **Forecast summary** generator on `/future_predict`: produces 1–N operational outlook bullets ("Latency expected to rise gradually", "Utilization approaching critical threshold", etc.).
- **Forecast horizon** (20) exposed on `/future_predict`.
- **Operational thresholds** dict on every prediction + `/system_health` (latency 100ms, ploss 5%, util 85%, jitter 15ms, queue 90%).
- **`/system_health` components** array (Backend API / Forecast Engine / LSTM Model / Database / Scenario Datasets with tone) + `generated_at` ISO timestamp.

### Added — Frontend
- **Theme toggle (dark / light)** with localStorage persistence — accessible from sidebar footer.
- **KPI delta indicators**: percentage change with ↑/↓ arrows, color-coded by metric bias (red for bad-up, green for good).
- **Operational threshold reference lines** on every applicable chart (dashed amber, labeled "WARN xx").
- **NOW | FORECAST split**: solid line for history, dashed line for forecast, vertical NOW divider on all forecast charts.
- **Forecast Summary panel** with horizon chip.
- **Scenario Insight banner** on current and future pages.
- **System Health compact panel** on Dashboard.
- **Timestamps everywhere**: prediction cards, forecasts, history, dashboard panels, system health.
- **Tone-down**: removed pulse animations & heavy neon glows; switched to subtle status dots and softer accent shades on dark + readable accents on light.
- **Sharp NOC styling** preserved: JetBrains Mono for all numeric data, IBM Plex Sans body, 2px radius.

### Tests
- iteration_2.json: 22/22 backend tests pass (100%).

---
## Enhancement Pass (May 29 2026 · v1.2)

### Added — Backend
- `POST /api/scenarios/upload` (multipart): validates name regex, 5 MB cap, required 8 columns, ≥10 rows; persists CSV + sidecar JSON to `/app/backend/ml_assets/custom_*`.
- `DELETE /api/scenarios/{name}`: removes custom scenario (404 if unknown, 400 if built-in).
- `POST /api/compare`: parallel LSTM forecasts for two scenarios with pre-validation guard.
- `GET /api/history/export.csv`: streaming CSV download of all stored predictions.
- Startup loader rehydrates custom scenarios from disk into `DATA_CACHE`.
- `/api/scenarios` returns `custom` and `uploaded_at` fields; `/predict` and `/future_predict` accept custom scenario names.

### Added — Frontend
- **Compare page** (`/compare`): two scenario pickers + side-by-side LSTM forecast columns with KPI cards, AI Forecast Summary, dual charts (NOW|FORECAST split, threshold lines), and a delta comparison table.
- **Scenario Manager** on System Health: file picker + name input, list of uploaded scenarios with REMOVE action, required-column hint.
- **CSV Export** button on Network History (`/api/history/export.csv`).
- **PDF Export** buttons on Current Prediction, Future Forecasting, and each Compare column — built with jsPDF (no chart screenshots, clean tabular report including risk, KPIs, scenario insight, forecast summary, recommendations, timestamps).
- **ScenariosProvider** context: single source of truth for the scenarios list; refreshes after upload/delete; powers all `ScenarioSelect` dropdowns.
- New `Compare` entry in sidebar navigation.

### Tests
- iteration_3.json: 42/42 backend tests pass (existing 22 + 20 new). Persistence across backend restart verified. Compare pre-validates both names to avoid wasted LSTM runs.
