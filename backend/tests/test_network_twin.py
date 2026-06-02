"""Backend API tests for Network Digital Twin (enterprise NOC fields)."""
import os
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

SCENARIOS = ["Low Traffic", "Medium Traffic", "High Traffic", "Congestion Attack"]
FEATURES = [
    "latency_ms", "packet_loss_percent", "throughput_mbps", "utilization_percent",
    "traffic_load_mbps", "active_users", "jitter_ms", "queue_occupancy_percent",
]
FUTURE_FIELDS = [f"future_{f}" for f in FEATURES]
RISK_LEVELS = ["Stable", "Moderate", "Elevated", "High", "Critical"]
DERIVED_DELTA_KEYS = {
    "latency_ms", "packet_loss_percent", "utilization_percent",
    "jitter_ms", "queue_occupancy_percent",
}
THRESHOLD_KEYS = {
    "latency_ms", "packet_loss_percent", "throughput_mbps",
    "utilization_percent", "jitter_ms", "queue_occupancy_percent",
}
COMPONENT_NAMES = {"Backend API", "Forecast Engine", "LSTM Model", "Database", "Scenario Datasets"}


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session", autouse=True)
def cleanup_history(client):
    client.delete(f"{API}/history", timeout=30)
    yield


def _assert_thresholds(thr):
    assert isinstance(thr, dict)
    assert set(thr.keys()) == THRESHOLD_KEYS, f"thresholds keys {set(thr.keys())}"
    assert thr["latency_ms"] == 100
    assert thr["packet_loss_percent"] == 5
    assert thr["utilization_percent"] == 85
    assert thr["jitter_ms"] == 15
    assert thr["queue_occupancy_percent"] == 90
    assert thr["throughput_mbps"] is None


def _assert_delta_shape(delta):
    assert isinstance(delta, dict)
    assert "pct" in delta and isinstance(delta["pct"], (int, float))
    assert "baseline" in delta and isinstance(delta["baseline"], (int, float))
    assert "bias" in delta and delta["bias"] in ("bad_up", "good_up", "neutral")


