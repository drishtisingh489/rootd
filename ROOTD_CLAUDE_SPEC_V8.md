# root’d — Product & Build Specification for Claude Code

## Instructions for Claude Code

Build a mobile-first, responsive web app prototype following this specification. Prioritize a working end-to-end demo over additional features. Do not silently invent verified recalls, ingredient facts, nutrition metrics, or environmental measurements. If a service or API is unavailable, show a clearly labeled demo state or 'Data unavailable'.

## 1. Product vision

**App name:** root’d  
**Slogan:** Food root’d in both your values and the ground

root’d helps shoppers make food purchases that align with their personal nutrition goals, dietary values, and environmental priorities. A shopper scans a food product, and the app identifies it, checks available food information and recall records, then presents a clear personalized **red / yellow / green** recommendation with evidence and explanations.

### Hackathon MVP

1. Three-screen authentication journey: branded welcome, Auth0 login, and Auth0 registration.
2. First-time user onboarding (shown only once after initial signup) to capture nutrition goals, food values, and environmental priorities.
3. Home screen with persistent three-tab navigation: **Home**, **Camera** (larger, raised center button), and **Insights**. Scan history lives on Home; User Profile is accessible via the header/avatar.
4. Camera/photo-upload flow for scanning a food product; barcode/manual search fallback if feasible.
5. Results screen showing product identity, a prominent color-coded recommendation, specific reasons, and linked sources.
6. Save each completed scan to the signed-in user's scan history, and show evidence-backed milestones in Insights.

Do not build farm aerial imagery, chemical-authenticity detection, or broad supply-chain traceability for the MVP.

## 2. Target experience and screen requirements

### Screen A — Welcome, login, and registration (three distinct screens)

**Follow `assets/auth-ui-reference.png` for the layout, spacing, form structure, button hierarchy, and polished modern mobile aesthetic. Follow `assets/home-ui-reference.png` for the actual COLOR PALETTE throughout the app.** The blue backdrop in the authentication design reference is just a presentation backdrop: **do not use blue as the app's visual theme**. All three auth screens should feel like the same app as the green/white home, camera, and results screens.

**A1. Initial welcome screen (before authentication)**
- Replace the decorative plant/product photo area from the authentication inspiration with the **actual supplied `assets/rootd-logo.png`**, large, centered, and uncropped. Do not generate a substitute logo.
- Show the exact slogan directly underneath: **“Food root’d in both your values and the ground”**
- Do **not** show a secondary description, tagline paragraph, or explanatory copy on the welcome screen. The logo and exact slogan are the only introductory text.
- Show exactly two prominent actions placed together near the lower portion of the welcome screen, just above the illustration: **Login** on the left (filled vivid/dark green) and **Register** on the right (white, green outlined). The two buttons should sit side-by-side on the same horizontal row.
- **No Continue as Guest, guest login, guest mode, skip authentication, or guest button.** Authentication is required to continue.
- Replace the layered decorative waves with a **minimalist carrot planted in the ground** that is anchored at the bottom of the welcome screen. Use the newly supplied reference image as the compositional guide: cream/light neutral background, a dark soil band across the bottom portion, and a centered orange carrot with green leaves extending above the soil line. Keep it flat/vector-like, clean, and understated rather than realistic. It should sit beneath the buttons, not above them, and should visually ground the screen without overpowering the logo or slogan.
- White/very-light neutral canvas, dark legible text, green brand and action accents. **No decorative waves or curved hill shapes** on the welcome screen. Use the carrot-and-soil illustration instead.

**A2. Login screen**
- Same form layout and visual rhythm as the center phone in `assets/auth-ui-reference.png`: top back arrow, a friendly “Welcome back!” headline, rounded **Email** and **Password** fields, password visibility toggle, **Forgot Password?** link, wide filled-green **Login** button, and link to **Register** at the bottom.
- Integrate with **Auth0**: if using Auth0 Universal Login, configure/brand the hosted experience as closely as supported; if custom forms are not supported by the chosen Auth0 flow, do not simulate insecure local password authentication. Instead provide a matching branded login entry screen that sends users into Auth0.
- Social sign-in (e.g. Google, Apple, Facebook) may be shown **only for providers actually configured in Auth0**; these are not required for MVP and must not be decorative/nonfunctional buttons.

**A3. Registration screen**
- Follow the right phone of `assets/auth-ui-reference.png`: top back arrow, welcoming registration headline, rounded fields and a filled-green **Register** button, plus a link back to **Login**. Username, email, password, and password confirmation fields are the desired *visual inspiration*; implement registration through the configured Auth0 flow rather than pretending custom forms work when they do not.
- After successful new-account registration, route to onboarding/preferences only if `onboarding_completed` is false. After the first completed onboarding flow, later app opens and future logins should go directly to Home for authenticated users.
- Include useful loading, invalid-input, authentication-error, and password-reset states.

**Authentication acceptance criterion:** the visitor can see the actual root’d logo at the top, the exact slogan beneath it, side-by-side Login and Register actions near the lower portion, and the carrot-in-ground illustration anchored at the bottom; they can authenticate through Auth0 and continue; **no guest path exists**.

**Post-login routing / app-open behavior:** onboarding/preferences should appear **only the first time** a newly registered user enters the app (or any time `onboarding_completed` is false). Once the user finishes onboarding and saves preferences, set `onboarding_completed = true`. On future app opens and future authenticated sessions, the app should bypass onboarding and open directly to **Home**. Editing preferences later should happen from Profile → Feed Preferences, not by replaying first-time onboarding on every launch.

### Screen B — Nested preferences onboarding

**Required information architecture:** Preferences must be a **hub-and-detail flow**, not one long form or a single page showing all individual options. After first-time registration, open the **Preferences** hub. Returning users can open this exact flow from their User Profile to edit choices.

**B1. Preferences hub — exactly three category cards**
- The initial Preferences screen contains only these three primary categories, in this order:
  1. **Allergies & Diets** — includes allergies, dietary restrictions, dietary patterns, religious dietary requirements, and nutrition goals.
  2. **Ethical Values** — includes ethical food preferences and ingredient/production values.
  3. **Environmental Priorities** — includes sustainability and environmental-impact preferences.
- Present each as a large, distinct, rounded tappable card with a subtle icon, title, short supporting hint if needed, and a right-facing chevron.
- Tapping a category **navigates to its own separate detail screen** with many selectable options. Do not expand selections inline on the hub.
- After selecting at least one value in a category, show a small green check mark and/or selection count on its hub card (for example, “3 selected”). The hub must reflect saved selections when users return.
- Show a single bottom **Save Preferences & Continue** button (or **Save Preferences & Start Scanning** on first-time onboarding); it saves all categories and routes first-time users to Home.
- All nonessential preferences may remain unselected. No values should be preselected without the user's choice.

