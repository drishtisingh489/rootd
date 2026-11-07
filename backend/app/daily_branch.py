"""Curated, source-verified Daily Branch items.

Every item's wording was checked against its source on 2026-11-07. Add new items only with a working source URL
and wording that matches the source; never paraphrase a number into something the source doesn't say.
"""

from datetime import date

VERIFIED_AT = "2026-11-07"

ITEMS = [
    {
        "id": "food-ghg-quarter",
        "headline": "Food is about a quarter of global emissions",
        "summary": "Food production is responsible for approximately 26% of global greenhouse gas emissions. "
                   "Livestock and fisheries make up 31% of food's emissions, crop production 27%, land use 24% "
                   "and supply chains 18%.",
        "source_title": "Food production is responsible for one-quarter of the world's greenhouse gas emissions",
        "publisher": "Our World in Data (Hannah Ritchie)",
        "source_url": "https://ourworldindata.org/food-ghg-emissions",
        "published_at": "2019-11-06",
        "topic_tags": ["carbon", "climate"],
    },
    {
        "id": "agri-freshwater-70",
        "headline": "Farming uses most of the world's freshwater",
        "summary": "70% of global freshwater withdrawals are used for agriculture.",
        "source_title": "Environmental Impacts of Food Production",
        "publisher": "Our World in Data (Ritchie, Rosado & Roser)",
        "source_url": "https://ourworldindata.org/environmental-impacts-of-food",
        "published_at": "2022-12-02",
        "topic_tags": ["water"],
    },
    {
        "id": "agri-eutrophication-78",
        "headline": "Where water pollution from food comes from",
        "summary": "78% of global ocean and freshwater eutrophication (nutrient pollution that can choke "
                   "waterways) is caused by agriculture.",
        "source_title": "Environmental Impacts of Food Production",
        "publisher": "Our World in Data (Ritchie, Rosado & Roser)",
        "source_url": "https://ourworldindata.org/environmental-impacts-of-food",
        "published_at": "2022-12-02",
        "topic_tags": ["water", "biodiversity"],
    },
    {
        "id": "agri-land-half",
        "headline": "Half of habitable land grows our food",
        "summary": "Around half of the world's habitable land is used for agriculture.",
        "source_title": "Environmental Impacts of Food Production",
        "publisher": "Our World in Data (Ritchie, Rosado & Roser)",
        "source_url": "https://ourworldindata.org/environmental-impacts-of-food",
        "published_at": "2022-12-02",
        "topic_tags": ["biodiversity", "land"],
    },
    {
        "id": "beef-deforestation-41",
        "headline": "Cattle pasture and tropical forests",
        "summary": "The expansion of pasture land to raise cattle was responsible for 41% of tropical "
                   "deforestation. Combined, beef and oilseeds (such as soy and palm oil) account for nearly "
                   "60%.",
        "source_title": "Cutting down forests: what are the drivers of deforestation?",
        "publisher": "Our World in Data (Hannah Ritchie)",
        "source_url": "https://ourworldindata.org/drivers-of-deforestation",
        "published_at": "2021-02-01",
        "topic_tags": ["deforestation", "beef"],
    },
    {
        "id": "oilseeds-deforestation-18",
        "headline": "Oilseeds' share of tropical deforestation",
        "summary": "Oilseeds such as soy and palm oil drove 18% of tropical deforestation, with Indonesian palm "
                   "oil the biggest component.",
        "source_title": "Cutting down forests: what are the drivers of deforestation?",
        "publisher": "Our World in Data (Hannah Ritchie)",
        "source_url": "https://ourworldindata.org/drivers-of-deforestation",
        "published_at": "2021-02-01",
        "topic_tags": ["deforestation", "palm-oil"],
    },
    {
        "id": "food-waste-19",
        "headline": "A fifth of food goes to waste",
        "summary": "The world wasted an estimated 19% of food in 2022, about 1.05 billion metric tons, according "
                   "to the UN's Food Waste Index Report 2024. Most of that waste, 60%, came from households.",
        "source_title": "Around 19 percent of food is wasted globally as 783 million people face chronic hunger, UN says",
        "publisher": "PBS NewsHour (Associated Press)",
        "source_url": "https://www.pbs.org/newshour/world/around-19-percent-of-food-is-wasted-globally-as-783-million-people-face-chronic-hunger-un-says",
        "published_at": "2024-03-27",
        "topic_tags": ["food-waste"],
    },
    {
        "id": "child-labour-agriculture-70",
        "headline": "Who grows our food matters",
        "summary": "The agriculture sector accounts for 70% of children in child labour, about 112 million "
                   "children, according to 2020 global estimates from the ILO and UNICEF.",
        "source_title": "Child labour rises to 160 million – first increase in two decades",
        "publisher": "International Labour Organization",
        "source_url": "https://www.ilo.org/resource/news/child-labour-rises-160-million-first-increase-two-decades",
        "published_at": "2021-06-10",
        "topic_tags": ["fair-labor", "fair-trade"],
    },
    {
        "id": "packaging-msw-28",
        "headline": "Packaging and US household waste",
        "summary": "Containers and packaging made up 28.1% of US municipal solid waste generated in 2018 (82.2 "
                   "million tons). That year, 53.9% of packaging and containers were recycled.",
        "source_title": "Containers and Packaging: Product-Specific Data",
        "publisher": "U.S. Environmental Protection Agency",
        "source_url": "https://www.epa.gov/facts-and-figures-about-materials-waste-and-recycling/containers-and-packaging-product-specific-data",
        "published_at": "2018",
        "topic_tags": ["packaging", "plastic", "recycling"],
    },
]

