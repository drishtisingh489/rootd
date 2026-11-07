"""Deterministic preference-fit rules. The LLM never decides a verdict.

Each saved preference becomes one breakdown item with a status:
  green  = aligned            yellow = caution / partial
  red    = conflict           gray   = unknown / not enough data
Items carry their own evidence sources so the UI can show "View original source" per rating.

Precedence for the overall result (spec section 3):
  verified recall or hard-restriction conflict -> red
  hard restriction that cannot be checked      -> unknown (Insufficient Data)
  any soft conflict / caution                  -> yellow
  at least one verified alignment, no gaps on hard items -> green
  otherwise                                    -> unknown
"""

import re
from dataclasses import dataclass, field

from .catalog import OTHER_PREFIX, hard_restrictions, option_label

SECTION_ALLERGY = "Allergies & Diets"
SECTION_NUTRITION = "Nutrition Goals"
SECTION_ETHICAL = "Ethical Values"
SECTION_ENVIRONMENT = "Environmental Priorities"
SECTION_SAFETY = "Food Safety / Recalls"

FSA_SOURCE = {
    "title": "Guide to creating a front of pack nutrition label (Annex 3: colour-coding criteria)",
    "publisher": "UK Department of Health and Social Care / Food Standards Agency (2016)",
    "url": "https://assets.publishing.service.gov.uk/media/5a80cd03ed915d74e33fc7c5/FoP_Nutrition_labelling_UK_guidance.pdf",
}
EU_CLAIMS_SOURCE = {
    "title": "Regulation (EC) No 1924/2006, Annex: nutrition claims and conditions",
    "publisher": "European Union (EUR-Lex)",
    "url": "https://eur-lex.europa.eu/eli/reg/2006/1924/oj/eng",
}
OWID_DEFORESTATION_SOURCE = {
    "title": "Cutting down forests: what are the drivers of deforestation?",
    "publisher": "Our World in Data (Hannah Ritchie, 2021)",
    "url": "https://ourworldindata.org/drivers-of-deforestation",
}

# Allergen option id -> (OFF allergen tags, ingredient keywords)
ALLERGENS: dict[str, tuple[set[str], list[str]]] = {
    "milk": ({"en:milk"}, ["milk", "cream", "butter", "cheese", "whey", "casein", "caseinate", "lactose", "yogurt",
                           "yoghurt", "ghee", "buttermilk", "curd"]),
    "eggs": ({"en:eggs"}, ["egg", "eggs", "albumen", "albumin", "ovalbumin", "lysozyme"]),
    "fish": ({"en:fish"}, ["fish", "anchovy", "anchovies", "salmon", "tuna", "cod", "sardine", "sardines",
                           "mackerel", "haddock", "tilapia", "pollock"]),
    "shellfish": ({"en:crustaceans", "en:molluscs"}, ["shrimp", "prawn", "prawns", "crab", "lobster", "shellfish",
                                                      "crayfish", "clam", "clams", "mussel", "mussels", "oyster",
                                                      "oysters", "scallop", "scallops", "squid"]),
    "tree_nuts": ({"en:nuts"}, ["almond", "almonds", "cashew", "cashews", "walnut", "walnuts", "pecan", "pecans",
                                "hazelnut", "hazelnuts", "pistachio", "pistachios", "macadamia", "brazil nut",
                                "tree nut", "tree nuts"]),
    "peanuts": ({"en:peanuts"}, ["peanut", "peanuts", "groundnut", "groundnuts", "arachis"]),
    "wheat": ({"en:gluten"}, ["wheat", "spelt", "durum", "semolina", "farina", "kamut", "einkorn", "emmer"]),
    "soy": ({"en:soybeans"}, ["soy", "soya", "soybean", "soybeans", "tofu", "edamame", "miso", "tempeh"]),
    "sesame": ({"en:sesame-seeds"}, ["sesame", "tahini"]),
}
# Phrases that contain an allergen keyword but are not that allergen.
NOT_DAIRY = ["cocoa butter", "shea butter", "peanut butter", "nut butter", "almond butter", "cashew butter",
             "coconut milk", "coconut cream", "almond milk", "oat milk", "soy milk", "soya milk", "rice milk",
             "cream of tartar"]

MEAT_WORDS = ["beef", "pork", "chicken", "turkey", "lamb", "mutton", "veal", "bacon", "ham", "lard", "gelatin",
              "gelatine", "duck", "goose", "venison", "prosciutto", "pancetta", "salami", "pepperoni", "chorizo",
              "meat", "tallow", "suet", "collagen", "anchovy", "anchovies", "fish", "shrimp", "prawn", "crab",
              "rennet", "carmine", "cochineal"]
NON_FISH_MEAT = ["beef", "pork", "chicken", "turkey", "lamb", "mutton", "veal", "bacon", "ham", "lard", "duck",
                 "goose", "venison", "prosciutto", "pancetta", "salami", "pepperoni", "chorizo", "tallow", "suet"]
ANIMAL_WORDS = MEAT_WORDS + ALLERGENS["milk"][1] + ALLERGENS["eggs"][1] + ["honey", "beeswax", "shellac", "lanolin"]
PORK_WORDS = ["pork", "bacon", "ham", "lard", "prosciutto", "pancetta", "pepperoni", "chorizo", "salami"]
ALCOHOL_WORDS = ["alcohol", "wine", "beer", "rum", "brandy", "liqueur", "vodka", "whisky", "whiskey", "ethanol",
                 "sake", "mirin", "bourbon", "cognac", "sherry"]
