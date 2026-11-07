import asyncio
import io
import json
from dataclasses import replace

import httpx
import pytest
from PIL import Image

from app import openrouter_client as orc
from app.config import load_settings

SETTINGS = replace(load_settings(), openrouter_api_key="test-key", openrouter_model="test/vision-model")


def png_bytes(size=(64, 64)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, (0, 150, 100)).save(buf, format="PNG")
    return buf.getvalue()


def reply(content: str) -> dict:
    return {"choices": [{"message": {"content": content}}]}


GOOD = {"candidates": [{"name": "Rolled Oats", "brand": "Acme", "variant": None, "package_size": "500 g",
                        "barcode": "0 12345 67890 5", "confidence": 0.82}],
        "visible_text": "ACME Rolled Oats", "visible_ingredients": "Whole grain oats.",
        "cannot_determine": ["lot number"], "ambiguity_notes": None, "is_food_product": True}


def run(handler, attempts=3):
    transport = httpx.MockTransport(handler)
    data_url = orc.normalize_image(png_bytes(), "image/png", 5_000_000)
    return asyncio.run(orc.identify(data_url, SETTINGS, transport=transport, attempts=attempts))


def test_parses_fenced_json_and_sends_image_part():
    seen = {}

    def handler(request: httpx.Request):
        seen["auth"] = request.headers["authorization"]
        seen["body"] = json.loads(request.content)
        return httpx.Response(200, json=reply("```json\n" + json.dumps(GOOD) + "\n```"))

    result = run(handler)
    assert seen["auth"] == "Bearer test-key"
    parts = seen["body"]["messages"][0]["content"]
    assert parts[1]["type"] == "image_url" and parts[1]["image_url"]["url"].startswith("data:image/jpeg;base64,")
    assert seen["body"]["model"] == "test/vision-model"
    assert result["candidates"][0]["barcode"] == "012345678905"
    assert result["visible_ingredients"] == "Whole grain oats."


def test_retries_transient_errors(monkeypatch):
    real_sleep = asyncio.sleep
    monkeypatch.setattr(orc.asyncio, "sleep", lambda _: real_sleep(0))
    calls = {"n": 0}

    def handler(_):
        calls["n"] += 1
        return httpx.Response(503) if calls["n"] < 2 else httpx.Response(200, json=reply(json.dumps(GOOD)))

    assert run(handler)["candidates"][0]["name"] == "Rolled Oats"
    assert calls["n"] == 2


def test_malformed_output_raises():
    with pytest.raises(orc.VisionError):
        run(lambda _: httpx.Response(200, json=reply("I think this is oatmeal!")))


def test_non_retryable_error_raises_without_leaking_key():
    with pytest.raises(orc.VisionError) as exc:
        run(lambda _: httpx.Response(401, json={"error": {"message": "bad key"}}))
    assert "test-key" not in str(exc.value)


def test_unconfigured_raises_unavailable():
    with pytest.raises(orc.VisionUnavailable):
        asyncio.run(orc.identify("data:image/jpeg;base64,AAAA", replace(SETTINGS, openrouter_api_key="")))


def test_rejects_bad_images():
    with pytest.raises(orc.InvalidImage):
        orc.normalize_image(b"not an image", "image/png", 5_000_000)
    with pytest.raises(orc.InvalidImage):
        orc.normalize_image(png_bytes(), "image/gif", 5_000_000)
    with pytest.raises(orc.InvalidImage):
        orc.normalize_image(png_bytes(), "image/png", 10)


def test_large_images_are_downscaled():
    import base64
    url = orc.normalize_image(png_bytes((4000, 3000)), "image/png", 50_000_000)
    img = Image.open(io.BytesIO(base64.b64decode(url.split(",", 1)[1])))
    assert max(img.size) == orc.MAX_SIDE


def test_parse_drops_invalid_candidates():
    parsed = orc.parse_identification({"candidates": [{"name": "", "brand": ""}, "junk",
                                                      {"name": "X", "confidence": "high", "barcode": "12"}]})
    assert len(parsed["candidates"]) == 1
    assert parsed["candidates"][0]["confidence"] == 0.0
    assert parsed["candidates"][0]["barcode"] is None