**B2. Shared category detail behavior (all three screens)**
- Header: small **back arrow in the upper-left** and category title.
- Display options as individual **rounded rectangular selection boxes/cards** in a scrollable list or responsive grid.
- **Multi-select is required:** users can select **as many options as apply** within each category. Tapping an unselected option selects it; tapping the same option again deselects it.
- **Selected state:** the entire box becomes clearly highlighted using root’d's theme green (emerald / forest green), with readable contrasting text and a check mark. **Unselected state:** white or very pale gray with a subtle border. Use both highlight and check mark so selection is not communicated by color alone.
- Selection changes are reflected immediately, with no separate save action needed per item. Tapping the **back arrow** returns to the three-category Preferences hub **without losing choices**.
- Returning to a category must restore all previous selections, whether the user is still onboarding or editing their profile later.
- Provide an optional free-text **Other / Add your own** item within each category where appropriate. This should work alongside multi-select.
- On mobile, leave sufficient space for touch targets. Match the white/light-gray surfaces, rounded corners, dark typography, and green accents from `assets/home-ui-reference.png`.
- Store selections in shared onboarding/profile state across navigation, persist them through `PUT /api/me` at completion, and load them with `GET /api/me` when editing. Back navigation must never reset state.

**B3. Allergies & Diets detail screen**
- Group many tappable choices under small **subheadings on this one detail page**, without adding more primary hub categories:
  - **Allergies:** milk, eggs, fish, shellfish, tree nuts, peanuts, wheat, soy, sesame; **Other**; optional cross-contact concern.
  - **Dietary patterns:** vegetarian, vegan, pescatarian, omnivore, keto, Mediterranean, and other.
  - **Dietary restrictions:** gluten-free, dairy-free, egg-free, nut-free, soy-free, pork-free, alcohol-free, and other.
  - **Religious dietary requirements (optional):** halal, kosher, Hindu vegetarian, Jain, other, or prefer not to say. These indicate food requirements, **not a claim about the user's religion**.
  - **Nutrition goals:** high protein, high fiber, lower added sugar, lower sodium, balanced nutrition, minimally processed, and other.
- Every individual option is independently togglable. Preserve group distinctions in stored profile data for accurate product analysis.
- Treat declared allergens as hard restrictions; for non-allergy dietary/religious requirements, allow the user to optionally mark a selected item as **strict / must avoid** versus **preference**. Do not imply that incompatible diet combinations are automatically satisfied.
- Never claim a food satisfies a specific restriction or certification when supporting product evidence is missing; use **Unverified**.

**B4. Ethical Values detail screen**
- Multi-select options such as **Animal welfare**, **Cruelty-free production**, **Fair trade**, **Fair labor practices**, **Organic preference**, **Locally sourced**, **Ingredient transparency**, **Minimal processing**, **Responsible farming**, and **Other**.
- Every option uses the same highlighted green selected state and toggles independently.
- Where useful, allow a selected ethical value to be marked **important** versus **must-have**.

**B5. Environmental Priorities detail screen**
- Multi-select options such as **Lower carbon footprint**, **Lower water usage**, **Minimal packaging**, **Recyclable packaging**, **Less plastic**, **Sustainable sourcing**, **Reduced deforestation risk**, **Biodiversity protection**, **Reduced food waste**, **Regenerative agriculture**, and **Other**.
- Every option uses the same highlighted green selected state and toggles independently.
- Optionally offer importance levels for selected items; make clear that environmental estimates and sourcing claims depend on available evidence.

**Required navigation flow**

`Auth0 registration → Preferences hub → tap category → select multiple green-highlighted boxes → tap ← back → Preferences hub (shows selected count) → tap another category → repeat → Save Preferences & Start Scanning → Home`

**Editing flow:** `User Profile → Edit Preferences → same three-category hub → category details → back arrow → Save Preferences → User Profile`.

**Preferences acceptance criterion:** the user sees **exactly three categories on the initial Preferences page**; each opens a separate option-rich screen; multiple selections can be made and toggled, selected boxes highlight in green, and the upper-left back arrow returns to the three-category hub with selections preserved. This state must survive navigating between categories and reopening preferences.

### Screen C — Home (authoritative home layout)

**Use BOTH provided in-app references together:** `assets/home-dashboard-reference.png` is a **DRAFT inspiration for the Home screen’s content hierarchy, NOT an exact design to replicate** (name/avatar header, a daily information card, a LARGE bright-green Scan Ingredient action, and a recent-scans grid), while `assets/home-ui-reference.png` is the **authoritative emerald/white/gray palette and camera/results layout**. Rebuild these as functional mobile-first React components, not screenshots. Keep the clean, rounded, airy authentication visual language across the app.

**Home screen layout, top to bottom:**
1. **Header:** user's avatar and friendly greeting / first name (for example, “Good morning, Jessica”); compact profile entry point via avatar and/or header icon. Profile editing, authentication settings, and preferences remain reachable from here, **not as a fourth or third bottom tab**.
2. **Daily Branch:** an attractive rounded white/very-pale-green card **above the main Scan action**. The heading MUST be **“Daily Branch”**, not “Daily Insight.” Show one short, engaging daily fact, story, or mini-lesson relating to the environmental or social/ethical effects of food choices. This can draw from credible news articles, educational sources, or brief licensed/embedded clips where supported; include publisher/source and a tappable **Read more / Watch** link when available. Prefer a fact related to a product category or tradeoff the user previously scanned. **Do not invent impact metrics, quotations, headlines, articles, media, or causal effects.** If personalized impact is not calculable, offer a sourced general food-impact fact and label it accordingly. This is an informational card, **not** the user's progress/Insights dashboard.
3. **Primary Scan card:** Immediately below Daily Branch, a **large, high-visibility bright-green rounded rectangular card/button** inspired by the first reference, with a white circular scan/camera icon on the left, headline **“Scan Ingredient”** (or “Scan Food”), and small subtitle **“Check how food aligns with your values.”** The ENTIRE card is tappable and routes to the same Camera page as the center bottom-nav button. This is a real interactive control, not decorative.
4. **Recent Scans / Scan History:** Below the large Scan card, a **scrollable section** titled **“Recent Scans”** with a **“View All”** action. Display saved scanned items as thumbnail cards, preferably a two-column product-card grid matching the first reference, with soft pastel image panels, product name, concise reason, and a small **red/yellow/green verdict badge** (include text labels for accessibility). The cards should be vertically scrollable with the page; clicking a card opens its existing stored scan-result page. View All opens a full scrollable History page or history view (not a fourth bottom nav tab). Provide an empty state that encourages a first scan. An optional search/filter applies to history, but must not displace Daily Branch or the main Scan card.
5. **Persistent three-item bottom toolbar:** **Home** on the **left**, **Camera** in the **center**, and **Insights** on the **right** — exactly these three items, no Cart/History/Profile tabs. The center Camera control is **slightly larger than the others**, elevated/overlapping the toolbar as a prominent emerald-green circular scan button, like the second reference. Each item has an accessible icon and label, active states, and real navigation. Toolbar persists on Home, Insights, and other main app areas when practical; back navigation works correctly on full-screen Camera/Results.

