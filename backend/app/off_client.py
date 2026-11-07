"""Open Food Facts lookups (no API key). Data is crowdsourced, so it is labelled as such in evidence."""

import re

import httpx

from .db import now_iso

OFF_BASE = "https://world.openfoodfacts.org"
USER_AGENT = "rootd-hackathon-mvp/0.1 (https://github.com/drishtisingh489/rootd)"
FIELDS = ",".join([
    "code", "product_name", "product_name_en", "brands", "quantity", "image_front_small_url", "image_front_url",
    "ingredients_text", "ingredients_text_en", "allergens_tags", "traces_tags", "ingredients_analysis_tags",
    "nutriments", "nutriscore_grade", "nova_group", "labels_tags", "packagings", "packaging_tags",
    "ecoscore_grade", "environmental_score_grade", "origins", "categories_tags", "last_modified_t",
])

SEARCH_URL = "https://search.openfoodfacts.org/search"
SEARCH_FIELDS = "code,product_name,product_name_en,brands,quantity,image_front_small_url"

BARCODE_RE = re.compile(r"^\d{8,14}$")


class OFFError(Exception):
    pass


def clean_barcode(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    return digits if BARCODE_RE.match(digits) else None


def product_url(code: str) -> str:
    return f"{OFF_BASE}/product/{code}"


def to_evidence(p: dict) -> dict:
    """Map an OFF product document into the evidence shape the verdict engine reads."""
    code = p.get("code") or ""
    grade = p.get("environmental_score_grade") or p.get("ecoscore_grade")
    brands = p.get("brands") or ""
    if isinstance(brands, list):  # the search service returns a list
        brands = ",".join(brands)
    return {
        "source": "open_food_facts",
        "source_title": f"Open Food Facts product record {code}".strip(),
        "publisher": "Open Food Facts (crowdsourced)",
        "source_url": product_url(code) if code else None,
        "checked_at": now_iso(),
        "name": (p.get("product_name_en") or p.get("product_name") or "").strip(),
        "brand": brands.split(",")[0].strip(),
        "barcode": code or None,
        "package_size": (p.get("quantity") or "").strip() or None,
        "image_url": p.get("image_front_small_url") or p.get("image_front_url"),
        "ingredients_text": (p.get("ingredients_text_en") or p.get("ingredients_text") or "").strip() or None,
        "allergens_tags": p.get("allergens_tags") or [],
        "traces_tags": p.get("traces_tags") or [],
        "analysis_tags": p.get("ingredients_analysis_tags") or [],
        "labels_tags": p.get("labels_tags") or [],
        "categories_tags": p.get("categories_tags") or [],
        "nutriments": p.get("nutriments") or {},
        "nutriscore_grade": p.get("nutriscore_grade") if p.get("nutriscore_grade") in list("abcde") else None,
        "nova_group": p.get("nova_group") if p.get("nova_group") in (1, 2, 3, 4) else None,
        "environmental_grade": grade if grade in ("a-plus", "a", "b", "c", "d", "e", "f") else None,
        "packagings": p.get("packagings") or [],
        "origins": (p.get("origins") or "").strip() or None,
    }


async def get_product(barcode: str, client: httpx.AsyncClient) -> dict | None:
    try:
        resp = await client.get(
            f"{OFF_BASE}/api/v2/product/{barcode}.json",
            params={"fields": FIELDS},
            headers={"User-Agent": USER_AGENT},
        )
    except httpx.HTTPError as exc:
        raise OFFError(f"Open Food Facts request failed: {exc.__class__.__name__}") from exc
    if resp.status_code == 404:
        return None
    if resp.status_code >= 400:
        raise OFFError(f"Open Food Facts returned HTTP {resp.status_code}")
    data = resp.json()
    if data.get("status") != 1 or not data.get("product"):
        return None
    return to_evidence(data["product"])


async def search_products(query: str, client: httpx.AsyncClient, limit: int = 5) -> list[dict]:
    """Name/brand search for identity candidates. Full evidence is fetched later by barcode."""
    query = query.strip()
    if not query:
        return []
    try:
        resp = await client.get(
            SEARCH_URL,
            params={"q": query, "page_size": limit, "fields": SEARCH_FIELDS},
            headers={"User-Agent": USER_AGENT},
        )
    except httpx.HTTPError as exc:
        raise OFFError(f"Open Food Facts search failed: {exc.__class__.__name__}") from exc
    if resp.status_code >= 400:
        raise OFFError(f"Open Food Facts search returned HTTP {resp.status_code}")
    try:
        hits = resp.json().get("hits", [])
    except ValueError as exc:
        raise OFFError("Open Food Facts search returned an unexpected response") from exc
    return [to_evidence(p) for p in hits if p.get("code")]
