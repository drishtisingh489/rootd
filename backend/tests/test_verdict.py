from app.catalog import normalize_preferences
from app.demo_fixtures import DEMO_RECALL, get_fixture
from app.verdict import evaluate

NO_RECALL = {"status": "no_match_found", "verdict": "green", "message": "No matching recall.", "sources": [],
             "coverage_note": ""}


def prefs(**groups):
    return normalize_preferences(groups)


def item(result, item_id):
    return next(i for i in result["preference_breakdown"] if i["id"] == item_id)


def test_declared_allergen_is_red_and_hard():
    r = evaluate(get_fixture("demo-hazelnut-spread"), prefs(allergens=["tree_nuts"]), NO_RECALL)
    assert item(r, "allergens:tree_nuts")["status"] == "red"
    assert r["overall_result"]["status"] == "red"


def test_cocoa_butter_is_not_dairy():
    ev = {**get_fixture("demo-lentil-soup"), "ingredients_text": "Sugar, cocoa butter, cocoa mass."}
    r = evaluate(ev, prefs(allergens=["milk"]), NO_RECALL)
    assert item(r, "allergens:milk")["status"] == "green"


def test_traces_respect_cross_contact_choice():
    ev = get_fixture("demo-oat-honey-bar")
    soft = evaluate(ev, prefs(allergens=["peanuts"]), NO_RECALL)
    assert item(soft, "allergens:peanuts")["status"] == "yellow"
    strict = evaluate(ev, prefs(allergens=["peanuts"], allergy_cross_contact=True), NO_RECALL)
    assert item(strict, "allergens:peanuts")["status"] == "red"
    assert strict["overall_result"]["status"] == "red"


def test_missing_ingredients_for_allergy_is_insufficient_data():
    ev = {"source": "none", "name": "Mystery", "brand": "X"}
    r = evaluate(ev, prefs(allergens=["sesame"]), NO_RECALL)
    assert item(r, "allergens:sesame")["status"] == "gray"
    assert r["overall_result"]["status"] == "unknown"
    assert r["overall_result"]["label"] == "Insufficient Data"


def test_soft_sugar_conflict_is_yellow_not_red():
    r = evaluate(get_fixture("demo-oat-honey-bar"), prefs(nutrition_goals=["lower_added_sugar"]), NO_RECALL)
    assert item(r, "nutrition_goals:lower_added_sugar")["status"] == "red"  # high band (>22.5 g)
    assert r["overall_result"]["status"] == "yellow"
    assert any(s["url"] and "FoP_Nutrition" in s["url"]
               for s in item(r, "nutrition_goals:lower_added_sugar")["evidence_sources"])


def test_strict_vs_preference_diet_conflict():
    ev = get_fixture("demo-oat-honey-bar")  # contains honey -> non-vegan
    pref = evaluate(ev, prefs(dietary_patterns=["vegan"]), NO_RECALL)
    assert item(pref, "dietary_patterns:vegan")["status"] == "yellow"
    strict = evaluate(ev, normalize_preferences({"dietary_patterns": ["vegan"],
                                                 "levels": {"dietary_patterns:vegan": "strict"}}), NO_RECALL)
    assert item(strict, "dietary_patterns:vegan")["status"] == "red"
    assert strict["overall_result"]["status"] == "red"


def test_halal_without_certification_is_unverified():
    r = evaluate(get_fixture("demo-lentil-soup"), prefs(religious_dietary_requirements=["halal"]), NO_RECALL)
    assert item(r, "religious_dietary_requirements:halal")["status"] == "gray"


def test_good_match():
    r = evaluate(get_fixture("demo-lentil-soup"),
                 prefs(dietary_patterns=["vegan"], ethical_values=["organic"], nutrition_goals=["lower_added_sugar"]),
                 NO_RECALL)
    assert r["overall_result"]["status"] == "green"
    assert r["overall_result"]["alignment_score"] == 100


def test_verified_recall_overrides_everything():
    recall = {"status": "verified_match", "verdict": "red", "message": "Ongoing recall lists this barcode.",
              "sources": [{"title": "FDA", "url": "https://api.fda.gov/x", "publisher": "FDA"}], "coverage_note": ""}
    r = evaluate(get_fixture("demo-lentil-soup"), prefs(ethical_values=["organic"]), recall)
    assert r["overall_result"]["status"] == "red"
    assert "recall" in r["overall_result"]["summary_short"].lower()


def test_every_item_has_source_or_explanation():
    r = evaluate(get_fixture("demo-oat-honey-bar"), prefs(
        allergens=["milk", "other:mustard"], environmental_priorities=["lower_water", "reduced_deforestation"],
        ethical_values=["locally_sourced"]), DEMO_RECALL)
    for i in r["preference_breakdown"]:
        assert i["evidence_sources"] or i["no_source_note"], i["id"]


def test_normalize_drops_unknown_options():
    p = normalize_preferences({"allergens": ["peanuts", "bogus", "other:Mustard"], "evil": ["x"],
                               "levels": {"allergens:peanuts": "strict", "nope:x": "strict"}})
    assert p["allergens"] == ["peanuts", "other:Mustard"]
    assert "evil" not in p
    assert p["levels"] == {"allergens:peanuts": "strict"}


def test_no_saved_preferences_is_unknown_with_clear_reason():
    r = evaluate(get_fixture("demo-lentil-soup"), prefs(), NO_RECALL)
    assert r["overall_result"]["status"] == "unknown"
    assert "haven't saved any food preferences" in r["overall_result"]["summary_short"]
    assert [i["id"] for i in r["preference_breakdown"]] == ["food_safety:recall"]