JAIN_AVOID = ["onion", "onions", "garlic", "potato", "potatoes", "carrot", "carrots", "beetroot", "beet", "radish",
              "ginger", "turnip", "honey"]
GLUTEN_WORDS = ALLERGENS["wheat"][1] + ["barley", "rye", "malt", "triticale"]

ORGANIC_LABELS = ("en:organic", "en:usda-organic", "en:eu-organic", "en:bio", "fr:ab-agriculture-biologique")
FAIR_TRADE_MARKERS = ("fair-trade", "fairtrade")
WELFARE_MARKERS = ("free-range", "certified-humane", "animal-welfare", "pasture-raised", "rspca", "global-animal-partnership")
CRUELTY_FREE_MARKERS = ("leaping-bunny", "cruelty-free", "vegan")
SUSTAINABLE_MARKERS = ("rainforest-alliance", "msc", "asc", "fair-trade", "fairtrade", "rspo", "sustainable",
                       "organic", "utz")
REGENERATIVE_MARKERS = ("regenerative",)


@dataclass
class Item:
    id: str
    section: str
    label: str
    status: str
    short_reason: str
    detail: str = ""
    evidence_level: str = "unknown"
    evidence_sources: list[dict] = field(default_factory=list)
    no_source_note: str | None = None
    hard: bool = False
    weight: int = 1

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "group": self.section,
            "label": self.label,
            "status": self.status,
            "short_reason": self.short_reason,
            "detail": self.detail,
            "evidence_level": self.evidence_level,
            "evidence_sources": self.evidence_sources,
            "no_source_note": self.no_source_note,
            "hard": self.hard,
        }


# ---- text helpers ---------------------------------------------------------

def _contains_any(text: str, words: list[str], exclude: list[str] | None = None) -> list[str]:
    text = text.lower()
    for phrase in exclude or []:
        text = text.replace(phrase, " ")
    found = []
    for word in words:
        if re.search(rf"(?<![a-z]){re.escape(word.lower())}(?![a-z])", text):
            found.append(word)
    return found


def _labels_have(ev: dict, markers: tuple[str, ...]) -> list[str]:
    return [t for t in ev.get("labels_tags", []) if any(m in t for m in markers)]


def _pretty_tag(tag: str) -> str:
    return tag.split(":", 1)[-1].replace("-", " ")


class Context:
    """Precomputes evidence sources and ingredient texts for one product."""

    def __init__(self, ev: dict, prefs: dict):
        self.ev = ev
        self.prefs = prefs
        self.levels = prefs.get("levels", {})
        self.hard_ids = set(hard_restrictions(prefs))
        self.ingredients = ev.get("ingredients_text") or ""
        self.photo_ingredients = ev.get("ingredients_from_photo") or ""
        self.has_record = ev.get("source") in ("open_food_facts", "demo_fixture")
        self.checked_at = ev.get("checked_at")

    def product_source(self, what: str) -> list[dict]:
        if not self.has_record:
            return []
        return [{
            "title": f"{ev_title(self.ev)} — {what}",
            "publisher": self.ev.get("publisher", ""),
            "url": self.ev.get("source_url"),
            "checked_at": self.checked_at,
        }]

    def photo_source(self) -> list[dict]:
        return [{
            "title": "Label text read from your photo by the vision model (unverified)",
            "publisher": "root'd image analysis via OpenRouter",
            "url": None,
            "checked_at": self.checked_at,
        }]

    def with_ref(self, ref: dict, what: str) -> list[dict]:
        return self.product_source(what) + [{**ref, "checked_at": self.checked_at}]

    def conflict_status(self, key: str) -> tuple[str, bool]:
        """Strict items (and allergens) conflict as red/hard; preferences as yellow/soft."""
        hard = key in self.hard_ids
        return ("red" if hard else "yellow"), hard


def ev_title(ev: dict) -> str:
    return ev.get("source_title") or "Product record"


NO_DATA_NOTE = "No source available: there was no ingredient or label record for this product."


# ---- allergies & diets ------------------------------------------------------

def _allergen_item(ctx: Context, option_id: str) -> Item:
    key = f"allergens:{option_id}"
    name = option_label("allergens", option_id)
    label = f"{name} allergy"
    if option_id.startswith(OTHER_PREFIX):
        slug = name.lower().replace(" ", "-")
        tags, words = {f"en:{slug}"}, [name.lower()]
    else:
        tags, words = ALLERGENS[option_id]
    exclude = NOT_DAIRY if option_id == "milk" else None
    ev = ctx.ev

    declared = sorted(tags & set(ev.get("allergens_tags", [])))
    in_text = _contains_any(ctx.ingredients, words, exclude) if ctx.ingredients else []
    if declared or in_text:
        terms = list(dict.fromkeys(w for w in in_text if w != name.lower()))
        where = "allergen declaration" if declared else "ingredients"
        listed = f" (listed as: {', '.join(terms)})" if terms else f" ({where})"
        return Item(key, SECTION_ALLERGY, label, "red", f"Contains {name.lower()}{listed}.",
                    "This allergen is listed in the product's ingredients or allergen declaration.",
                    "verified", ctx.product_source("ingredients & allergens"), hard=True, weight=3)
    in_photo = _contains_any(ctx.photo_ingredients, words, exclude) if ctx.photo_ingredients else []
    if in_photo:
        return Item(key, SECTION_ALLERGY, label, "red",
                    f"Label text read from your photo mentions {', '.join(in_photo)}.",
                    "This comes from an automated reading of your photo and was not verified against a product "
                    "record. Treating it as a conflict to be safe; check the package.",
                    "partial", ctx.photo_source(), hard=True, weight=3)
    traces = sorted(tags & set(ev.get("traces_tags", [])))
    if traces:
        cross = ctx.prefs.get("allergy_cross_contact", False)
        return Item(key, SECTION_ALLERGY, label, "red" if cross else "yellow",
                    f"May contain traces of {name.lower()} (cross-contact warning).",
                    "You asked to flag cross-contact." if cross else
                    "You did not ask to flag cross-contact, so this is shown as a caution.",
                    "verified", ctx.product_source("traces / may-contain statement"), hard=cross, weight=3)
    if ctx.ingredients:
        return Item(key, SECTION_ALLERGY, label, "green",
                    f"No {name.lower()} found in the listed ingredients or allergen declarations.",
                    "Based on the ingredient list on record. Records can be incomplete or out of date, so always "
                    "check the physical label for allergens.",
                    "partial", ctx.product_source("ingredients & allergens"), hard=True, weight=3)
    return Item(key, SECTION_ALLERGY, label, "gray", "No ingredient list available to check this allergen.",
                "We could not confirm whether this product is safe for your allergy.",
                no_source_note=NO_DATA_NOTE, hard=True, weight=3)


