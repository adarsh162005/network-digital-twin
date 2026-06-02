"""Backend API tests for iteration #3:
- Custom scenario CSV upload/list/delete
- Side-by-side compare endpoint
- History CSV export
"""
import io
import os
import time
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ASSETS = Path("/app/backend/ml_assets")
SAMPLE_CSV = ASSETS / "ordered_medium_traffic.csv"

FEATURES = [
    "latency_ms", "packet_loss_percent", "throughput_mbps", "utilization_percent",
    "traffic_load_mbps", "active_users", "jitter_ms", "queue_occupancy_percent",
]
RISK_LEVELS = ["Stable", "Moderate", "Elevated", "High", "Critical"]

# Use a unique name to avoid colliding with parallel/prev runs
CUSTOM_NAME = "TEST_CustomLab_A"
CUSTOM_NAME_B = "TEST_CustomLab_B"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    return s


def _read_sample_bytes(rows: int | None = None) -> bytes:
    """Return bytes of sample CSV; optionally truncate to <rows> data rows."""
    text = SAMPLE_CSV.read_text()
    if rows is None:
        return text.encode()
    lines = text.splitlines()
    header = lines[0]
    body = lines[1: 1 + rows]
    return ("\n".join([header] + body) + "\n").encode()


@pytest.fixture(scope="module", autouse=True)
def cleanup(client):
    # Pre-clean any leftover test scenarios
    for nm in (CUSTOM_NAME, CUSTOM_NAME_B):
        client.delete(f"{API}/scenarios/{nm}", timeout=30)
    yield
    for nm in (CUSTOM_NAME, CUSTOM_NAME_B):
        client.delete(f"{API}/scenarios/{nm}", timeout=30)


# ===== Upload validation =====
class TestUploadValidation:
    def test_reject_empty_name(self, client):
        files = {"file": ("a.csv", _read_sample_bytes(), "text/csv")}
        r = client.post(f"{API}/scenarios/upload", data={"name": ""}, files=files, timeout=60)
        assert r.status_code in (400, 422)

    def test_reject_invalid_name_starts_with_space(self, client):
        files = {"file": ("a.csv", _read_sample_bytes(), "text/csv")}
        r = client.post(f"{API}/scenarios/upload", data={"name": " BadStart"}, files=files, timeout=60)
        assert r.status_code == 400

    def test_reject_invalid_name_with_dollar(self, client):
        files = {"file": ("a.csv", _read_sample_bytes(), "text/csv")}
        r = client.post(f"{API}/scenarios/upload", data={"name": "Bad$Name"}, files=files, timeout=60)
        assert r.status_code == 400

    def test_reject_conflicting_builtin_name(self, client):
        files = {"file": ("a.csv", _read_sample_bytes(), "text/csv")}
        r = client.post(f"{API}/scenarios/upload", data={"name": "Low Traffic"}, files=files, timeout=60)
        assert r.status_code == 400

    def test_reject_csv_missing_required_column(self, client):
        # Drop one required column (jitter_ms)
        text = SAMPLE_CSV.read_text()
        lines = text.splitlines()
        header = lines[0].split(",")
        idx = header.index("jitter_ms")
        new_lines = []
        for ln in lines:
            parts = ln.split(",")
            new_lines.append(",".join(p for i, p in enumerate(parts) if i != idx))
        bad_csv = ("\n".join(new_lines) + "\n").encode()
        files = {"file": ("bad.csv", bad_csv, "text/csv")}
        r = client.post(f"{API}/scenarios/upload",
                        data={"name": "TEST_MissingCol"}, files=files, timeout=60)
        assert r.status_code == 400
        assert "Missing required columns" in r.text or "jitter_ms" in r.text

    def test_reject_csv_with_too_few_rows(self, client):
        small = _read_sample_bytes(rows=5)
        files = {"file": ("small.csv", small, "text/csv")}
        r = client.post(f"{API}/scenarios/upload",
                        data={"name": "TEST_SmallRows"}, files=files, timeout=60)
        assert r.status_code == 400


