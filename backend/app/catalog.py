"""Loads the preference catalog shared with the frontend (shared/preferences.json)."""

import json
from functools import lru_cache
from pathlib import Path

CATALOG_PATH = Path(__file__).resolve().parents[2] / "shared" / "preferences.json"

OTHER_PREFIX = "other:"

PREFERENCE_GROUPS = (
    "allergens",
    "dietary_patterns",
    "dietary_restrictions",
    "religious_dietary_requirements",
    "nutrition_goals",
    "ethical_values",
    "environmental_priorities",
)


@lru_cache(maxsize=1)
def catalog() -> dict:
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def _labels() -> dict[tuple[str, str], str]:
    labels = {}
    for category in catalog()["categories"]:
        for group in category["groups"]:
            for option in group["options"]:
                labels[(group["id"], option["id"])] = option["label"]
    return labels


def option_label(group_id: str, option_id: str) -> str:
    if option_id.startswith(OTHER_PREFIX):
        return option_id[len(OTHER_PREFIX):].strip()
    return _labels().get((group_id, option_id), option_id.replace("_", " ").capitalize())


def valid_option(group_id: str, option_id: str) -> bool:
    if option_id.startswith(OTHER_PREFIX):
        text = option_id[len(OTHER_PREFIX):].strip()
        return 0 < len(text) <= 60
    return (group_id, option_id) in _labels()


def normalize_preferences(raw: dict | None) -> dict:
    """Keep only known groups/options (plus short free-text 'other:' items); drop anything else."""
    raw = raw or {}
    prefs: dict = {}
    for group_id in PREFERENCE_GROUPS:
        seen, values = set(), []
        for item in raw.get(group_id) or []:
            if isinstance(item, str) and item not in seen and valid_option(group_id, item):
                seen.add(item)
                values.append(item)
        prefs[group_id] = values
    prefs["allergy_cross_contact"] = bool(raw.get("allergy_cross_contact", False))
    levels = {}
    for key, value in (raw.get("levels") or {}).items():
        if not isinstance(key, str) or ":" not in key:
            continue
        group_id, option_id = key.split(":", 1)
        if value in {"preference", "strict", "important", "must_have"} and option_id in prefs.get(group_id, []):
            levels[key] = value
    prefs["levels"] = levels
    return prefs


def hard_restrictions(prefs: dict) -> list[str]:
    """Allergens are always hard; diet/religious items are hard only when marked strict."""
    hard = [f"allergens:{a}" for a in prefs.get("allergens", [])]
    for group_id in ("dietary_patterns", "dietary_restrictions", "religious_dietary_requirements"):
        for option_id in prefs.get(group_id, []):
            if prefs.get("levels", {}).get(f"{group_id}:{option_id}") == "strict":
                hard.append(f"{group_id}:{option_id}")
    return hard