def _keyword_rule(ctx: Context, key: str, section: str, label: str, words: list[str], what: str,
                  exclude: list[str] | None = None, green_note: str = "") -> Item:
    """Generic 'must not contain X' rule on the ingredient list."""
    status_on_conflict, hard = ctx.conflict_status(key)
    weight = 3 if hard else 1
    found = _contains_any(ctx.ingredients, words, exclude) if ctx.ingredients else []
    if found:
        return Item(key, section, label, status_on_conflict, f"Ingredients include {', '.join(found)}.",
                    f"These ingredients conflict with {what}.", "verified",
                    ctx.product_source("ingredients"), hard=hard, weight=weight)
    photo_found = _contains_any(ctx.photo_ingredients, words, exclude) if ctx.photo_ingredients else []
    if photo_found:
        return Item(key, section, label, status_on_conflict,
                    f"Label text read from your photo mentions {', '.join(photo_found)}.",
                    "Unverified automated reading of your photo; check the package.", "partial",
                    ctx.photo_source(), hard=hard, weight=weight)
    if ctx.ingredients:
        note = green_note or "Based on the ingredient list on record; not a certification."
        if hard:
            note += f" You marked this as strict, so check the package: an ingredient list can't guarantee {what}."
        return Item(key, section, label, "green", "No conflicting ingredients listed.", note, "partial",
                    ctx.product_source("ingredients"), hard=hard, weight=weight)
    return Item(key, section, label, "gray", "No ingredient list available to check this.",
                no_source_note=NO_DATA_NOTE, hard=hard, weight=weight)


def _analysis_rule(ctx: Context, key: str, label: str, positive: str, negative: str, maybe: str,
                   words: list[str], what: str) -> Item:
    """Vegan/vegetarian via Open Food Facts ingredient analysis, falling back to keywords."""
    tags = set(ctx.ev.get("analysis_tags", []))
    status_on_conflict, hard = ctx.conflict_status(key)
    weight = 3 if hard else 1
    if negative in tags:
        return Item(key, SECTION_ALLERGY, label, status_on_conflict, f"Ingredient analysis flags this as not {what}.",
                    "Open Food Facts' ingredient analysis found animal-derived ingredients.", "verified",
                    ctx.product_source("ingredient analysis"), hard=hard, weight=weight)
    if positive in tags and not _contains_any(ctx.ingredients, words, NOT_DAIRY):
        return Item(key, SECTION_ALLERGY, label, "green", f"Ingredient analysis indicates {what}.",
                    "Based on Open Food Facts' analysis of the listed ingredients; not a certification.",
                    "partial", ctx.product_source("ingredient analysis"), hard=hard, weight=weight)
    if maybe in tags:
        return Item(key, SECTION_ALLERGY, label, "yellow", f"Some ingredients may or may not be {what}.",
                    "Ingredients such as flavourings or emulsifiers can be plant- or animal-derived.", "partial",
                    ctx.product_source("ingredient analysis"), hard=hard, weight=weight)
    return _keyword_rule(ctx, key, SECTION_ALLERGY, label, words, f"a {what} diet", NOT_DAIRY)


def _diet_pattern_item(ctx: Context, option_id: str) -> Item | None:
    key = f"dietary_patterns:{option_id}"
    label = f"{option_label('dietary_patterns', option_id)} diet"
    if option_id == "omnivore":
        return None  # no product-level constraint to check
    if option_id == "vegan":
        return _analysis_rule(ctx, key, label, "en:vegan", "en:non-vegan", "en:maybe-vegan", ANIMAL_WORDS, "vegan")
    if option_id == "vegetarian":
        return _analysis_rule(ctx, key, label, "en:vegetarian", "en:non-vegetarian", "en:maybe-vegetarian",
                              MEAT_WORDS, "vegetarian")
    if option_id == "pescatarian":
        return _keyword_rule(ctx, key, SECTION_ALLERGY, label, NON_FISH_MEAT, "a pescatarian diet")
    if option_id == "keto":
        carbs = _num(ctx.ev.get("nutriments", {}), "carbohydrates_100g")
        if carbs is None:
            return Item(key, SECTION_ALLERGY, label, "gray", "Carbohydrate content isn't reported.",
                        no_source_note=NO_DATA_NOTE)
        status = "green" if carbs <= 5 else "yellow" if carbs <= 15 else "red"
        return Item(key, SECTION_ALLERGY, label, status, f"{carbs:g} g carbohydrate per 100 g.",
                    "root'd uses a simple heuristic (≤5 g/100 g fits well, >15 g/100 g is hard to fit). Keto "
                    "suitability really depends on your daily total.", "estimated",
                    ctx.product_source("nutrition facts"),
                    no_source_note="The thresholds are a root'd heuristic, not an official standard.")
    if option_id == "mediterranean":
        return Item(key, SECTION_ALLERGY, label, "gray", "A whole-diet pattern can't be judged from one product.",
                    no_source_note="No single-product standard exists for this pattern.")
    return Item(key, SECTION_ALLERGY, label, "gray", "Custom preference; root'd can't evaluate this automatically yet.",
                no_source_note="Custom entries aren't matched against product data yet.")