**Daily Branch versus Insights:** Daily Branch is a **single daily item of external or educational content** on Home; Insights is an **entire separate progress screen** for achievements and trends. Do not label the Home Daily Branch as “Insights” or replace the Insights tab with Profile/History.

**Home acceptance criterion:** first reference's overall home hierarchy (greeting → Daily Branch → big green Scan → scrollable recent product-card grid), second reference's emerald palette and larger center Camera tab, and working navigation from BOTH scanning entry points to the exact same scanner.

### Screen C2 — Insights / My Impact (bottom-right tab)

**Use the newly provided “My Impact” screenshot as a layout reference and inspiration, not as a literal UI to copy.** The established, realistic mobile presentation, spacing, rounded panels, and emerald/white/soft-gray colors of `assets/home-ui-reference.png` remain the main visual design system. In particular, do **not** change the app to an all-black theme or introduce a fourth bottom tab merely because the Insights reference screenshot shows one.

**Structure, top to bottom:**
1. **Header:** **“My Impact 🌱”** with optional calendar/date-range control, then understated subheading **“YOUR SHOPPING, YOUR VALUES”** (or **“YOUR SCANS, YOUR VALUES”** for accuracy when purchases are not confirmed).
2. **Your values alignment:** a prominent pale-green rounded summary card showing the percentage of **scanned products** aligned with the user's selected values over the chosen period, with a green progress bar. Clearly define the denominator and how unknown/partial results are handled. The **82%** in the reference is illustrative, not hardcoded.
3. **Your monthly progress:** side-by-side counters for **Scans** and **Aligned scans** (only label as **“Aligned choices”** if users have explicitly confirmed choosing/purchasing those items). Use the user's real data; never hardcode the reference's **24** or **12**.
4. **Your values:** a compact list of *that user's* selected values, with small status pills such as **Strong**, **Needs attention**, and **More data needed**, grounded in available scan evidence. Categories can include sustainability, food safety, and deforestation when relevant to the user and data; do not automatically assume all users chose these.
5. **Explore your impact:** three tappable detail rows/cards, styled like the reference: **Deforestation insights** (sourcing/origin evidence), **Food safety insights** (recall/ingredient concerns), and **Your evidence report** (source URLs, data freshness, and unknowns). Each opens a working detail page with the evidence and relevant scans. Rename or hide a topic if no data or selected preference supports it.
6. **Shopping milestones / achievements:** scan-based milestones such as first scan, five scans, first green-alignment match, and seven distinct days scanning. Clearly distinguish actual shopping/purchase impact from scan activity.

**Data accuracy:** Viewing or scanning does not prove a product was purchased, rejected, or consumed. Do not claim avoided sugar, reduced emissions, ethical purchases, or precise environmental savings without confirmed user actions and supporting calculation data. Provide understandable empty states, date filtering where feasible, and visible source links for externally sourced claims.

**Navigation:** the persistent bottom toolbar remains exactly **Home | raised Camera | Insights**, with Insights active on this page. The Profile screen is reached by tapping the user avatar in the Home header, not through a fourth tab.

### Screen C3 — User Profile (opened from Home header/avatar)

**Use the newly provided Profile screenshot as layout inspiration, adapted to root’d's existing colors and typography.** Build a realistic, clean, white mobile profile page with a header, back arrow, optional settings icon, large round user avatar, display name and email, an emerald **Edit Profile** action, and spaced icon/chevron menu rows. The screenshot is a *suggestion*, not a specification to reproduce irrelevant menu items.

**Profile requirements:**
- Show the current user's **profile picture**, **display name**, and **email** from their saved profile/Auth0 account.
- **Edit Profile** opens a separate editable screen for exactly these account/profile fields: **display name, email address, phone number, and profile picture**. The picture can be uploaded or changed; show a preview. Save updates and return to Profile, reflecting the changes.
- Account identity changes (especially email) must use available/authorized Auth0 account-management features or an appropriate backend flow; do not pretend a locally edited email automatically changes the Auth0 login identity. If email/phone updates are unsupported in the current Auth0 configuration, explain the dependency in-app rather than silently claiming they succeeded.
- Provide a menu row labeled **Feed Preferences** (or **Edit Food Preferences** for clarity). Tapping it opens the **same nested Preferences hub** used after registration: **Allergies & Diets**, **Ethical Values**, **Environmental Priorities**. All previous selections must be preloaded and editable. Selecting multiple green-highlighted options and tapping the top-left back arrow returns to the three-card hub without losing selections. Saving returns to Profile.
- Include **Favorites** if users can bookmark products; make the row functional or hide it until implemented. Other relevant rows may include **Language**, **Display**, and **Clear Scan History** where supported. Do not blindly reproduce placeholder functions from the reference.
- **Remove Subscription completely.** No Subscription menu row, subscription onboarding, payment CTA, or subscription feature should be included.
- Include **Log Out**, connected to Auth0 logout. If **Clear Scan History** is provided, request confirmation before deleting scans.
- Use a top-left back arrow to return to Home. Keep Profile out of the three-item bottom tab bar; the header avatar is the entry point.

**Profile acceptance criterion:** avatar/name/email are visible; Edit Profile allows display name, email, phone, and photo changes with honest persistence behavior; Feed Preferences opens the nested multi-select flow with saved selections; Subscription is absent; logout works.

### Screen D — Camera / Scan and confirm

**Camera screen visual requirement:** closely reproduce the **CENTER phone** in `assets/home-ui-reference.png`: a minimal white/very-light-gray canvas; close/back control in the upper-left; dark rounded scanner-corner brackets framing the product; a crisp emerald horizontal scanning line; a centered camera/product preview; green circular scan trigger; and a clean loading/“Scanning…” state. Include helpful concise guidance below, similar in rhythm to the reference. Do not show the reference image itself; implement a live camera view/file capture flow. Both the huge Home Scan card and raised center toolbar Camera button must lead to this **same** screen.


