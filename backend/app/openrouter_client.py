"""Server-side OpenRouter vision client for product identification.

Model output is treated as an unverified *candidate*: the user confirms it, and every factual claim in a
result comes from Open Food Facts / openFDA, not from the model. The API key never leaves the server.
"""

import asyncio
import base64
import io
import json
import re

import httpx
from PIL import Image, UnidentifiedImageError

from .config import Settings

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_SIDE = 1280
RETRY_STATUS = {408, 429, 500, 502, 503, 504}

PROMPT = """You are helping identify a packaged food product from a shopper's photo.
Report only what is visible. Do not guess facts that aren't shown on the package.
Respond with ONLY a JSON object, no prose, in exactly this shape:
{
  "candidates": [
    {"name": "product name as printed", "brand": "brand as printed", "variant": "flavour/variant or null",
     "package_size": "net weight/volume as printed or null", "barcode": "digits if a barcode number is legible, else null",
     "confidence": 0.0}
  ],
  "visible_text": "key label text you can read (max 300 chars)",
  "visible_ingredients": "the ingredients list exactly as printed, or null if not visible",
  "cannot_determine": ["things that cannot be determined from this image"],
  "ambiguity_notes": "why identification may be uncertain, or null",
  "is_food_product": true
}
List up to 3 candidates, most likely first. confidence is 0-1. If this is not a food product, return
"is_food_product": false and an empty candidates list."""


class VisionUnavailable(Exception):
    """OpenRouter isn't configured (no key or model)."""


class VisionError(Exception):
    """OpenRouter call failed or returned unusable output."""


class InvalidImage(ValueError):
    pass


def normalize_image(data: bytes, content_type: str | None, max_bytes: int) -> str:
    """Validate type/size, downscale large photos, and return a JPEG data URL."""
    if content_type not in ALLOWED_MIME:
        raise InvalidImage("Please upload a JPG, PNG, or WEBP image.")
    if len(data) > max_bytes:
        raise InvalidImage(f"Image is too large (max {max_bytes // (1024 * 1024)} MB).")
    try:
        img = Image.open(io.BytesIO(data))
        img.verify()
        img = Image.open(io.BytesIO(data))
    except (UnidentifiedImageError, OSError, SyntaxError):
        raise InvalidImage("The file couldn't be read as an image.")
    if img.format not in ("JPEG", "PNG", "WEBP", "MPO"):
        raise InvalidImage("Please upload a JPG, PNG, or WEBP image.")
    img = img.convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    out = io.BytesIO()
    img.save(out, format="JPEG", quality=85)
    return "data:image/jpeg;base64," + base64.b64encode(out.getvalue()).decode("ascii")


def _extract_json(text: str) -> dict:
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1).strip()
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        raise VisionError("The vision model didn't return structured data.")
    try:
        return json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise VisionError("The vision model returned malformed JSON.") from exc


def _clean_str(value, limit: int) -> str | None:
    if not isinstance(value, str):
        return None
    value = value.strip()
    if not value or value.lower() in {"null", "none", "unknown", "n/a"}:
        return None
    return value[:limit]


def _clean_barcode(value) -> str | None:
    if value is None:
        return None
    digits = re.sub(r"\D", "", str(value))
    return digits if 8 <= len(digits) <= 14 else None


def parse_identification(raw: dict) -> dict:
    """Validate the model's JSON into a safe, bounded structure."""
    candidates = []
    for c in (raw.get("candidates") or [])[:3]:
        if not isinstance(c, dict):
            continue
        name = _clean_str(c.get("name"), 120)
        brand = _clean_str(c.get("brand"), 80)
        if not name and not brand:
            continue
        try:
            confidence = min(max(float(c.get("confidence", 0)), 0.0), 1.0)
        except (TypeError, ValueError):
            confidence = 0.0
        candidates.append({
            "name": name or "",
            "brand": brand or "",
            "variant": _clean_str(c.get("variant"), 80),
            "package_size": _clean_str(c.get("package_size"), 40),
            "barcode": _clean_barcode(c.get("barcode")),
            "confidence": round(confidence, 2),
        })
    cannot = [s[:160] for s in (raw.get("cannot_determine") or []) if isinstance(s, str)][:6]
    return {
        "candidates": candidates,
        "visible_text": _clean_str(raw.get("visible_text"), 300),
        "visible_ingredients": _clean_str(raw.get("visible_ingredients"), 2000),
        "cannot_determine": cannot,
        "ambiguity_notes": _clean_str(raw.get("ambiguity_notes"), 300),
        "is_food_product": raw.get("is_food_product", True) is not False,
    }


async def identify(
    image_data_url: str,
    settings: Settings,
    transport: httpx.AsyncBaseTransport | None = None,
    attempts: int = 3,
) -> dict:
    if not settings.openrouter_configured:
        raise VisionUnavailable("OpenRouter is not configured (OPENROUTER_API_KEY / OPENROUTER_MODEL).")
    payload = {
        "model": settings.openrouter_model,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": PROMPT},
                {"type": "image_url", "image_url": {"url": image_data_url}},
            ],
        }],
        "max_tokens": 700,
        "temperature": 0,
    }
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.openrouter_site_url,
        "X-Title": settings.openrouter_app_name,
    }
    url = f"{settings.openrouter_base_url}/chat/completions"
    last_error = "unknown error"
    async with httpx.AsyncClient(timeout=httpx.Timeout(45, connect=10), transport=transport) as client:
        for attempt in range(attempts):
            try:
                resp = await client.post(url, headers=headers, json=payload)
            except httpx.TimeoutException:
                last_error = "the request timed out"
            except httpx.HTTPError as exc:
                last_error = f"network error ({exc.__class__.__name__})"
            else:
                if resp.status_code == 200:
                    body = resp.json()
                    if body.get("error"):
                        raise VisionError(f"OpenRouter error: {str(body['error'].get('message', ''))[:200]}")
                    try:
                        content = body["choices"][0]["message"]["content"]
                    except (KeyError, IndexError, TypeError):
                        raise VisionError("OpenRouter returned an unexpected response shape.")
                    if isinstance(content, list):  # some providers return content parts
                        content = "".join(p.get("text", "") for p in content if isinstance(p, dict))
                    return parse_identification(_extract_json(content or ""))
                if resp.status_code not in RETRY_STATUS:
                    raise VisionError(f"OpenRouter returned HTTP {resp.status_code}.")
                last_error = f"HTTP {resp.status_code}"
            if attempt < attempts - 1:
                await asyncio.sleep(0.6 * 2**attempt)
    raise VisionError(f"OpenRouter request failed after {attempts} attempts: {last_error}.")