# ===== Upload happy path + scenario listing =====
class TestUploadAndList:
    def test_upload_custom_scenario(self, client):
        files = {"file": ("ok.csv", _read_sample_bytes(rows=200), "text/csv")}
        r = client.post(f"{API}/scenarios/upload",
                        data={"name": CUSTOM_NAME}, files=files, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == CUSTOM_NAME
        assert isinstance(d["rows"], int) and d["rows"] >= 10
        assert "uploaded_at" in d and isinstance(d["uploaded_at"], str)

    def test_scenarios_list_includes_custom_and_builtins(self, client):
        r = client.get(f"{API}/scenarios", timeout=30)
        assert r.status_code == 200
        items = {s["name"]: s for s in r.json()["scenarios"]}
        # Built-ins must have custom=false
        for n in ["Low Traffic", "Medium Traffic", "High Traffic", "Congestion Attack"]:
            assert n in items, f"missing built-in {n}"
            assert items[n]["custom"] is False
            assert items[n].get("uploaded_at") is None
        # Custom present with custom=true
        assert CUSTOM_NAME in items
        assert items[CUSTOM_NAME]["custom"] is True
        assert isinstance(items[CUSTOM_NAME]["uploaded_at"], str)
        assert items[CUSTOM_NAME]["available"] is True
        assert items[CUSTOM_NAME]["rows"] >= 10

    def test_predict_with_custom_scenario(self, client):
        payload = {"bandwidth_mbps": 1000.0, "active_users": 200,
                   "traffic_load_mbps": 600.0, "scenario": CUSTOM_NAME}
        r = client.post(f"{API}/predict", json=payload, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["risk_level"] in RISK_LEVELS
        assert "predicted_latency_ms" in d
        assert "graph_data" in d

    def test_future_predict_with_custom_scenario(self, client):
        r = client.post(f"{API}/future_predict",
                        json={"scenario": CUSTOM_NAME}, timeout=180)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["risk_level"] in RISK_LEVELS
        assert d["forecast_horizon"] == 20
        for f in FEATURES:
            assert f"future_{f}" in d

    def test_custom_csv_persisted_on_disk(self):
        slug_files = list(ASSETS.glob("custom_*.csv"))
        slug_jsons = list(ASSETS.glob("custom_*.json"))
        names_on_disk = []
        for jf in slug_jsons:
            try:
                import json
                names_on_disk.append(json.loads(jf.read_text()).get("name"))
            except Exception:
                pass
        assert CUSTOM_NAME in names_on_disk, f"custom CSV not persisted: {names_on_disk}"
        assert len(slug_files) >= 1


# ===== Compare =====
class TestCompare:
    def test_compare_two_builtins(self, client):
        r = client.post(f"{API}/compare",
                        json={"scenarios": ["Low Traffic", "Congestion Attack"]},
                        timeout=240)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "results" in d and len(d["results"]) == 2
        assert "generated_at" in d and isinstance(d["generated_at"], str)
        from datetime import datetime
        datetime.fromisoformat(d["generated_at"].replace("Z", "+00:00"))
        names = [res["scenario"] for res in d["results"]]
        assert "Low Traffic" in names and "Congestion Attack" in names
        for res in d["results"]:
            assert res["risk_level"] in RISK_LEVELS
            for f in FEATURES:
                assert f"future_{f}" in res
            assert "graph_data" in res
            assert "forecast_summary" in res and isinstance(res["forecast_summary"], list)
            assert "thresholds" in res

    def test_compare_custom_plus_builtin(self, client):
        r = client.post(f"{API}/compare",
                        json={"scenarios": [CUSTOM_NAME, "Medium Traffic"]},
                        timeout=240)
        assert r.status_code == 200, r.text
        d = r.json()
        assert len(d["results"]) == 2
        names = {res["scenario"] for res in d["results"]}
        assert names == {CUSTOM_NAME, "Medium Traffic"}

    def test_compare_same_scenario_twice_rejected(self, client):
        r = client.post(f"{API}/compare",
                        json={"scenarios": ["Low Traffic", "Low Traffic"]},
                        timeout=60)
        assert r.status_code == 400

    def test_compare_unknown_scenario_rejected(self, client):
        r = client.post(f"{API}/compare",
                        json={"scenarios": ["Low Traffic", "NoSuchScenarioZZ"]},
                        timeout=60)
        assert r.status_code == 400

    def test_compare_requires_two_scenarios(self, client):
        # Pydantic min_length=2 should reject single-item list
        r = client.post(f"{API}/compare",
                        json={"scenarios": ["Low Traffic"]}, timeout=30)
        assert r.status_code in (400, 422)


# ===== History CSV export =====
class TestHistoryExport:
    def test_export_csv_headers_and_content_type(self, client):
        # Seed at least one history record
        client.post(f"{API}/predict", json={
            "bandwidth_mbps": 1000.0, "active_users": 100,
            "traffic_load_mbps": 500.0, "scenario": "Medium Traffic"
        }, timeout=60)
        r = client.get(f"{API}/history/export.csv", timeout=60)
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert ct.startswith("text/csv"), f"content-type: {ct}"
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd.lower()
        body = r.text
        first_line = body.splitlines()[0]
        expected_cols = ["id", "timestamp", "kind", "scenario", "risk_level",
                         "latency_ms", "throughput_mbps", "packet_loss_percent",
                         "utilization_percent", "jitter_ms",
                         "queue_occupancy_percent", "recommendations"]
        for col in expected_cols:
            assert col in first_line, f"missing column {col} in header: {first_line}"


# ===== Delete scenario =====
class TestDeleteScenario:
    def test_delete_builtin_rejected(self, client):
        r = client.delete(f"{API}/scenarios/Low Traffic", timeout=30)
        assert r.status_code == 400

    def test_delete_unknown_404(self, client):
        r = client.delete(f"{API}/scenarios/NoSuchScenarioZZ_X1", timeout=30)
        assert r.status_code == 404

    def test_delete_custom_scenario_works(self, client):
        # First upload a second custom one to delete here (keeps CUSTOM_NAME alive
        # only briefly; final teardown cleans both)
        files = {"file": ("ok.csv", _read_sample_bytes(rows=50), "text/csv")}
        up = client.post(f"{API}/scenarios/upload",
                         data={"name": CUSTOM_NAME_B}, files=files, timeout=60)
        assert up.status_code == 200, up.text

        r = client.delete(f"{API}/scenarios/{CUSTOM_NAME_B}", timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("deleted") == CUSTOM_NAME_B

        # Should no longer be listed
        names = [s["name"] for s in client.get(f"{API}/scenarios", timeout=30).json()["scenarios"]]
        assert CUSTOM_NAME_B not in names

        # /predict on deleted scenario fails
        bad = client.post(f"{API}/predict", json={
            "bandwidth_mbps": 1000.0, "active_users": 100,
            "traffic_load_mbps": 500.0, "scenario": CUSTOM_NAME_B
        }, timeout=30)
        assert bad.status_code == 400