- Ask for camera permission when needed; support file upload if permission is denied.
- Show captured image preview and a loading/analysis state.
- Identify the food product using a vision-capable model, reading visible packaging text where possible.
- Before issuing a definitive product-specific report, display **“We found: [product name / brand]. Is this correct?”** with **Confirm** and **Edit / Try Again**.
- Prefer barcode identification where available; if product identity is ambiguous, ask for correction rather than guessing.
- Product matching should consider brand, product variant, package size, and barcode when available.

### Screen E — Post-scan results (two connected screens)

After a product is scanned and confirmed, the user should enter a **two-step results flow**:
1. **E1 — Overall Results Overview** (animated tree / overall rating)
2. **E2 — Detailed Preference Breakdown** (specific ratings per saved preference)

This must feel like one connected experience, where the second screen is opened by tapping the summary card on the first screen.

### E1 — Overall Results Overview

**Use the newly provided tree image as the structural inspiration for the main rating visual.** Keep the realistic green-and-white root’d app aesthetic, but replace the previous dial/gauge concept entirely. The focal visual is now an **animated tree** whose state communicates the overall result.

**Required header**
- **Back** button on the upper-left.
- **root’d logo centered at the top**.
- **Share** action on the upper-right.

**Top product widget**
- Keep a rounded product summary widget directly beneath the header.
- Include the scanned product’s thumbnail, brand, product name, and package size / variant if known.
- Allow an optional save/favorite control only if favorites are implemented; otherwise omit it.

**Animated tree result visual**
- The centerpiece of the page is a large **animated tree** that represents the product’s overall alignment with the user’s saved preferences.
- While the scan results are loading/analyzing, the tree should appear to **grow**: trunk/branches establish first, then leaves/blossoms gradually appear. This loading sequence should feel alive and calm, not abrupt.
- Once the result is ready, the tree settles into a final state on a **continuous spectrum** based on the overall rating.
- The overall rating should combine the user’s relevant saved preferences and product evidence into one understandable result. This includes, when applicable: **allergies / diets / religious dietary requirements, nutrition goals, ethical values, environmental priorities, and food-safety concerns**.

**Tree-state spectrum**
- **Red / Strong Conflict:** tree appears **dead or struggling** — bare branches, little or no foliage, dry or lifeless appearance. Subtle motion can include a slight sway of empty branches.
- **Yellow / Mixed Fit / Consider Carefully:** tree appears **partially healthy** with yellow/orange/red leaves and a few leaves falling. Motion can include a gentle breeze and occasional falling leaves.
- **Green / Good Match:** tree appears **full, lush, and thriving**, with abundant green leaves and some blossoms. Motion can include a slight breeze, rustling leaves, and subtle blossom movement.
- Use a **continuous gradient** between these extremes. For example, a weak green score may show fewer leaves than a very strong green score; an orange-leaning yellow may look less healthy than a pale yellow result.
- Do not rely on color alone: pair the visual with explicit labels such as **Strong Conflict**, **Mixed Fit**, **Good Match**, or **Insufficient Data**.
- If critical evidence is missing, support an **Insufficient Data** state and make that explicit rather than presenting a falsely reassuring healthy tree.

**Animation behavior**
- The tree should remain gently animated even after loading: slight breeze, subtle branch sway, occasional falling leaves for yellow states, and soft blossom/leaves rustling for healthier states.
- Avoid heavy, distracting animation. The movement should reinforce the mood/state of the result while keeping the page polished and readable.
- If implementation complexity is too high for the hackathon, a simplified animation (CSS or lightweight Lottie/SVG motion) is acceptable, but the concept must still be the animated growing tree rather than a dial.

**Short findings / reasoning box**
- Directly underneath the tree, show **one rounded box/card** containing a short summary of the findings and the reasoning behind the overall rating.
- This box should explain, in plain language, why the product received that result, prioritizing the most important reasons first.
- The summary box must be **tappable**. Tapping it opens **E2 — Detailed Preference Breakdown**.
- Include a hint such as **“Tap to see detailed breakdown”** or a chevron so users know it is interactive.

**What this summary should include**
- 2–4 concise bullet points or short sentences covering the most important reasons.
- Clear distinction between:
  - verified hard conflicts (for example allergen match or recall),
  - soft tradeoffs (for example higher sugar than preferred), and
  - unknown/unverified areas (for example sustainability data unavailable).

**Optional lower content**
- If supported, this screen may also include **better alternatives** or **next actions** below the summary card, but this is secondary to the tree and tappable summary.
- Do not clutter the page. The animated tree and short-summary interaction are the primary behaviors.

### E2 — Detailed Preference Breakdown

**Use the second detailed-results reference as the inspiration for this screen.** It should feel like the drill-down view from E1.

**Header and top context**
- Preserve the same top chrome style: **Back** on the left, **root’d logo centered**, and **Share** on the right.
- Keep the same scanned-product widget visible near the top so the user always knows which product is being evaluated.

**Purpose of this screen**
- This page provides the **specific ratings for each relevant user preference or evaluation category**, using simple, highly scannable icon-based indicators.
- It is opened by tapping the summary box on E1.

**Detailed rating indicator system**
- Use the same **clipart-style circular indicators** as suggested by the provided reference: visually bold icons/badges that make the status of each item obvious at a glance.
- Adapt the indicator set to root’d’s meaning:
  - **Green / positive icon** = aligned / looks good
  - **Yellow / caution icon** = caution / mixed / partially aligned
  - **Red / negative icon** = conflict / concern / does not align
  - **Gray / neutral icon** = unknown / not enough data
- Keep the look simple and icon-driven, but ensure every item also has a text label and short explanation for accessibility.

**How to organize the detailed findings**
- Display findings as a vertical scrollable page of icon tiles, grouped into meaningful sections.
- The sections should be based on the user’s saved preferences and available evidence, such as:
  - **Allergies & Diets**
  - **Nutrition Goals**
  - **Ethical Values**
  - **Environmental Priorities**
  - **Food Safety / Recalls**
  - **Ingredient Quality / Processing** (only if supported by actual app logic)
- Only show rows/items that are relevant to the user or useful to explain the rating. Do not clutter the UI with unrelated categories.

**Examples of detailed items**
- Peanut allergy — red if peanuts are present or possible cross-contact is confirmed/relevant
- Vegan preference — green if ingredient evidence supports it, gray if unverified
- Halal or kosher requirement — gray if not verified rather than assumed
- Lower added sugar goal — yellow or red depending on actual nutrition values
- Fair trade preference — green if supported, gray if unavailable
- Lower carbon footprint — green/yellow/gray based on available environmental evidence
- Reduced deforestation risk — green/yellow/gray based on sourcing evidence
- Active recall / safety alert — red when verified and relevant

