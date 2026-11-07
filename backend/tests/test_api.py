import uuid

import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import app


def user_headers() -> dict:
    return {"X-User-Id": str(uuid.uuid4())}


@pytest.fixture()
def client():
    with TestClient(app) as c:
        with db.connect() as conn:
            conn.execute("DELETE FROM user_profiles")
            conn.execute("DELETE FROM scan_records")
        yield c


def test_requires_valid_user_id(client):
    missing = client.get("/api/me")
    assert missing.status_code == 400
    assert missing.json()["error"]["code"] == "missing_user_id"
    for bad in ("nope", "12345", "../etc/passwd", "zzzzzzzz-zzzz-4zzz-8zzz-zzzzzzzzzzzz"):
        resp = client.get("/api/me", headers={"X-User-Id": bad})
        assert resp.status_code == 400
        assert resp.json()["error"] == {"code": "invalid_user_id", "message": "The X-User-Id header must be a UUID."}


def test_profile_is_created_on_first_request(client):
    headers = user_headers()
    me = client.get("/api/me", headers=headers).json()
    assert me["onboarding_completed"] is False
    assert me["display_name"] == "" and me["email"] == ""
    assert "user_id" not in me  # the ID only travels in the header


def test_onboarding_flow_and_demo_scan(client):
    headers = user_headers()
    prefs = {"allergens": ["tree_nuts"], "nutrition_goals": ["lower_added_sugar"],
             "environmental_priorities": ["reduced_deforestation"]}
    me = client.put("/api/me", headers=headers, json={"preferences": prefs, "onboarding_completed": True}).json()
    assert me["onboarding_completed"] is True
    assert me["preferences"]["allergens"] == ["tree_nuts"]

    scan = client.post("/api/scans/analyze", headers=headers, json={"demo_fixture_id": "demo-hazelnut-spread"}).json()
    assert scan["is_demo"] is True
    assert scan["overall_result"]["status"] == "red"

    history = client.get("/api/scans", headers=headers).json()["scans"]
    assert [s["scan_id"] for s in history] == [scan["scan_id"]]
    again = client.get(f"/api/scans/{scan['scan_id']}", headers=headers).json()
    assert again["preference_breakdown"] == scan["preference_breakdown"]

    ins = client.get("/api/insights", headers=headers).json()
    assert ins["counts"]["scans"] == 1
    assert ins["milestones"][0]["achieved"] is True

    branch = client.get("/api/daily-branch", headers=headers).json()
    assert branch["source_url"].startswith("https://")

    assert client.delete("/api/scans", headers=headers).json()["deleted"] == 1


def test_user_id_header_is_case_insensitive_and_normalized(client):
    raw = str(uuid.uuid4())
    client.put("/api/me", headers={"X-User-Id": raw.upper()}, json={"display_name": "Sam"})
    assert client.get("/api/me", headers={"X-User-Id": raw}).json()["display_name"] == "Sam"


def test_users_cannot_see_each_others_data(client):
    alice, bob = user_headers(), user_headers()
    client.put("/api/me", headers=alice, json={"display_name": "Alice", "phone": "+1 555 0100"})
    scan = client.post("/api/scans/analyze", headers=alice, json={"demo_fixture_id": "demo-lentil-soup"}).json()

    assert client.get(f"/api/scans/{scan['scan_id']}", headers=bob).status_code == 404
    assert client.get("/api/scans", headers=bob).json()["scans"] == []
    assert client.get("/api/me", headers=bob).json()["display_name"] == ""
    assert client.delete("/api/scans", headers=bob).json()["deleted"] == 0
    assert len(client.get("/api/scans", headers=alice).json()["scans"]) == 1


def test_email_is_an_optional_plain_profile_field(client):
    headers = user_headers()
    assert client.put("/api/me", headers=headers, json={"email": "new@example.com"}).json()["email"] == "new@example.com"
    bad = client.put("/api/me", headers=headers, json={"email": "not-an-email"})
    assert bad.status_code == 422 and bad.json()["error"]["code"] == "invalid_input"
    assert client.put("/api/me", headers=headers, json={"email": ""}).json()["email"] == ""


def test_identify_without_openrouter_is_recoverable(client):
    import io
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (20, 20)).save(buf, format="JPEG")
    resp = client.post("/api/scans/identify", headers=user_headers(),
                       files={"file": ("p.jpg", buf.getvalue(), "image/jpeg")})
    assert resp.status_code == 503
    err = resp.json()["error"]
    assert err["code"] == "vision_unavailable"
    assert "OPENROUTER_API_KEY is not set" in err["message"] and "OPENROUTER_MODEL is not set" in err["message"]


def test_health_reports_openrouter_as_boolean_only(client):
    assert client.get("/api/health").json() == {"status": "ok", "openrouter_configured": False}