def _restriction_item(ctx: Context, option_id: str) -> Item:
    key = f"dietary_restrictions:{option_id}"
    label = option_label("dietary_restrictions", option_id)
    simple = {
        "dairy_free": (ALLERGENS["milk"][1], NOT_DAIRY, "a dairy-free diet"),
        "egg_free": (ALLERGENS["eggs"][1], None, "an egg-free diet"),
        "nut_free": (ALLERGENS["tree_nuts"][1] + ALLERGENS["peanuts"][1], None, "a nut-free diet"),
        "soy_free": (ALLERGENS["soy"][1], None, "a soy-free diet"),
        "pork_free": (PORK_WORDS, None, "a pork-free diet"),
        "alcohol_free": (ALCOHOL_WORDS, None, "an alcohol-free diet"),
    }
    if option_id == "gluten_free":
        certified = _labels_have(ctx.ev, ("gluten-free", "no-gluten"))
        conflict, hard = ctx.conflict_status(key)
        if certified:
            return Item(key, SECTION_ALLERGY, label, "green", "Labelled gluten-free.",
                        f"Label on record: {', '.join(_pretty_tag(t) for t in certified)}.", "verified",
                        ctx.product_source("labels"), hard=hard, weight=3 if hard else 1)
        if "en:gluten" in ctx.ev.get("allergens_tags", []):
            return Item(key, SECTION_ALLERGY, label, conflict, "Contains gluten (allergen declaration).",
                        evidence_level="verified", evidence_sources=ctx.product_source("allergens"),
                        hard=hard, weight=3 if hard else 1)
        return _keyword_rule(ctx, key, SECTION_ALLERGY, label, GLUTEN_WORDS, "a gluten-free diet",
                             green_note="No gluten-containing ingredients listed, but not labelled gluten-free.")
    if option_id in simple:
        words, exclude, what = simple[option_id]
        if option_id == "pork_free" and not _contains_any(ctx.ingredients, words) and \
                _contains_any(ctx.ingredients, ["gelatin", "gelatine"]):
            return Item(key, SECTION_ALLERGY, label, "yellow", "Contains gelatin from an unstated source.",
                        "Gelatin is often pork-derived; the label doesn't say which source was used.", "partial",
                        ctx.product_source("ingredients"), hard=key in ctx.hard_ids)
        return _keyword_rule(ctx, key, SECTION_ALLERGY, label, words, what, exclude)
    return Item(key, SECTION_ALLERGY, label, "gray", "Custom restriction; root'd can't evaluate this automatically yet.",
                no_source_note="Custom entries aren't matched against product data yet.", hard=key in ctx.hard_ids)


def _religious_item(ctx: Context, option_id: str) -> Item | None:
    key = f"religious_dietary_requirements:{option_id}"
    label = f"{option_label('religious_dietary_requirements', option_id)} requirement"
    conflict, hard = ctx.conflict_status(key)
    weight = 3 if hard else 1
    if option_id == "prefer_not_to_say":
        return None
    if option_id in ("halal", "kosher"):
        certified = _labels_have(ctx.ev, (option_id,))
        if certified:
            return Item(key, SECTION_ALLERGY, label, "green", f"{option_id.capitalize()} certification on record.",
                        f"Label on record: {', '.join(_pretty_tag(t) for t in certified)}.", "verified",
                        ctx.product_source("labels"), hard=hard, weight=weight)
        avoid = PORK_WORDS + (ALCOHOL_WORDS if option_id == "halal" else ALLERGENS["shellfish"][1])
        found = _contains_any(ctx.ingredients or ctx.photo_ingredients, avoid)
        if found:
            source = ctx.product_source("ingredients") if ctx.ingredients else ctx.photo_source()
            return Item(key, SECTION_ALLERGY, label, conflict, f"Ingredients include {', '.join(found)}.",
                        evidence_level="verified" if ctx.ingredients else "partial", evidence_sources=source,
                        hard=hard, weight=weight)
        return Item(key, SECTION_ALLERGY, label, "gray", f"{option_id.capitalize()} status not verified.",
                    "No certification was found on record. root'd does not assume a product meets this requirement "
                    "without certification evidence.", "unknown", ctx.product_source("labels"),
                    no_source_note=None if ctx.has_record else NO_DATA_NOTE, hard=hard, weight=weight)
    if option_id == "hindu_vegetarian":
        item = _keyword_rule(ctx, key, SECTION_ALLERGY, label, MEAT_WORDS + ALLERGENS["eggs"][1],
                             "a lacto-vegetarian requirement")
        item.detail = (item.detail + " root'd treats this as lacto-vegetarian (no meat, fish or eggs); practices vary.").strip()
        return item
    if option_id == "jain":
        found = _contains_any(ctx.ingredients, MEAT_WORDS + ALLERGENS["eggs"][1] + JAIN_AVOID)
        if found:
            return Item(key, SECTION_ALLERGY, label, conflict, f"Ingredients include {', '.join(found)}.",
                        "Jain dietary practice typically avoids animal products, root vegetables and honey.",
                        "verified", ctx.product_source("ingredients"), hard=hard, weight=weight)
        return Item(key, SECTION_ALLERGY, label, "gray", "Not verified for Jain requirements.",
                    "Jain suitability depends on details (e.g. additive sources) that labels rarely show.",
                    "unknown", ctx.product_source("ingredients"),
                    no_source_note=None if ctx.has_record else NO_DATA_NOTE, hard=hard, weight=weight)
    return Item(key, SECTION_ALLERGY, label, "gray", "Custom requirement; root'd can't evaluate this automatically yet.",
                no_source_note="Custom entries aren't matched against product data yet.", hard=hard, weight=weight)