**Interaction model**
- Each clipart indicator tile/button must be **clickable/tappable**.
- On tap, show the **specific original evidence behind that individual rating**. Prefer opening a concise in-app evidence sheet with the criterion name, rating, reason, source title/publisher, record details, date checked, and a prominent **“View original source”** link that opens the actual source URL in a browser. Where a direct authoritative URL exists, it must be one tap away; an external-link icon should make it obvious.
- Sources may include recall notices, ingredient/label records, nutrition databases, environmental/sourcing records, certification pages, or other evidence actually used for the rating.
- If there is **no direct source available** for a given detailed rating, the tap target should still open an explanation that clearly says so (for example **“No source link available — this rating was derived from structured product fields we extracted from packaging / Open Food Facts”**). Never fake a source.
- Keep source URLs and citation metadata with each rating in the scan record so the evidence link still works when the user reopens the result from Scan History.
- Keep the overall experience quick to scan first, detailed second.

**Critical behavior / truthfulness**
- Do not invent ratings for categories without evidence.
- If a preference cannot be verified, mark it **Unknown / More data needed** instead of positive.
- Use the detailed screen to explain why something is green, yellow, red, or gray.
- Ensure the overall E1 tree state is meaningfully derived from these E2 detailed findings.

**Results acceptance criterion:** every detailed-results clipart rating tile opens its own source/evidence details (or an explicit unavailable-source explanation); evidence URLs must correspond to the specific rating and persist in history. After scanning, users first see a polished overall-results page with **Back**, **centered root’d logo**, **Share**, a **top product widget**, a large **animated tree** that grows while results load and then settles into a state on the red/yellow/green spectrum, and a **tappable short-summary card**. Tapping that summary opens a second detailed breakdown page with the same product context and icon-based ratings for the user’s specific stored preferences.

## 3. Verdict evaluation logic

Use deterministic application logic for the final color, with AI assisting identification and explanation. Do not let an LLM freely invent the verdict.

1. Identify/confirm product and retrieve product-specific data.
2. Check whether any authoritative recall record actually applies to this exact product or lot and is currently relevant.
3. Compare known ingredients to user-defined hard restrictions (allergens/dietary must-avoids).
4. Compare nutritional attributes against the user's soft nutrition goals, using real reported values.
5. Compare available environmental and ethical attributes against weighted priorities, showing when data is estimated or absent.
6. Apply precedence: verified recall / confirmed hard restriction => **red**; known soft conflicts => **yellow**; strong alignment with sufficient verified data => **green**; insufficient critical data => **unknown**. Then map that outcome onto the animated tree state for E1, using the red/yellow/green health spectrum and an explicit text label.
7. Produce concise reasons referencing the evidence, and show missing-data warnings.

For the demo, implement a small transparent ruleset rather than a complex opaque numeric score. If a numeric alignment score is added, label it a preference-fit estimate, not a scientific safety score.

## 4. Suggested implementation stack

- **Frontend:** React + TypeScript + Vite, mobile-first responsive CSS (Tailwind optional).
- **Authentication:** Auth0 Universal Login using the official Auth0 React SDK. Configure domain, client ID, callback/logout URLs in environment variables. Protect authenticated routes.
- **Backend:** Python FastAPI with endpoints for profile, scan, product lookup, and history.
- **Product data:** Open Food Facts for barcode, ingredient, and nutrition fields when available.
- **Recall evidence:** openFDA food enforcement API; include product/lot matching and a conservative status policy.
- **Vision and AI explanation: OpenRouter API (required for MVP)** using a team-selected, currently available vision-capable model. Use OpenRouter for product/image recognition, visible label text extraction, parsing possible ingredients, and human-readable explanation grounded in fetched product data. **Do not use OpenRouter as a recall database or source of invented nutrition/environmental facts.** Treat model output as unverified until confirmed or corroborated.
- **Persistence:** SQLite for fast local demo development (or a hosted database if already available), with records keyed by Auth0 user ID.
- **Security:** validate Auth0 access tokens on protected backend routes; do not trust a user ID sent from the browser. Keep API secrets on the server.

These are recommended defaults, not pre-existing decisions from the team.

## 5. Example data contract

Frontend and backend should agree on a consistent structured response. This is an **illustrative schema with fictional example data**, not a real recall or factual product assessment:

```json
{
  "scan_id": "scan_demo_001",
  "product": {
    "name": "Example Oat Snack",
    "brand": "Demo Brand",
    "barcode": null,
    "package_size": "50 g",
    "identity_confirmed": true,
    "image_url": null
  },
  "overall_result": {
    "status": "yellow",
    "label": "Mixed Fit",
    "alignment_score": 74,
    "score_label": "Overall preference alignment",
    "summary_short": "Matches your plant-based preference, but may conflict with your lower-sugar goal and lacks verified sustainability data.",
    "summary_points": [
      "No known hard allergen conflict was found for your saved profile.",
      "Added sugar may be higher than your preferred target.",
      "Environmental sourcing data is incomplete."
    ]
  },
  "preference_breakdown": [
    {
      "group": "Allergies & Diets",
      "label": "Vegan preference",
      "status": "green",
      "short_reason": "No obvious animal-derived ingredients found in the checked data.",
      "evidence_level": "partial",
      "evidence_sources": [{"title": "Demo ingredient listing", "publisher": "Illustrative source", "url": null, "checked_at": "2026-11-07T16:00:00Z"}]
    },
    {
      "group": "Nutrition Goals",
      "label": "Lower added sugar",
      "status": "yellow",
      "short_reason": "Reported sugar content may exceed your preferred threshold.",
      "evidence_level": "verified",
      "evidence_sources": [{"title": "Demo nutrition label", "publisher": "Illustrative source", "url": null, "checked_at": "2026-11-07T16:00:00Z"}]
    },
    {
      "group": "Environmental Priorities",
      "label": "Lower carbon footprint",
      "status": "gray",
      "short_reason": "Not enough sourcing data was available to estimate this confidently.",
      "evidence_level": "unknown",
      "evidence_sources": []
    }
  ],
  "recall_check": {
    "status": "not_verified",
    "checked_at": "2026-11-07T16:00:00Z",
    "message": "No definitive recall assessment available in this demo."
  },
  "data_gaps": ["Environmental footprint not available"],
  "sources": [],
  "created_at": "2026-11-07T16:00:00Z"
}
```

Suggested enums: `verdict = red | yellow | green | unknown`, `reason.status = aligned | conflict | warning | unknown`. Backend errors should use a consistent JSON error format.