# Preference ids -> topic tags, used to prefer items related to what the user cares about or scanned.
PREFERENCE_TOPICS = {
    "lower_carbon": "carbon", "lower_water": "water", "biodiversity": "biodiversity",
    "reduced_deforestation": "deforestation", "minimal_packaging": "packaging", "less_plastic": "plastic",
    "recyclable_packaging": "recycling", "reduced_food_waste": "food-waste", "fair_trade": "fair-trade",
    "fair_labor": "fair-labor", "sustainable_sourcing": "deforestation", "regenerative": "land",
}


def scan_topics(scans: list[dict]) -> set[str]:
    """Topics suggested by tradeoffs in recent scans (e.g. palm oil -> deforestation)."""
    topics = set()
    for scan in scans[:10]:
        for item in scan.get("preference_breakdown", []):
            if item.get("status") not in ("yellow", "red"):
                continue
            option = item.get("id", "").split(":", 1)[-1]
            if option in PREFERENCE_TOPICS:
                topics.add(PREFERENCE_TOPICS[option])
            if "palm oil" in item.get("short_reason", "").lower():
                topics.add("palm-oil")
            if "beef" in item.get("short_reason", "").lower():
                topics.add("beef")
    return topics


def pick(scans: list[dict], prefs: dict, today: date | None = None) -> dict:
    today = today or date.today()
    from_scans = scan_topics(scans)
    from_prefs = {PREFERENCE_TOPICS[p] for p in prefs.get("environmental_priorities", []) + prefs.get("ethical_values", [])
                  if p in PREFERENCE_TOPICS}
    related_to = "scans" if from_scans else "preferences" if from_prefs else None
    wanted = from_scans or from_prefs
    pool = [i for i in ITEMS if wanted & set(i["topic_tags"])] or ITEMS
    item = pool[today.toordinal() % len(pool)]
    context = {
        "scans": "Related to tradeoffs in your recent scans",
        "preferences": "Related to your environmental and ethical priorities",
        None: "General food-impact fact",
    }[related_to]
    return {**item, "media_type": "article", "verified_at": VERIFIED_AT, "context_label": context}