# ---- nutrition --------------------------------------------------------------

def _num(nutriments: dict, key: str) -> float | None:
    value = nutriments.get(key)
    try:
        return round(float(value), 2) if value is not None and value != "" else None
    except (TypeError, ValueError):
        return None


def _is_drink(ev: dict) -> bool:
    if any("beverage" in c or "drinks" in c for c in ev.get("categories_tags", [])):
        return True
    return bool(re.search(r"\d\s*(ml|cl|l|fl\.? ?oz)\b", (ev.get("package_size") or "").lower()))


def _nutrition_item(ctx: Context, option_id: str) -> Item:
    key = f"nutrition_goals:{option_id}"
    label = option_label("nutrition_goals", option_id)
    n = ctx.ev.get("nutriments", {})
    unit = "100 ml" if _is_drink(ctx.ev) else "100 g"

    def missing(what: str) -> Item:
        return Item(key, SECTION_NUTRITION, label, "gray", f"{what} isn't reported for this product.",
                    no_source_note=NO_DATA_NOTE if not ctx.has_record else
                    "The product record has no value for this nutrient.")

    if option_id == "lower_added_sugar":
        added = _num(n, "added-sugars_100g")
        value = added if added is not None else _num(n, "sugars_100g")
        if value is None:
            return missing("Sugar content")
        low, high = (2.5, 11.25) if unit == "100 ml" else (5.0, 22.5)
        status = "green" if value <= low else "yellow" if value <= high else "red"
        kind = "added sugars" if added is not None else "total sugars (added sugar isn't reported separately)"
        band = {"green": "low", "yellow": "medium", "red": "high"}[status]
        return Item(key, SECTION_NUTRITION, label, status, f"{value:g} g {kind.split(' (')[0]} per {unit} ({band}).",
                    f"Measured as {kind}. UK traffic-light bands per {unit}: low ≤{low:g} g, high >{high:g} g.",
                    "verified", ctx.with_ref(FSA_SOURCE, "nutrition facts"))
    if option_id == "lower_sodium":
        salt = _num(n, "salt_100g")
        if salt is None and _num(n, "sodium_100g") is not None:
            salt = round(_num(n, "sodium_100g") * 2.5, 2)  # type: ignore[operator]
        if salt is None:
            return missing("Salt/sodium")
        high = 0.75 if unit == "100 ml" else 1.5
        status = "green" if salt <= 0.3 else "yellow" if salt <= high else "red"
        band = {"green": "low", "yellow": "medium", "red": "high"}[status]
        return Item(key, SECTION_NUTRITION, label, status, f"{salt:g} g salt per {unit} ({band}).",
                    f"UK traffic-light bands per {unit}: low ≤0.3 g salt, high >{high:g} g.", "verified",
                    ctx.with_ref(FSA_SOURCE, "nutrition facts"))
    if option_id == "high_protein":
        protein, kcal = _num(n, "proteins_100g"), _num(n, "energy-kcal_100g")
        if protein is None or not kcal:
            return missing("Protein or energy")
        share = round(protein * 4 / kcal * 100)
        status = "green" if share >= 20 else "yellow" if share >= 12 else "red"
        return Item(key, SECTION_NUTRITION, label, status,
                    f"{share}% of calories from protein ({protein:g} g per {unit}).",
                    "EU nutrition-claim rules: 'source of protein' ≥12% of energy, 'high protein' ≥20%.",
                    "verified", ctx.with_ref(EU_CLAIMS_SOURCE, "nutrition facts"))
    if option_id == "high_fiber":
        fiber = _num(n, "fiber_100g")
        if fiber is None:
            return missing("Fiber content")
        status = "green" if fiber >= 6 else "yellow" if fiber >= 3 else "red"
        return Item(key, SECTION_NUTRITION, label, status, f"{fiber:g} g fiber per {unit}.",
                    "EU nutrition-claim rules: 'source of fibre' ≥3 g/100 g, 'high fibre' ≥6 g/100 g.",
                    "verified", ctx.with_ref(EU_CLAIMS_SOURCE, "nutrition facts"))
    if option_id == "balanced_nutrition":
        grade = ctx.ev.get("nutriscore_grade")
        if not grade:
            return missing("A Nutri-Score")
        status = "green" if grade in "ab" else "yellow" if grade == "c" else "red"
        return Item(key, SECTION_NUTRITION, label, status, f"Nutri-Score {grade.upper()}.",
                    "Nutri-Score grades overall nutritional quality from A (best) to E.", "verified",
                    ctx.product_source("Nutri-Score"))
    if option_id == "minimally_processed":
        return _nova_item(ctx, key, SECTION_NUTRITION, label)
    return Item(key, SECTION_NUTRITION, label, "gray", "Custom goal; root'd can't evaluate this automatically yet.",
                no_source_note="Custom entries aren't matched against product data yet.")