## 6. API surface

- `GET /api/me` — authenticated user's saved profile.
- `PUT /api/me` — create/update preferences and onboarding completion; also persist supported profile fields (display name, phone, profile picture), while keeping Auth0 identity fields in sync through supported account-management flows.
- `POST /api/scans/identify` — upload image, return candidate identity and confidence/ambiguity notes.
- `POST /api/scans/analyze` — accept confirmed product identity, fetch evidence, apply verdict rules, persist scan, return result.
- `GET /api/scans` — list authenticated user's history.
- `GET /api/scans/{scan_id}` — return a prior scan owned by the user.
- `GET /api/daily-branch` — return a cited daily fact/story with source link; gracefully fall back to a verified curated item if live news is unavailable.
- `GET /api/insights` — derive honest summary stats and milestones from the authenticated user’s scan records; do not invent purchase outcomes.

Never expose another user's profile or scans. Validate uploaded image type and size. Rate-limit costly analysis endpoints where practical.

## 7. Data model (minimum)

**UserProfile**: `auth0_sub`, `display_name`, `email`, `phone`, `profile_image_url`, `dietary_patterns`, `allergens`, `allergy_cross_contact_preferences`, `dietary_restrictions`, `religious_dietary_requirements`, `hard_restrictions`, `nutrition_goals`, `ethical_values`, `environmental_priorities`, `onboarding_completed`, `updated_at`. Religious dietary preferences are optional sensitive data: collect only as necessary for user-directed food screening, avoid inferring faith, and provide edit/delete controls.

**ScanRecord**: `id`, `auth0_sub`, `product_name`, `brand`, `barcode`, `image_reference`, `overall_status`, `overall_label`, `alignment_score`, `summary_short`, `summary_points_json`, `preference_breakdown_json` (including per-item `evidence_sources`), `recall_check_json`, `sources_json`, `data_gaps_json`, `created_at`.

**DailyBranchItem** (optional cached content): `id`, `headline`, `summary`, `source_title`, `source_url`, `published_at`, `media_type`, `topic_tags`, `verified_at`. **Milestone** (derived or persisted): `id`, `auth0_sub`, `type`, `scan_ids`, `achieved_at`; do not count actions that were not logged.

Avoid storing uploaded images longer than necessary; make retention explicit. Do not log tokens or sensitive profile contents unnecessarily.

## 8. Visual design system — AUTH VIBE + HOME/SCAN COLORS

**Visual references have complementary jobs:**
- **`assets/auth-ui-reference.png` = mood, polish, composition, typographic hierarchy, rounded fields, button shapes, and the three-step welcome/login/register layout.** Borrow its clean, spacious, modern, minimal feel. **Ignore its bright-blue surrounding presentation background** and its original dark charcoal buttons. For the welcome screen, combine this polished style with the new carrot reference: place the real logo and slogan at the top, side-by-side Login/Register buttons near the bottom, and a minimalist carrot-in-soil illustration anchored at the very bottom.
- **`assets/home-dashboard-reference.png` = optional HOME WIREFRAME / DRAFT ONLY**, for the idea of Daily Branch → large Scan → Recent Scans. It is **not** the target UI appearance; favor the realistic presentation and card styling of `assets/home-ui-reference.png`.
- **`assets/home-ui-reference.png` = REQUIRED colors and Camera/Results composition.** The app should feel lush, fresh, healthy, confident, and clean, with saturated emerald greens, white/soft-gray surfaces, dark typography, and selective dark-green brand accents.

**Working design tokens (approximate visual targets; tune against the actual reference):**

| Token | Starting color | Use |
|---|---|---|
| `--color-emerald` | `#009B66` | Main bright green brand accent, primary scan button, active state |
| `--color-emerald-light` | `#23B77E` | Accent gradient, secondary highlights |
| `--color-forest` | `#174B32` | Logo-aligned dark green, strong filled buttons, bold accents |
| `--color-bg` | `#F7F8F7` | Light neutral app background |
| `--color-surface` | `#FFFFFF` | Cards, screens, fields, and panels |
| `--color-muted-surface` | `#F0F2F1` | Search fields, input backgrounds, secondary chips |
| `--color-text` | `#202724` | Headings and body |
| `--color-muted-text` | `#727C77` | Descriptions and metadata |
| `--color-divider` | `#E5EAE7` | Dividers and subtle borders |
| `--color-danger` | `#D94B50` | Red verdict and confirmed blocking issues |
| `--color-caution` | `#D9A23F` | Yellow verdict and tradeoffs |
| `--color-success` | `#0F9B69` | Green verdict and strong value alignment |

- Palette is **green + white + cool/light gray**, not blue, beige-heavy, or monochrome black. Brand logo's exact colors may differ; never recolor the provided file destructively.
- Keep **app screens white/soft gray** with emerald accents; use an emerald gradient only in measured doses (e.g. marketing/presentation background or a small branded area), not behind dense text.
- Use modern rounded sans-serif typography, comfortable whitespace, clear bold headlines, carefully aligned icons, 14–20px rounded cards/inputs, restrained shadows, large touch targets, and a slightly elevated round green camera CTA.
- Home: take only the content order and scan-card idea from the **draft** `assets/home-dashboard-reference.png`, and use the **more realistic UI look** of `assets/home-ui-reference.png` for visual styling; display **Daily Branch** above Scan, then scrollable recent-scans product cards; bottom toolbar **Home / raised center Camera / Insights**. Profile is available from the avatar/header.
- Scanner: replicate black rounded corner guides, a readable green horizontal scan line, centered product/packaging preview, and a simple progress state. Camera CTA bright green.
- Results: a **two-step results flow**. First show an overall animated-tree page with the product widget, centered logo, share action, and tappable short-summary card. Then show a detailed icon-based breakdown page using clipart-style indicators for each relevant saved preference. Personalize all findings to the user's actual stated values rather than generic nutrition scoring.
- Clear user-specific **red / yellow / green** verdict banner with label, explanation and accessible icon. Keep **recall/safety warning visibly separate** from nutrition or ethical fit.
- Responsive mobile-first implementation; functional desktop layout, keyboard/assistive technology support, accessible contrast, error/loading/empty states.
- Do **not** render the reference screenshots as backgrounds or mock interactive imagery. Recreate interfaces as real components, with product images only where legitimately available.

## 9. Build order / acceptance checklist