# ===== /api/scenarios =====
class TestScenarios:
    def test_scenarios_returns_four_available(self, client):
        r = client.get(f"{API}/scenarios", timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "scenarios" in data
        names = [s["name"] for s in data["scenarios"]]
        for sc in SCENARIOS:
            assert sc in names
        for s in data["scenarios"]:
            assert s["available"] is True
            assert isinstance(s["rows"], int) and s["rows"] > 0
            # New: insight field
            assert "insight" in s, f"insight missing for {s['name']}"
            assert isinstance(s["insight"], str) and len(s["insight"]) > 0


# ===== /api/predict =====
class TestPredict:
    @pytest.mark.parametrize("scenario", SCENARIOS)
    def test_predict_each_scenario(self, client, scenario):
        payload = {"bandwidth_mbps": 1000.0, "active_users": 250,
                   "traffic_load_mbps": 700.0, "scenario": scenario}
        r = client.post(f"{API}/predict", json=payload, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["predicted_latency_ms", "predicted_packet_loss_percent",
                  "predicted_throughput_mbps", "predicted_utilization_percent",
                  "predicted_jitter_ms", "predicted_queue_occupancy_percent",
                  "risk_level", "recommendations", "graph_data", "id", "timestamp",
                  "deltas", "scenario_insight", "thresholds"]:
            assert k in d, f"missing key {k}"
        # New 5-level risk
        assert d["risk_level"] in RISK_LEVELS, f"unexpected risk {d['risk_level']}"
        assert isinstance(d["recommendations"], list) and d["recommendations"]
        # Scenario insight
        assert isinstance(d["scenario_insight"], str) and len(d["scenario_insight"]) > 0
        # Thresholds
        _assert_thresholds(d["thresholds"])
        # Deltas: only derived KPIs
        assert set(d["deltas"].keys()) == DERIVED_DELTA_KEYS, f"deltas keys {set(d['deltas'].keys())}"
        for k, v in d["deltas"].items():
            _assert_delta_shape(v)
        # Sanity
        assert 0 <= d["predicted_utilization_percent"] <= 100
        g = d["graph_data"]
        assert "labels" in g and len(g["labels"]) > 0

    def test_predict_invalid_scenario(self, client):
        r = client.post(f"{API}/predict", json={
            "bandwidth_mbps": 1000.0, "active_users": 100,
            "traffic_load_mbps": 500.0, "scenario": "Bogus"
        }, timeout=30)
        assert r.status_code == 400

    def test_predict_validation_error(self, client):
        r = client.post(f"{API}/predict", json={
            "bandwidth_mbps": -1, "active_users": 1,
            "traffic_load_mbps": 1, "scenario": "Low Traffic"
        }, timeout=30)
        assert r.status_code in (400, 422)

    def test_risk_high_under_congestion_attack(self, client):
        payload = {"bandwidth_mbps": 100.0, "active_users": 800,
                   "traffic_load_mbps": 300.0, "scenario": "Congestion Attack"}
        r = client.post(f"{API}/predict", json=payload, timeout=60)
        assert r.status_code == 200
        d = r.json()
        # Under massive overload + attack, risk should be elevated or worse
        assert d["risk_level"] in ("Elevated", "High", "Critical"), f"got {d['risk_level']}"
        assert any("DDoS" in rec or "mitigation" in rec.lower() for rec in d["recommendations"])

    def test_predict_low_traffic_lower_risk(self, client):
        payload = {"bandwidth_mbps": 10000.0, "active_users": 10,
                   "traffic_load_mbps": 100.0, "scenario": "Low Traffic"}
        r = client.post(f"{API}/predict", json=payload, timeout=60)
        assert r.status_code == 200
        d = r.json()
        # Low traffic with abundant bandwidth shouldn't be Critical
        assert d["risk_level"] in ("Stable", "Moderate", "Elevated")

    def test_predict_delta_bias_correctness(self, client):
        r = client.post(f"{API}/predict", json={
            "bandwidth_mbps": 1000.0, "active_users": 100,
            "traffic_load_mbps": 500.0, "scenario": "Medium Traffic"
        }, timeout=60)
        assert r.status_code == 200
        d = r.json()
        deltas = d["deltas"]
        # latency, packet_loss, util, jitter, queue all bad_up
        for k in DERIVED_DELTA_KEYS:
            assert deltas[k]["bias"] == "bad_up", f"{k} bias should be bad_up"


# ===== /api/future_predict =====
class TestFuturePredict:
    @pytest.mark.parametrize("scenario", SCENARIOS)
    def test_future_predict_each_scenario(self, client, scenario):
        r = client.post(f"{API}/future_predict", json={"scenario": scenario}, timeout=180)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in FUTURE_FIELDS + ["risk_level", "recommendations", "graph_data", "id",
                                  "timestamp", "deltas", "scenario_insight",
                                  "forecast_summary", "forecast_horizon", "thresholds"]:
            assert k in d, f"missing key {k}"
        # 5-level risk
        assert d["risk_level"] in RISK_LEVELS
        # Forecast horizon
        assert d["forecast_horizon"] == 20
        # Forecast summary
        assert isinstance(d["forecast_summary"], list) and len(d["forecast_summary"]) >= 1
        for msg in d["forecast_summary"]:
            assert isinstance(msg, str) and len(msg) > 0
        # Scenario insight
        assert isinstance(d["scenario_insight"], str) and len(d["scenario_insight"]) > 0
        # Thresholds
        _assert_thresholds(d["thresholds"])
        # Deltas: all 8 features
        assert set(d["deltas"].keys()) == set(FEATURES), f"deltas keys {set(d['deltas'].keys())}"
        for v in d["deltas"].values():
            _assert_delta_shape(v)
        # Graph data
        g = d["graph_data"]
        assert g["history_len"] == 30
        assert g["forecast_len"] == 20
        assert len(g["labels"]) == 50
        for f in FEATURES:
            assert f in g
            assert len(g[f]) == 50

    def test_future_predict_invalid_scenario(self, client):
        r = client.post(f"{API}/future_predict", json={"scenario": "Nope"}, timeout=30)
        assert r.status_code == 400

    def test_future_forecast_summary_meaningful(self, client):
        """Forecast summary content should reference at least one operational concept."""
        r = client.post(f"{API}/future_predict", json={"scenario": "Congestion Attack"}, timeout=180)
        assert r.status_code == 200
        d = r.json()
        joined = " ".join(d["forecast_summary"]).lower()
        keywords = ["latency", "throughput", "utilization", "packet loss",
                    "queue", "stable", "sla", "congestion"]
        assert any(k in joined for k in keywords), f"summary lacks ops keywords: {d['forecast_summary']}"


# ===== /api/history =====
class TestHistory:
    def test_history_returns_items(self, client):
        client.post(f"{API}/predict", json={
            "bandwidth_mbps": 1000.0, "active_users": 100,
            "traffic_load_mbps": 500.0, "scenario": "Medium Traffic"
        }, timeout=60)
        r = client.get(f"{API}/history", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert "items" in data and isinstance(data["items"], list) and len(data["items"]) > 0
        item = data["items"][0]
        assert "id" in item and "scenario" in item and "kind" in item
        assert "_id" not in item
        # Risk level should be one of new 5-levels (not legacy)
        assert item["risk_level"] in RISK_LEVELS

    def test_history_limit(self, client):
        for _ in range(3):
            client.post(f"{API}/predict", json={
                "bandwidth_mbps": 1000.0, "active_users": 100,
                "traffic_load_mbps": 500.0, "scenario": "Low Traffic"
            }, timeout=60)
        r = client.get(f"{API}/history?limit=2", timeout=30)
        assert r.status_code == 200
        assert len(r.json()["items"]) <= 2

    def test_delete_history(self, client):
        client.post(f"{API}/predict", json={
            "bandwidth_mbps": 1000.0, "active_users": 100,
            "traffic_load_mbps": 500.0, "scenario": "High Traffic"
        }, timeout=60)
        r = client.delete(f"{API}/history", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "deleted" in d and isinstance(d["deleted"], int) and d["deleted"] >= 1
        r2 = client.get(f"{API}/history", timeout=30)
        assert r2.status_code == 200
        assert r2.json()["items"] == []


# ===== /api/system_health =====
class TestSystemHealth:
    def test_system_health(self, client):
        client.post(f"{API}/predict", json={
            "bandwidth_mbps": 1000.0, "active_users": 100,
            "traffic_load_mbps": 500.0, "scenario": "Medium Traffic"
        }, timeout=60)
        r = client.get(f"{API}/system_health", timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["model_loaded"] is True
        assert d["lstm_input_shape"] == [10, 8]
        assert d["scenarios_loaded"] == 4
        assert set(d["scenarios"]) == set(SCENARIOS)
        assert d["features"] == FEATURES
        assert isinstance(d["total_predictions"], int) and d["total_predictions"] >= 1
        rc = d["risk_counts_recent"]
        # New 5-level keys
        assert set(RISK_LEVELS).issubset(rc.keys()), f"risk_counts keys: {rc.keys()}"

    def test_system_health_components(self, client):
        r = client.get(f"{API}/system_health", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "components" in d
        comps = d["components"]
        assert isinstance(comps, list) and len(comps) == 5
        names = {c["name"] for c in comps}
        assert names == COMPONENT_NAMES, f"component names: {names}"
        for c in comps:
            assert "name" in c and "status" in c and "tone" in c
            assert isinstance(c["name"], str)
            assert isinstance(c["status"], str) and len(c["status"]) > 0
            assert c["tone"] in ("ok", "warn", "bad")
        # All should be ok in healthy env
        healthy = {c["name"]: c["tone"] for c in comps}
        assert healthy["Backend API"] == "ok"
        assert healthy["Forecast Engine"] == "ok"
        assert healthy["LSTM Model"] == "ok"
        assert healthy["Database"] == "ok"
        assert healthy["Scenario Datasets"] == "ok"

    def test_system_health_thresholds_and_timestamp(self, client):
        r = client.get(f"{API}/system_health", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "thresholds" in d
        _assert_thresholds(d["thresholds"])
        assert "generated_at" in d
        assert isinstance(d["generated_at"], str)
        # Loose ISO-8601 check
        from datetime import datetime
        # fromisoformat handles "+00:00"; replace Z if present
        ts = d["generated_at"].replace("Z", "+00:00")
        datetime.fromisoformat(ts)
