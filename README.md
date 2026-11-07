# root’d

**Food root’d in both your values and the ground.**

root’d is a mobile-first web app that helps shoppers check whether a food product fits their allergies, diets, nutrition goals, ethical values and environmental priorities. You scan or upload a photo of a product, confirm what it is, and get a personal **Good Match / Mixed Fit / Strong Conflict / Insufficient Data** result. An animated tree shows the result, and every individual rating links to its source.

The full product spec is in [ROOTD_CLAUDE_SPEC_V8.md](ROOTD_CLAUDE_SPEC_V8.md). Visual references are in [assets/](assets/).

> **Demo-grade identity, no real authentication.** There are no accounts or passwords. On first visit the browser creates a random ID, keeps it in `localStorage`, and sends it to the API as an `X-User-Id` header; the backend stores that browser's profile and scans under it. Anyone who has that ID can read and change that data, and clearing browser storage starts a fresh profile. **Do not use this build for real user data.**

---

## Quick start

You need Python 3.12+ and Node 20+.

```bash
# 0. Configuration: one .env file at the repo root, shared by backend and frontend
cp .env.example .env            # then add your OpenRouter key and model (see below)

# 1. Backend (FastAPI) — http://localhost:8000
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000

# 2. Frontend (React + Vite) — http://localhost:5173
cd frontend
npm install
npm run dev
```

`.env` is git-ignored (only the blank `.env.example` is committed). Only variables starting with `VITE_` are sent to the browser; everything else, such as the OpenRouter key, stays on the server. Never give a secret a `VITE_` prefix.

The Vite dev server proxies `/api` to the backend, so no CORS setup is needed locally.

### Tests and checks

```bash
cd backend  && .venv/bin/python -m pytest -q      # verdict rules, API, OpenRouter client (mocked)
cd frontend && npm run build && npm run lint      # type-check + production build + oxlint
```

---

## Configuration

All settings live in the root `.env`. The backend also reads `backend/.env` if it exists, and its values take precedence. Placeholder values such as `replace_with_…` count as not set. On startup the backend logs which files it loaded and whether OpenRouter is configured, and `GET /api/health` returns `openrouter_configured: true/false`.

| Sent to the browser (`VITE_*`) | Value |
|---|---|
| `VITE_API_BASE_URL` | Blank locally; API origin when deployed |