def _nova_item(ctx: Context, key: str, section: str, label: str, weight: int = 1) -> Item:
    nova = ctx.ev.get("nova_group")
    if not nova:
        return Item(key, section, label, "gray", "Processing level (NOVA group) isn't available.",
                    no_source_note=NO_DATA_NOTE if not ctx.has_record else "The record has no NOVA group.",
                    weight=weight)
    status = "green" if nova <= 2 else "yellow" if nova == 3 else "red"
    names = {1: "unprocessed or minimally processed", 2: "processed culinary ingredient", 3: "processed food",
             4: "ultra-processed food"}
    return Item(key, section, label, status, f"NOVA group {nova}: {names[nova]}.",
                "NOVA classifies foods by degree of processing, from 1 (minimal) to 4 (ultra-processed).",
                "verified", ctx.product_source("NOVA classification"), weight=weight)


# ---- ethical & environmental --------------------------------------------------

def _label_item(ctx: Context, key: str, section: str, label: str, markers: tuple[str, ...], found_text: str,
                weight: int) -> Item:
    found = _labels_have(ctx.ev, markers)
    if found:
        return Item(key, section, label, "green", f"{found_text}: {', '.join(_pretty_tag(t) for t in found)}.",
                    "Certification/label as recorded for this product.", "verified",
                    ctx.product_source("labels & certifications"), weight=weight)
    return Item(key, section, label, "gray", "No supporting certification or label on record.",
                "Absence of a label isn't evidence against the product; it just can't be verified.", "unknown",
                ctx.product_source("labels & certifications"),
                no_source_note=None if ctx.has_record else NO_DATA_NOTE, weight=weight)


def _ethical_item(ctx: Context, option_id: str) -> Item:
    key = f"ethical_values:{option_id}"
    label = option_label("ethical_values", option_id)
    weight = 2 if ctx.levels.get(key) == "must_have" else 1
    if option_id in ("fair_trade", "fair_labor"):
        return _label_item(ctx, key, SECTION_ETHICAL, label, FAIR_TRADE_MARKERS, "Fair-trade label", weight)
    if option_id == "organic":
        return _label_item(ctx, key, SECTION_ETHICAL, label, ORGANIC_LABELS + ("organic",), "Organic label", weight)
    if option_id in ("animal_welfare", "cruelty_free"):
        markers = WELFARE_MARKERS if option_id == "animal_welfare" else CRUELTY_FREE_MARKERS
        item = _label_item(ctx, key, SECTION_ETHICAL, label, markers, "Label", weight)
        if item.status == "gray" and "en:vegan" in ctx.ev.get("analysis_tags", []):
            return Item(key, SECTION_ETHICAL, label, "green", "No animal-derived ingredients identified.",
                        "Based on ingredient analysis rather than a welfare certification.", "partial",
                        ctx.product_source("ingredient analysis"), weight=weight)
        return item
    if option_id == "responsible_farming":
        return _label_item(ctx, key, SECTION_ETHICAL, label, SUSTAINABLE_MARKERS + REGENERATIVE_MARKERS,
                           "Farming/sourcing label", weight)
    if option_id == "locally_sourced":
        origin = ctx.ev.get("origins")
        return Item(key, SECTION_ETHICAL, label, "gray",
                    f"Origin on record: {origin}." if origin else "No origin information on record.",
                    "root'd doesn't know where you shop, so it can't judge whether this is local to you.", "unknown",
                    ctx.product_source("origins") if origin else [],
                    no_source_note=None if origin else NO_DATA_NOTE, weight=weight)
    if option_id == "ingredient_transparency":
        if ctx.ingredients:
            return Item(key, SECTION_ETHICAL, label, "green", "A full ingredient list is on record.",
                        evidence_level="partial", evidence_sources=ctx.product_source("ingredients"), weight=weight)
        return Item(key, SECTION_ETHICAL, label, "gray", "No ingredient list on record.",
                    no_source_note=NO_DATA_NOTE, weight=weight)
    if option_id == "minimal_processing":
        return _nova_item(ctx, key, SECTION_ETHICAL, label, weight)
    return Item(key, SECTION_ETHICAL, label, "gray", "Custom value; root'd can't evaluate this automatically yet.",
                no_source_note="Custom entries aren't matched against product data yet.", weight=weight)


PLASTIC_MARKERS = ("plastic", "pet", "hdpe", "ldpe", "polypropylene", "polyethylene", "pp-", "ps-", "pvc")