1. Scaffold frontend/backend and create `.env.example` with placeholders.
2. Build Auth0 landing and authenticated routing.
3. Build the nested three-category Preferences hub and multi-select category detail screens, then save/load profile and editable preferences.
4. Build Home with sourced Daily Branch, giant Scan card, scrollable scan history, Home/raised Camera/Insights bottom navigation, and camera/upload confirmation flow.
5. Build the two-screen results flow using clearly marked mock scan data so the end-to-end flow works immediately: (a) overall animated-tree page, then (b) detailed preference breakdown page opened from the summary card.
6. Implement product lookup and recall checks with source links and safe uncertainty handling.
7. Implement deterministic preference alignment, persisted scan history, and honest scan-derived Insights/milestones.
8. Test on mobile and desktop, including unknown products, denied camera access, API failures, and missing data.
9. Add a README with setup steps, required environment variables, demo instructions, limitations, and architecture.

**Definition of done:** A new user can log in with Auth0, complete onboarding once, land on Home thereafter, scan/upload a product photo, confirm product identity, receive a reasoned and sourced result with the animated tree overview and detailed breakdown, review that scan in history, edit preferences from Profile, and log out.

## 10. Hackathon demo script

1. Open branded root’d welcome screen showing supplied logo at the top, the exact slogan beneath it, side-by-side Login/Register buttons near the lower portion, and the minimalist carrot-in-ground illustration at the bottom; tap Login and authenticate with Auth0.
2. Select a nutrition goal, an allergy or hard dietary/religious restriction, and an environmental priority.
3. Open Camera, upload a pre-tested food photo, and confirm product identity.
4. Show the red/yellow/green (or unknown) verdict, personalized explanation, and expandable evidence.
5. Open Search History to show the saved result.
6. Edit a preference in User Profile and reanalyze or scan a different product to show personalization.

Use a few **pre-tested** examples. Any simulated or fixture data must be visibly labeled demo data. Never fabricate an FDA recall to make the demo more dramatic.

## 11. Optional stretch goals

- Barcode scanning as a faster, more accurate product identifier.
- Comparable alternative product recommendations.
- Detailed environmental impact estimates from cited datasets.
- Ingredient label OCR and improved confidence handling.
- Fresh-produce visual assessment with explicit limits on what photos can establish.
- More comprehensive food provenance/traceability.

## 12. What Claude should produce

Implement the MVP as runnable code, not only mockups. Begin by describing the folder structure and implementation plan, then create files. Keep frontend and backend clearly separated. Supply `.env.example`, setup commands, Auth0 dashboard configuration guidance, API contracts, and a README. Where credentials or live data are missing, keep the UI functional with clearly labeled demo fixtures. Favor a reliable full flow over unfinished advanced features. Reuse supplied `assets/` images as directed. Use OpenRouter server-side for the vision flow and ensure Auth0 and OpenRouter configuration is documented. Do not invent an API key, Auth0 credentials, or available vision model ID.

## 13. OpenRouter API integration — REQUIRED

The team has access to OpenRouter and wants it wired into the running app, not merely described as a future option. **Use OpenRouter as the LLM/multimodal provider** (not a direct Anthropic/OpenAI key), with all requests made by the FastAPI backend.

**Environment configuration (`backend/.env`):**

```dotenv
OPENROUTER_API_KEY=replace_with_team_key
OPENROUTER_MODEL=replace_with_vision_capable_model_id
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
# Optional; not required for functioning API calls
OPENROUTER_SITE_URL=http://localhost:5173
OPENROUTER_APP_NAME=root'd
```

Build a backend `openrouter_client.py` service that:

1. Accepts an uploaded JPG/PNG/WEBP product photo, validates MIME type and size, and normalizes/resizes oversized images.
2. Sends a `POST` to `https://openrouter.ai/api/v1/chat/completions` with `Authorization: Bearer <OPENROUTER_API_KEY>`, JSON `Content-Type`, and a configured `model` that supports image input. Do not hardcode a specific model until one is selected and verified available to the team.
3. Sends `messages` containing a text request and an image content part, e.g. `{ "type": "image_url", "image_url": { "url": "data:image/jpeg;base64,<base64>" } }`. Images remain server-side; the frontend never receives the OpenRouter key.
4. Asks the model for **candidate** product name, brand, variant, visible ingredients/label text, potential barcode if legible, confidence/ambiguity notes, and a statement of what cannot be determined from the image. Parse and validate structured response on the server; handle malformed model output.
5. Returns candidates to the user for confirmation. After product lookup (Open Food Facts) and recall lookup (openFDA), optionally asks the model to summarize **only the provided evidence** and relevant user preferences, with factual citations represented by backend-provided URLs.
6. Uses deterministic backend rules, not LLM-generated judgment, for red/yellow/green/unknown. If OpenRouter fails or times out, present a recoverable error and allow barcode/manual lookup or a **clearly labeled demo mode**.
7. Includes retries/backoff for transient API errors, sensible timeouts, token/cost limits, and tests using mocked API responses. Never expose or log the key.

**API request shape (illustrative, with model and image content set dynamically):**

```python
import os
import httpx

async def identify_with_openrouter(image_data_url: str):
    model = os.environ["OPENROUTER_MODEL"]
    api_key = os.environ["OPENROUTER_API_KEY"]
    payload = {
        "model": model,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text": "Identify this food package. Return concise structured candidate identity and visible-label evidence. Do not guess missing facts."},
                {"type": "image_url", "image_url": {"url": image_data_url}}
            ]
        }],
        "max_tokens": 500
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f'{os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")}/chat/completions',
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload
        )
        resp.raise_for_status()
        return resp.json()
```

This is a minimal connection example, not complete production validation. Claude must implement proper response validation, exceptions, auth, and input checking.

Docs: https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request and https://openrouter.ai/docs/guides/overview/multimodal/overview

## 14. Supplied visual assets and brand acceptance criteria

