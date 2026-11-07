"""Fictional demo products for running the flow without OpenRouter. Always labelled as demo data in the UI."""

from .db import now_iso

_BASE = {
    "source": "demo_fixture",
    "publisher": "root'd demo data (fictional product)",
    "source_url": None,
    "barcode": None,
    "image_url": None,
    "origins": None,
    "categories_tags": [],
}

FIXTURES = {
    "demo-oat-honey-bar": {
        "name": "Oat & Honey Crunch Bar (DEMO)",
        "brand": "Demo Pantry",
        "package_size": "40 g",
        "ingredients_text": "Rolled oats, sugar, honey, palm oil, almonds (6%), glucose syrup, soy lecithin, salt.",
        "allergens_tags": ["en:nuts", "en:soybeans"],
        "traces_tags": ["en:peanuts", "en:milk"],
        "analysis_tags": ["en:non-vegan", "en:vegetarian", "en:palm-oil"],
        "labels_tags": [],
        "nutriments": {"energy-kcal_100g": 452, "sugars_100g": 24.5, "salt_100g": 0.42, "proteins_100g": 8.1,
                       "fiber_100g": 5.2, "carbohydrates_100g": 61},
        "nutriscore_grade": "d",
        "nova_group": 4,
        "environmental_grade": "c",
        "packagings": [{"material": "en:plastic", "shape": "en:wrapper", "recycling": "en:discard"}],
    },
    "demo-lentil-soup": {
        "name": "Organic Red Lentil Soup (DEMO)",
        "brand": "Demo Kitchen",
        "package_size": "400 g",
        "ingredients_text": "Water, red lentils* (18%), carrots*, onions*, tomato paste*, olive oil*, garlic*, sea "
                            "salt, cumin*. *Organic.",
        "allergens_tags": [],
        "traces_tags": [],
        "analysis_tags": ["en:vegan", "en:vegetarian", "en:palm-oil-free"],
        "labels_tags": ["en:organic", "en:eu-organic"],
        "nutriments": {"energy-kcal_100g": 62, "sugars_100g": 2.1, "salt_100g": 0.55, "proteins_100g": 3.6,
                       "fiber_100g": 2.4, "carbohydrates_100g": 8.9},
        "nutriscore_grade": "a",
        "nova_group": 3,
        "environmental_grade": "b",
        "packagings": [{"material": "en:steel", "shape": "en:can", "recycling": "en:recycle"}],
    },
    "demo-hazelnut-spread": {
        "name": "Cocoa Hazelnut Spread (DEMO)",
        "brand": "Demo Sweets",
        "package_size": "350 g",
        "ingredients_text": "Sugar, palm oil, hazelnuts (13%), skimmed milk powder (8.7%), fat-reduced cocoa (7.4%), "
                            "soy lecithin, vanillin.",
        "allergens_tags": ["en:nuts", "en:milk", "en:soybeans"],
        "traces_tags": [],
        "analysis_tags": ["en:non-vegan", "en:vegetarian", "en:palm-oil"],
        "labels_tags": [],
        "nutriments": {"energy-kcal_100g": 539, "sugars_100g": 56.3, "salt_100g": 0.11, "proteins_100g": 6.3,
                       "fiber_100g": 3.4, "carbohydrates_100g": 57.5},
        "nutriscore_grade": "e",
        "nova_group": 4,
        "environmental_grade": "d",
        "packagings": [{"material": "en:glass", "shape": "en:jar", "recycling": "en:recycle"},
                       {"material": "en:pp-polypropylene", "shape": "en:lid", "recycling": "en:recycle"}],
    },
}


def list_fixtures() -> list[dict]:
    return [{"id": k, "name": v["name"], "brand": v["brand"], "package_size": v["package_size"]}
            for k, v in FIXTURES.items()]


def get_fixture(fixture_id: str) -> dict | None:
    fixture = FIXTURES.get(fixture_id)
    if not fixture:
        return None
    return {**_BASE, **fixture, "source_title": f"Demo fixture: {fixture['name']}", "checked_at": now_iso()}


DEMO_RECALL = {
    "status": "not_verified",
    "verdict": "gray",
    "message": "Demo product: no recall check was performed.",
    "sources": [],
    "coverage_note": "Demo fixtures are fictional and are not checked against openFDA.",
}