def _environment_item(ctx: Context, option_id: str) -> Item:
    key = f"environmental_priorities:{option_id}"
    label = option_label("environmental_priorities", option_id)
    weight = 2 if ctx.levels.get(key) == "must_have" else 1
    packagings = [p for p in ctx.ev.get("packagings", []) if isinstance(p, dict)]
    materials = [str(p.get("material", "")) for p in packagings if p.get("material")]

    if option_id == "lower_carbon":
        grade = ctx.ev.get("environmental_grade")
        if not grade:
            return Item(key, SECTION_ENVIRONMENT, label, "gray", "No environmental impact estimate available.",
                        no_source_note=NO_DATA_NOTE if not ctx.has_record else
                        "The record has no Green-Score (formerly Eco-Score).", weight=weight)
        status = "green" if grade in ("a-plus", "a", "b") else "yellow" if grade == "c" else "red"
        return Item(key, SECTION_ENVIRONMENT, label, status, f"Green-Score {grade.upper()} (estimate).",
                    "Open Food Facts' Green-Score (formerly Eco-Score) estimates lifecycle impact, mostly from the "
                    "product category; it is not a measurement of this specific product.", "estimated",
                    ctx.product_source("Green-Score"), weight=weight)
    if option_id == "less_plastic":
        if not materials:
            return Item(key, SECTION_ENVIRONMENT, label, "gray", "Packaging materials aren't recorded.",
                        no_source_note=NO_DATA_NOTE if not ctx.has_record else "No packaging data on record.",
                        weight=weight)
        plastic = [m for m in materials if any(x in m.lower() for x in PLASTIC_MARKERS)]
        return Item(key, SECTION_ENVIRONMENT, label, "yellow" if plastic else "green",
                    "Packaging includes plastic." if plastic else "No plastic packaging recorded.",
                    f"Recorded materials: {', '.join(_pretty_tag(m) for m in materials)}.", "partial",
                    ctx.product_source("packaging"), weight=weight)
    if option_id == "recyclable_packaging":
        recycling = [str(p.get("recycling", "")) for p in packagings if p.get("recycling")]
        if not recycling:
            return Item(key, SECTION_ENVIRONMENT, label, "gray", "Recycling instructions aren't recorded.",
                        no_source_note=NO_DATA_NOTE if not ctx.has_record else "No packaging data on record.",
                        weight=weight)
        ok = all("recycle" in r for r in recycling)
        return Item(key, SECTION_ENVIRONMENT, label, "green" if ok else "yellow",
                    "All recorded packaging parts are marked recyclable." if ok else
                    "Some packaging parts are not marked recyclable.",
                    "Recyclability also depends on your local collection rules.", "partial",
                    ctx.product_source("packaging"), weight=weight)
    if option_id == "minimal_packaging":
        if not packagings:
            return Item(key, SECTION_ENVIRONMENT, label, "gray", "Packaging components aren't recorded.",
                        no_source_note=NO_DATA_NOTE if not ctx.has_record else "No packaging data on record.",
                        weight=weight)
        count = len(packagings)
        return Item(key, SECTION_ENVIRONMENT, label, "green" if count <= 2 else "yellow",
                    f"{count} packaging component{'s' if count != 1 else ''} recorded.",
                    "root'd treats 1–2 components as minimal; this is a simple heuristic.", "estimated",
                    ctx.product_source("packaging"), weight=weight)
    if option_id == "reduced_deforestation":
        tags = set(ctx.ev.get("analysis_tags", []))
        beef = _contains_any(ctx.ingredients, ["beef"])
        if beef:
            return Item(key, SECTION_ENVIRONMENT, label, "yellow", "Contains beef.",
                        "Expanding cattle pasture was responsible for 41% of tropical deforestation (Our World in "
                        "Data, 2021).", "partial", ctx.with_ref(OWID_DEFORESTATION_SOURCE, "ingredients"),
                        weight=weight)
        if "en:palm-oil" in tags:
            certified = _labels_have(ctx.ev, ("rspo", "sustainable-palm-oil"))
            if certified:
                return Item(key, SECTION_ENVIRONMENT, label, "green", "Contains certified sustainable palm oil.",
                            f"Label on record: {', '.join(_pretty_tag(t) for t in certified)}.", "partial",
                            ctx.product_source("labels"), weight=weight)
            return Item(key, SECTION_ENVIRONMENT, label, "yellow", "Contains palm oil without a sustainability label.",
                        "Oilseeds (including palm oil) drove about 18% of tropical deforestation (Our World in Data, "
                        "2021). Sourcing for this product isn't documented.", "partial",
                        ctx.with_ref(OWID_DEFORESTATION_SOURCE, "ingredient analysis"), weight=weight)
        if "en:palm-oil-free" in tags:
            return Item(key, SECTION_ENVIRONMENT, label, "green", "No palm oil or beef identified.",
                        "Based on ingredient analysis; other sourcing risks aren't measured.", "partial",
                        ctx.product_source("ingredient analysis"), weight=weight)
        return Item(key, SECTION_ENVIRONMENT, label, "gray", "No sourcing data to assess deforestation risk.",
                    no_source_note=NO_DATA_NOTE if not ctx.has_record else
                    "The record doesn't describe ingredient sourcing.", weight=weight)
    if option_id == "sustainable_sourcing":
        return _label_item(ctx, key, SECTION_ENVIRONMENT, label, SUSTAINABLE_MARKERS, "Sourcing label", weight)
    if option_id == "biodiversity":
        return _label_item(ctx, key, SECTION_ENVIRONMENT, label, ORGANIC_LABELS + ("organic", "rainforest-alliance"),
                           "Label", weight)
    if option_id == "regenerative":
        return _label_item(ctx, key, SECTION_ENVIRONMENT, label, REGENERATIVE_MARKERS, "Regenerative label", weight)
    if option_id in ("lower_water", "reduced_food_waste"):
        return Item(key, SECTION_ENVIRONMENT, label, "gray", "No product-level data available for this.",
                    no_source_note="root'd doesn't have a product-specific dataset for this yet.", weight=weight)
    return Item(key, SECTION_ENVIRONMENT, label, "gray", "Custom priority; root'd can't evaluate this automatically yet.",
                no_source_note="Custom entries aren't matched against product data yet.", weight=weight)