Assets included in this deliverable:
- `assets/rootd-logo.png`: **actual root’d logo/wordmark**, supplied by the team. Use on the initial welcome screen, preserving exact appearance and aspect ratio.
- `assets/auth-ui-reference.png`: **authentication layout and mood reference**, showing the welcome, login, registration composition. Use for visual structure, **not its blue backdrop/colors**. The initial welcome image in this style is REPLACED by our logo and slogan at the top, side-by-side Login/Register actions near the lower section, and a minimalist carrot-in-ground illustration at the bottom. Remove guest access.
- `assets/home-ui-reference.png`: **primary color + scanner reference** showing green-and-white app design; CENTER phone still directs Camera UI, and its overall realism/polish informs the rest of the app. This controls the colors of all screens, including auth and onboarding.
- `assets/result-overview-reference.png`: **overall-results structural reference** for the post-scan screen layout (Back, centered top logo, Share, top product widget, and overall-result focal area). Adapt this layout, but replace the dial with the animated tree concept.
- `assets/tree-result-reference.png`: **tree-structure reference** for the overall animated result visual. Use this as inspiration for the tree’s general form, branching silhouette, and leafy fullness at the healthy end of the spectrum.
- `assets/result-detail-reference.png`: **detailed-breakdown reference** for the second result page, showing icon-based per-criterion ratings; use this as structural inspiration for the drill-down breakdown screen.
- `assets/home-dashboard-reference.png`: **OPTIONAL DRAFT / ROUGH CONCEPT ONLY** showing greeting/avatar, a daily information card, oversized green scan card and recent product tiles. Do **not** copy its exact visuals. Rename the daily card to Daily Branch; use the more realistic `assets/home-ui-reference.png` aesthetic and Home/Camera/Insights toolbar.
- `assets/carrot-ground-reference.png`: illustrated carrot rooted in dark soil, provided as welcome-screen illustration reference.

**Required end-to-end visual flow:**
1. **Welcome:** actual logo at top → exact slogan beneath → side-by-side buttons near lower portion (**Login** on left, **Register** on right) → carrot-in-soil illustration anchored at bottom; **no guest option**.
2. **Login/Register:** separate clean, rounded, spacious screens aligned to auth reference, with **green** (not charcoal or blue) button and link accents; Auth0 working in practice.
3. **Onboarding:** first show exactly three large category cards (**Allergies & Diets**, **Ethical Values**, **Environmental Priorities**). Tapping one opens a separate screen of many multi-select options; selected boxes fill/highlight in green, an upper-left back arrow returns to the hub, and selection counts appear on hub cards.
4. **Home:** greet user/avatar; Daily Branch sourced short story/fact; oversized green Scan Ingredient card; scrollable recent-scans thumbnail grid with verdicts; toolbar Home (left), raised/oversized Camera (middle), Insights (right); profile via header.
5. **Camera:** use the CENTER phone of the scanner/results visual reference: alignment guides + green scan line, green capture action, working photo upload/camera flow and product-confirmation step; both scan entry points open this same page.
6. **Results:** combine the existing realistic scanner/results reference with the two new result references. The first results page should use a **large animated tree** plus a short tappable findings card. The tree grows while the result loads and then settles into a state on the red/yellow/green health spectrum. The second page should provide a **detailed icon-based preference breakdown** using **clickable** clipart-style status badges, each linking to its supporting recall/ingredient/sourcing/nutrition source or explaining missing evidence. Keep **Back**, the **centered root’d logo**, **Share**, and the **top scanned-product widget**.
7. **Insights / My Impact:** separate bottom-right tab with a pale-green alignment score/progress bar, monthly scans and aligned scans, user-specific values/status pills, evidence-backed Deforestation/Food Safety/Evidence Report pages, and scan-based milestones. Use the new screenshot as a **draft reference**, not the dark theme or a four-tab navigation.
8. **Profile:** open from Home avatar; show photo/name/email, Edit Profile (name, email, phone, picture), Feed Preferences (opens saved nested three-category preferences hub), and Auth0 Log Out. **No Subscription.**

**Brand consistency:** always spell app name `root’d`; slogan exactly **“Food root’d in both your values and the ground”** Use the provided logo (not a generated version). No guest pathway. Match the home reference green/white palette *across every screen*. Keep authentic claims evidence-based and distinguish unknown data.

## 15. Visual acceptance checklist for Claude

- [ ] Welcome screen visually feels like the provided authentication reference, but uses the real root’d logo in place of the photo.
- [ ] Exact slogan appears below the logo with no secondary description or additional introductory paragraph.
- [ ] A minimalist carrot-in-soil illustration appears at the bottom of the welcome screen, replacing the reference waves/hills; no wave decoration remains.
- [ ] Welcome has ONLY **Login** and **Register** actions; no guest sign-in or guest bypass.
- [ ] Login and registration pages have spacious rounded forms matching the authentication reference and are wired to Auth0.
- [ ] The app uses **emerald green, forest green, white, light gray and dark text** drawn from the home/scanner reference — not blue auth-reference backdrop.
- [ ] Initial Preferences hub shows exactly three category cards: Allergies & Diets, Ethical Values, Environmental Priorities.
- [ ] Each category opens its own detail page with many options; choices are true multi-select with green-highlighted checked boxes, and can be deselected.
- [ ] Each detail page has a top-left back arrow returning to the three-category hub without clearing selected preferences.
- [ ] Hub cards show selected counts or check marks; choices persist across categories, Save, and later editing in User Profile.
- [ ] After first-time onboarding is completed, later app opens/login sessions route directly to Home instead of showing onboarding again.
- [ ] Home follows the new dashboard reference: greeting and avatar → Daily Branch (not Daily Insight) → a large bright-green Scan card → scrollable Recent Scans product tiles.
- [ ] Both the large Home Scan card and the larger raised center Camera button navigate to the same fully functional scanner.
- [ ] Bottom toolbar has EXACTLY **Home (left), Camera (larger center), Insights (right)**. Profile opens from header; scan history from Home/View All.
- [ ] Daily Branch shows a real cited environmental/social-impact fact, article, or available short clip; no fabricated metrics or links.
- [ ] Insights is based on the new My Impact reference: values-alignment progress bar, monthly scans/aligned scans, personalized values/status indicators, Deforestation/Food Safety/Evidence Report detail navigation, and scan-based milestones; no hardcoded example stats.
- [ ] Profile resembles the provided clean avatar-and-menu reference, with Edit Profile for display name, email, phone and profile picture; Feed Preferences loads the editable nested three-category Preferences hub; Auth0 logout works; Subscription is absent.
- [ ] The previous home dashboard mockup is labeled DRAFT inspiration only, while the realistic emerald/white scanner-and-results reference defines the visual polish.
- [ ] Scanner visually echoes the corner guides and green scan line reference and is connected to real camera/upload behavior.
- [ ] Results resemble the reference's card-based composition, but show our personalized safety, allergen, religious/dietary, nutrition, and sustainability explanations.
- [ ] The primary result visual is an animated tree that grows while findings load and then settles into a healthy/neutral/unhealthy state along the red-to-green spectrum, with subtle ongoing motion appropriate to the rating.
- [ ] Every detailed-results clipart rating icon/tile is clickable; opens claim-specific source evidence and a live original-source link, or clearly states when no supporting source exists; citations are saved with scan history.
- [ ] OpenRouter powers vision identification; Open Food Facts and authoritative recall data ground factual claims; Auth0 authenticates users.
- [ ] All screen components are actual functioning UI, not screenshots.
