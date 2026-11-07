"""openFDA food enforcement (recall) lookups with a conservative matching policy.

Policy:
  - Barcode (UPC) appears in an Ongoing recall record      -> "verified_match" (red)
  - Barcode appears in a completed/terminated recall        -> "past_recall" (yellow)
  - Brand + product-name words match an Ongoing recall      -> "possible_match" (yellow; check lot codes)
  - Queries succeed with no matches                         -> "no_match_found" (green, with coverage caveat)
  - API unavailable / product unidentified                  -> "not_verified" (gray)
A fuzzy brand match is never reported as a confirmed recall.
"""

import re
from urllib.parse import quote

import httpx

from .db import now_iso

OPENFDA_URL = "https://api.fda.gov/food/enforcement.json"
FDA_RECALLS_PAGE = "https://www.fda.gov/safety/recalls-market-withdrawals-safety-alerts"
COVERAGE_NOTE = (
    "openFDA covers FDA-regulated foods in the US. Meat, poultry and egg products are recalled by USDA FSIS "
    "and are not included."
)
STOPWORDS = {"the", "and", "with", "of", "for", "in", "a", "an", "organic", "original", "natural", "classic"}


def _query_url(search: str, limit: int, api_key: str) -> str:
    # openFDA uses "+" for spaces, including inside quoted phrases.
    encoded = quote(search.replace(" ", "+"), safe=':+[]"()')
    url = f"{OPENFDA_URL}?search={encoded}&limit={limit}&sort=report_date:desc"
    return url + (f"&api_key={api_key}" if api_key else "")


def _phrase(value: str) -> str:
    return re.sub(r'["\\]', "", value).strip()


def _public_url(search: str, limit: int) -> str:
    return _query_url(search, limit, api_key="")


def _record_source(rec: dict, checked_at: str) -> dict:
    number = rec.get("recall_number", "")
    return {
        "title": f"FDA enforcement report {number}: {rec.get('recalling_firm', 'Unknown firm')}",
        "publisher": "U.S. Food and Drug Administration (openFDA)",
        "url": _public_url(f'recall_number:"{number}"', 1) if number else FDA_RECALLS_PAGE,
        "checked_at": checked_at,
        "record_details": {
            "recall_number": number,
            "status": rec.get("status"),
            "classification": rec.get("classification"),
            "report_date": rec.get("report_date"),
            "product_description": (rec.get("product_description") or "")[:400],
            "reason_for_recall": (rec.get("reason_for_recall") or "")[:400],
            "code_info": (rec.get("code_info") or "")[:300],
        },
    }


async def _search(client: httpx.AsyncClient, search: str, limit: int, api_key: str) -> list[dict]:
    resp = await client.get(_query_url(search, limit, api_key))
    if resp.status_code == 404:  # openFDA answers "no matches" with 404 NOT_FOUND
        return []
    resp.raise_for_status()
    return resp.json().get("results", [])


def _upc_variants(barcode: str) -> list[str]:
    variants = {barcode}
    if len(barcode) == 13 and barcode.startswith("0"):
        variants.add(barcode[1:])  # EAN-13 with leading zero == UPC-A
    return sorted(variants)


def _name_words(name: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]{3,}", name.lower()) if w not in STOPWORDS}


async def check_recalls(
    client: httpx.AsyncClient, *, name: str, brand: str, barcode: str | None, api_key: str = ""
) -> dict:
    checked_at = now_iso()
    searches: list[str] = []
    try:
        if barcode:
            for upc in _upc_variants(barcode):
                search = f'product_description:"{upc}"+code_info:"{upc}"'
                searches.append(search)
                for rec in await _search(client, search, 5, api_key):
                    text = f"{rec.get('product_description', '')} {rec.get('code_info', '')}"
                    if upc in re.sub(r"[\s-]", "", text):
                        ongoing = (rec.get("status") or "").lower() == "ongoing"
                        return {
                            "status": "verified_match" if ongoing else "past_recall",
                            "verdict": "red" if ongoing else "yellow",
                            "checked_at": checked_at,
                            "message": (
                                "An ongoing FDA recall lists this product's barcode."
                                if ongoing else
                                f"A past FDA recall (status: {rec.get('status')}) lists this barcode. "
                                "Check whether your package's lot/date is affected."
                            ),
                            "sources": [_record_source(rec, checked_at)],
                            "coverage_note": COVERAGE_NOTE,
                        }
        possible = []
        brand = _phrase(brand)
        if brand:
            search = f'(recalling_firm:"{brand}"+product_description:"{brand}")+AND+status:"Ongoing"'
            searches.append(search)
            words = _name_words(name)
            for rec in await _search(client, search, 20, api_key):
                desc_words = _name_words(rec.get("product_description", ""))
                if words and len(words & desc_words) >= min(2, len(words)):
                    possible.append(rec)
        if possible:
            return {
                "status": "possible_match",
                "verdict": "yellow",
                "checked_at": checked_at,
                "message": (
                    f"{len(possible)} ongoing FDA recall(s) mention this brand and similar product words, but none "
                    "list this exact barcode. Compare the lot codes on your package with the notice."
                ),
                "sources": [_record_source(r, checked_at) for r in possible[:3]],
                "coverage_note": COVERAGE_NOTE,
            }
    except (httpx.HTTPError, ValueError):
        return {
            "status": "not_verified",
            "verdict": "gray",
            "checked_at": checked_at,
            "message": "The openFDA recall service could not be reached, so recalls were not checked.",
            "sources": [],
            "coverage_note": COVERAGE_NOTE,
        }

    if not searches:
        return {
            "status": "not_verified",
            "verdict": "gray",
            "checked_at": checked_at,
            "message": "No barcode or brand was available to search recall records.",
            "sources": [],
            "coverage_note": COVERAGE_NOTE,
        }
    return {
        "status": "no_match_found",
        "verdict": "green",
        "checked_at": checked_at,
        "message": "No matching FDA recall was found for this product's barcode or brand.",
        "sources": [{
            "title": "openFDA food enforcement search (no matching records)",
            "publisher": "U.S. Food and Drug Administration (openFDA)",
            "url": _public_url(searches[0], 5),
            "checked_at": checked_at,
        }],
        "coverage_note": COVERAGE_NOTE,
    }