def _recall_item(recall: dict) -> Item:
    status = recall.get("verdict", "gray")
    reason = recall.get("message", "")
    return Item("food_safety:recall", SECTION_SAFETY, "Recall check", status, reason, recall.get("coverage_note", ""),
                "verified" if status in ("red", "green") else "partial" if status == "yellow" else "unknown",
                recall.get("sources", []),
                no_source_note=None if recall.get("sources") else "No recall database response was available.",
                hard=status == "red", weight=3)


# ---- overall ---------------------------------------------------------------

def build_breakdown(ev: dict, prefs: dict, recall: dict) -> list[Item]:
    ctx = Context(ev, prefs)
    items: list[Item | None] = [_recall_item(recall)]
    items += [_allergen_item(ctx, a) for a in prefs.get("allergens", [])]
    items += [_diet_pattern_item(ctx, d) for d in prefs.get("dietary_patterns", [])]
    items += [_restriction_item(ctx, r) for r in prefs.get("dietary_restrictions", [])]
    items += [_religious_item(ctx, r) for r in prefs.get("religious_dietary_requirements", [])]
    items += [_nutrition_item(ctx, g) for g in prefs.get("nutrition_goals", [])]
    items += [_ethical_item(ctx, e) for e in prefs.get("ethical_values", [])]
    items += [_environment_item(ctx, e) for e in prefs.get("environmental_priorities", [])]
    return [i for i in items if i is not None]


LABELS = {"red": "Strong Conflict", "yellow": "Mixed Fit", "green": "Good Match", "unknown": "Insufficient Data"}


def overall(items: list[Item], has_product_data: bool) -> dict:
    recall = next((i for i in items if i.id == "food_safety:recall"), None)
    prefs = [i for i in items if i.id != "food_safety:recall"]
    hard_red = [i for i in prefs if i.hard and i.status == "red"]
    hard_gray = [i for i in prefs if i.hard and i.status == "gray"]
    soft_issues = [i for i in prefs if i.status in ("red", "yellow") and not (i.hard and i.status == "red")]
    greens = [i for i in prefs if i.status == "green"]
    grays = [i for i in prefs if i.status == "gray"]

    if recall and recall.status == "red":
        status = "red"
    elif not prefs:
        status = "unknown"  # nothing personal to compare against
    elif hard_red:
        status = "red"
    elif hard_gray or not has_product_data:
        status = "unknown"
    elif soft_issues or (recall and recall.status == "yellow"):
        status = "yellow"
    elif greens:
        status = "green"
    else:
        status = "unknown"

    evaluated = [i for i in prefs if i.status != "gray"]
    score = None
    if evaluated:
        total = sum(i.weight for i in evaluated)
        points = sum(i.weight * {"green": 1.0, "yellow": 0.5, "red": 0.0}[i.status] for i in evaluated)
        score = round(100 * points / total)

    points_list: list[str] = []
    if recall and recall.status in ("red", "yellow"):
        points_list.append(f"Safety: {recall.short_reason}")
    for i in hard_red[:2]:
        points_list.append(f"Conflict: {i.label}: {i.short_reason}")
    for i in hard_gray[:1]:
        points_list.append(f"Unverified: {i.label}: {i.short_reason}")
    for i in sorted(soft_issues, key=lambda x: (x.status != "red", -x.weight))[:2]:
        points_list.append(f"Tradeoff: {i.label}: {i.short_reason}")
    if len(points_list) < 3:
        for i in greens[: 3 - len(points_list)]:
            points_list.append(f"Aligned: {i.label}: {i.short_reason}")
    if grays and len(points_list) < 4:
        points_list.append(f"Unknown: {len(grays)} of your preferences couldn't be checked with available data.")
    if not has_product_data and not points_list:
        points_list.append("Unknown: No product record was found, so most preferences couldn't be checked.")

    summary = {
        "red": "This product conflicts with a hard restriction or safety check in your profile.",
        "yellow": "Partly aligned with your values, with some tradeoffs to consider.",
        "green": "Aligns well with the preferences we could check.",
        "unknown": "There isn't enough verified data to rate this product for your critical preferences.",
    }[status]
    if recall and recall.status == "red":
        summary = "An ongoing FDA recall lists this product. Do not eat it; check the recall notice."
    elif not prefs:
        summary = "You haven't saved any food preferences yet, so root'd can't personalize this result."
        points_list.append("Unknown: Add preferences in your profile to get a personalized rating.")

    return {
        "status": status,
        "label": LABELS[status],
        "alignment_score": score,
        "score_label": "Preference-fit estimate (not a safety score)",
        "summary_short": summary,
        "summary_points": points_list[:4],
        "counts": {s: sum(1 for i in prefs if i.status == s) for s in ("green", "yellow", "red", "gray")},
    }


def evaluate(ev: dict, prefs: dict, recall: dict) -> dict:
    items = build_breakdown(ev, prefs, recall)
    has_data = ev.get("source") in ("open_food_facts", "demo_fixture") or bool(ev.get("ingredients_from_photo"))
    result = overall(items, has_data)
    breakdown = [i.to_dict() for i in items]

    seen, sources = set(), []
    for item in breakdown:
        for src in item["evidence_sources"]:
            k = (src.get("title"), src.get("url"))
            if k not in seen:
                seen.add(k)
                sources.append(src)
    gaps = [f"{i['label']}: {i['short_reason']}" for i in breakdown if i["status"] == "gray"]
    if ev.get("source") not in ("open_food_facts", "demo_fixture"):
        gaps.insert(0, "No Open Food Facts record was found for this product.")
    return {"overall_result": result, "preference_breakdown": breakdown, "sources": sources, "data_gaps": gaps}
