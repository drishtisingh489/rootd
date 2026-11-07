"""Scan-derived Insights. Everything here counts scans, never purchases: scanning doesn't prove buying."""

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from .catalog import option_label


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts.replace("Z", "+00:00"))


def _value_status(statuses: list[str]) -> str:
    known = [s for s in statuses if s != "gray"]
    if len(known) < 2:
        return "more_data_needed"
    bad = sum(1 for s in known if s in ("red", "yellow"))
    return "needs_attention" if bad / len(known) >= 0.4 else "strong"


def compute(scans: list[dict], prefs: dict, days: int = 30, now: datetime | None = None) -> dict:
    now = now or datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    period = [s for s in scans if _parse(s["created_at"]) >= since]

    rated = [s for s in period if s["overall_result"]["status"] in ("green", "yellow", "red")]
    aligned = [s for s in rated if s["overall_result"]["status"] == "green"]
    unknown = len(period) - len(rated)
    pct = round(100 * len(aligned) / len(rated)) if rated else None

    # Per-preference status across scans in the period.
    by_value: dict[str, list[str]] = defaultdict(list)
    for scan in period:
        for item in scan["preference_breakdown"]:
            by_value[item["id"]].append(item["status"])
    values = []
    for group_id in ("allergens", "dietary_patterns", "dietary_restrictions", "religious_dietary_requirements",
                     "nutrition_goals", "ethical_values", "environmental_priorities"):
        for option_id in prefs.get(group_id, []):
            key = f"{group_id}:{option_id}"
            if key not in by_value and option_id in ("omnivore", "prefer_not_to_say"):
                continue
            statuses = by_value.get(key, [])
            values.append({
                "id": key,
                "label": option_label(group_id, option_id),
                "status": _value_status(statuses),
                "checked_scans": sum(1 for s in statuses if s != "gray"),
            })

    # Milestones from all scans (not just the period).
    ordered = sorted(scans, key=lambda s: s["created_at"])
    milestones = []

    def add(mid: str, title: str, description: str, scan: dict | None, target: int, progress: int):
        milestones.append({
            "id": mid, "title": title, "description": description,
            "achieved": scan is not None, "achieved_at": scan["created_at"] if scan else None,
            "scan_id": scan["scan_id"] if scan else None, "progress": min(progress, target), "target": target,
        })

    add("first_scan", "First scan", "Scanned your first product.", ordered[0] if ordered else None, 1, len(ordered))
    add("five_scans", "Five scans", "Scanned five products.", ordered[4] if len(ordered) >= 5 else None, 5,
        len(ordered))
    first_green = next((s for s in ordered if s["overall_result"]["status"] == "green"), None)
    add("first_green", "First Good Match", "Found a product that aligned with your values.", first_green, 1,
        1 if first_green else 0)
    day_first: dict[str, dict] = {}
    for s in ordered:
        day_first.setdefault(s["created_at"][:10], s)
    seventh = list(day_first.values())[6] if len(day_first) >= 7 else None
    add("seven_days", "Seven scanning days", "Scanned on seven different days.", seventh, 7, len(day_first))

    # Explore-your-impact topics, only when relevant to the user's choices or data.
    deforestation_items = [
        {"scan_id": s["scan_id"], "product": s["product"].get("name"), "item": i}
        for s in period for i in s["preference_breakdown"] if i["id"].endswith("reduced_deforestation")
    ]
    safety_items = [
        {"scan_id": s["scan_id"], "product": s["product"].get("name"), "item": i}
        for s in period for i in s["preference_breakdown"]
        if i["id"] == "food_safety:recall" or (i["id"].startswith("allergens:") and i["status"] in ("red", "yellow"))
    ]
    evidence = []
    for s in period:
        for src in s.get("sources", []):
            evidence.append({"scan_id": s["scan_id"], "product": s["product"].get("name"), **src})
    gaps = [{"scan_id": s["scan_id"], "product": s["product"].get("name"), "gap": g}
            for s in period for g in s.get("data_gaps", [])]

    topics = []
    if "reduced_deforestation" in prefs.get("environmental_priorities", []) or deforestation_items:
        topics.append({"id": "deforestation", "title": "Deforestation insights",
                       "subtitle": "Sourcing and origin evidence", "count": len(deforestation_items)})
    topics.append({"id": "food-safety", "title": "Food safety insights", "subtitle": "Recall and allergen checks",
                   "count": len(safety_items)})
    topics.append({"id": "evidence", "title": "Your evidence report",
                   "subtitle": "Sources, data freshness and unknowns", "count": len(evidence)})

    return {
        "period_days": days,
        "alignment": {
            "percent": pct,
            "aligned": len(aligned),
            "rated": len(rated),
            "unknown": unknown,
            "definition": "Share of scans in this period rated Good Match, out of scans with a definite rating "
                          "(Good Match, Mixed Fit or Strong Conflict). Scans with Insufficient Data are excluded "
                          "from the denominator.",
        },
        "counts": {"scans": len(period), "aligned_scans": len(aligned)},
        "values": values,
        "topics": topics,
        "details": {"deforestation": deforestation_items, "food-safety": safety_items,
                    "evidence": {"sources": evidence, "gaps": gaps}},
        "milestones": milestones,
        "disclaimer": "Insights count scans, not purchases. Scanning a product doesn't mean you bought or ate it.",
    }