| Server only | Value |
|---|---|
| `OPENROUTER_API_KEY` | From openrouter.ai/keys. Server-side only |
| `OPENROUTER_MODEL` | A **vision-capable** model your team has verified ([browse](https://openrouter.ai/models?input_modalities=image)) |
| `OPENROUTER_BASE_URL` | `https://openrouter.ai/api/v1` |
| `OPENFDA_API_KEY` | Optional; raises openFDA rate limits |
| `DATABASE_PATH`, `CORS_ORIGINS`, `MAX_UPLOAD_BYTES` | Optional (blank uses the defaults) |

### OpenRouter

All OpenRouter calls happen in the backend ([backend/app/openrouter_client.py](backend/app/openrouter_client.py)). The client:

- validates and downsizes the photo
- sends it as a base64 data URL
- asks for **candidate** identity and visible label text only
- validates the JSON it gets back
- retries transient errors

The model never decides a verdict. If OpenRouter isn't configured or fails, the camera falls back to barcode or name lookup and clearly labelled demo products.

---

## Demo script

1. Open the app. The landing screen shows the logo, the slogan, a **Continue** button and the carrot illustration.
2. Tap **Continue**. On a first visit you land on the **Preferences** hub; afterwards Continue goes straight to Home.
3. In **Allergies & Diets**, pick an allergy (for example *Tree nuts*) and a nutrition goal (*Lower added sugar*). Go back, open **Environmental Priorities** and pick *Reduced deforestation risk*. Tap **Save Preferences & Start Scanning**.
4. Tap the big **Scan Item** card or the raised camera button. Photograph a product, or tap **Barcode or name** and enter `3017620422003` (a real Open Food Facts product).
5. Confirm the product ("We found: … Is this correct?"). The tree grows while root’d checks Open Food Facts and openFDA, then settles.
6. Tap the summary card to open the detailed breakdown. Tap any rating to see its evidence and **View original source**.
7. Go Home: the scan appears under **Recent Scans**. Check **Insights** for alignment, values and milestones.
8. Tap your avatar, then **Feed Preferences**. Change a preference and scan again to see the result change.
9. Reload the app and tap **Continue**: you go straight to Home with your history, because the same browser keeps the same ID.

To start over as a brand-new user, clear the site's data in the browser (or use a private window).

The three **demo products** in the barcode/name sheet are fictional and are labelled *DEMO DATA* everywhere. They are never checked against openFDA.

---

## Architecture

```
assets/                 supplied logo + UI references (logo used as-is on the welcome screen)
shared/preferences.json preference catalog shared by frontend and backend
backend/app/
  main.py               FastAPI routes, consistent {"error": {code, message}} responses, rate limits
  identity.py           X-User-Id header → validated UUID; creates the profile on first request
  openrouter_client.py  vision identification (candidates only)
  off_client.py         Open Food Facts product lookup/search
  recall_client.py      openFDA food enforcement checks with a conservative matching policy
  verdict.py            deterministic rules → per-preference ratings + overall result
  insights.py           scan-derived stats and milestones (never claims purchases)
  daily_branch.py       curated, source-checked Daily Branch facts
  db.py                 SQLite, every query filtered by `user_id`
frontend/src/
  lib/identity.ts       creates/stores the anonymous ID; api.ts sends it as X-User-Id
  state/                profile, preferences draft (survives hub ↔ category navigation), scan session
  screens/              Welcome (Continue), Preferences hub/category, Home/History, Camera,
                        Results (E1 tree) / ResultDetails (E2), Insights, Profile/Edit Profile
  components/Tree.tsx   animated SVG tree on a continuous health spectrum
```

**How a verdict is made** ([verdict.py](backend/app/verdict.py)): each saved preference becomes one rating (green / yellow / red / gray) with its own sources. The overall result follows the spec's precedence:

- a verified recall or a confirmed hard-restriction conflict → **Strong Conflict**
- a hard restriction that can't be checked → **Insufficient Data**
- soft tradeoffs → **Mixed Fit**
- verified alignment → **Good Match**

The "preference-fit estimate" (0–100) only positions the tree on its spectrum. It is not a safety score.

### API

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/me` | Profile + preferences (created on first call) |
| PUT | `/api/me` | Update preferences, `onboarding_completed`, name, optional email/phone, photo |
| POST | `/api/scans/identify` | Multipart photo → candidate identity + Open Food Facts matches |
| GET | `/api/products/lookup?barcode=` / `?q=` | Barcode or name search |
| POST | `/api/scans/analyze` | Confirmed product → evidence, verdict, saved scan |
| GET | `/api/scans`, `/api/scans/{id}` | History / one scan (owner only) |
| DELETE | `/api/scans` | Clear history |
| GET | `/api/daily-branch` | Cited daily fact |
| GET | `/api/insights?days=30` | Scan-derived alignment, values, milestones |
| GET | `/api/demo/products` | Fictional demo products |

All routes except `/api/health` need an `X-User-Id` header containing a UUID; a missing or malformed ID returns `400` with `{"error": {"code": "missing_user_id" | "invalid_user_id", ...}}`. Data is only ever read or written for that ID. Costly endpoints are rate-limited per ID and per client IP, since anonymous IDs are free to rotate.

---

## Limitations

- **No real authentication** (see the note at the top). A profile lives with one browser: there is no sign-in, no way to move a profile to another device, and anyone who obtains the ID can access its data. Add real authentication before storing real people's data.
- **Product data is crowdsourced** (Open Food Facts) and can be incomplete or out of date. Allergy ratings tell users to check the physical label.
- **Recall coverage is FDA-only.** USDA-regulated meat, poultry and egg products aren't covered, and fuzzy brand matches are shown as "check your lot code", never as a confirmed recall.
- **Many ethical and environmental items show "Unknown"** when no certification or sourcing data exists. That is intentional: missing evidence is never shown as a positive.
- **Photos are not stored.** They are analyzed in memory and discarded; only product details, results and sources are saved.
- Favorites, language and display settings are not implemented, so those menu rows are hidden.
