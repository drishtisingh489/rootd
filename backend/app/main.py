"""root'd API. All /api routes except /api/health require an anonymous X-User-Id (see identity.py)."""

import logging
import re
import time
import uuid
from collections import defaultdict, deque
from contextlib import asynccontextmanager

import httpx
from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from . import daily_branch, db, demo_fixtures, insights, off_client, openrouter_client, recall_client
from .identity import USER_ID_HEADER, CurrentUser, current_user
from .catalog import normalize_preferences
from .config import settings
from .verdict import evaluate

log = logging.getLogger("uvicorn.error")  # shows up in the normal uvicorn console output


@asynccontextmanager
async def lifespan(_: FastAPI):
    db.init_db()
    # Paths and true/false only: never log key or model values.
    log.info("root'd config loaded from: %s", ", ".join(settings.env_files) or "no .env file found")
    if settings.openrouter_configured:
        log.info("OpenRouter photo identification: configured=true")
    else:
        log.warning("OpenRouter photo identification: configured=false (%s)", "; ".join(settings.openrouter_problems))
    yield


app = FastAPI(title="root'd API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", USER_ID_HEADER],
)


# ---- consistent JSON errors ---------------------------------------------------

def api_error(status: int, code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status, detail={"code": code, "message": message})


@app.exception_handler(HTTPException)
async def _http_error(_: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"code": "error", "message": str(exc.detail)}
    return JSONResponse({"error": detail}, status_code=exc.status_code, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def _validation_error(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in first.get("loc", [])[1:])
    return JSONResponse({"error": {"code": "invalid_input", "message": f"{field}: {first.get('msg', 'invalid')}"}},
                        status_code=422)


# ---- simple per-user rate limit for costly endpoints ------------------------------

_hits: dict[str, deque] = defaultdict(deque)


def rate_limit(request: Request, user: CurrentUser, bucket: str, limit: int = 20, window: float = 60.0) -> None:
    """Per-user and per-IP limits: anonymous IDs are free to rotate, so the IP bucket is what really caps cost."""
    now = time.monotonic()
    client_ip = request.client.host if request.client else "unknown"
    for key, cap in ((f"{bucket}:user:{user.user_id}", limit), (f"{bucket}:ip:{client_ip}", limit * 3)):
        q = _hits[key]
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= cap:
            raise api_error(429, "rate_limited", "Too many scans in a short time. Please wait a minute.")
    for key in (f"{bucket}:user:{user.user_id}", f"{bucket}:ip:{client_ip}"):
        _hits[key].append(now)


# ---- public ---------------------------------------------------------------

@app.get("/api/health")
def health():
    return {"status": "ok", "openrouter_configured": settings.openrouter_configured}


# ---- profile --------------------------------------------------------------

def _profile_response(profile: dict) -> dict:
    return {
        **{k: v for k, v in profile.items() if k != "user_id"},
        "preferences": normalize_preferences(profile["preferences"]),
    }


@app.get("/api/me")
def get_me(user: CurrentUser = Depends(current_user)):
    return _profile_response(db.get_profile(user.user_id))


IMAGE_DATA_URL = re.compile(r"^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$")
EMAIL_RE = re.compile(r"[^@\s]+@[^@\s]+\.[^@\s]+")


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=60)
    email: str | None = Field(default=None, max_length=254)
    phone: str | None = Field(default=None, max_length=32)
    profile_image_url: str | None = Field(default=None, max_length=400_000)
    preferences: dict | None = None
    onboarding_completed: bool | None = None


@app.put("/api/me")
def put_me(body: ProfileUpdate, user: CurrentUser = Depends(current_user)):
    fields = body.model_dump(exclude_unset=True)

    if "phone" in fields and fields["phone"] and not re.fullmatch(r"\+?[\d\s().-]{6,32}", fields["phone"]):
        raise api_error(422, "invalid_input", "Phone number can contain digits, spaces, +, -, ( and ).")
    if "display_name" in fields:
        fields["display_name"] = (fields["display_name"] or "").strip()
    if "email" in fields:
        # Optional contact detail stored with the profile. It has no sign-in meaning.
        fields["email"] = (fields["email"] or "").strip()
        if fields["email"] and not EMAIL_RE.fullmatch(fields["email"]):
            raise api_error(422, "invalid_input", "Please enter a valid email address, or leave it blank.")
    if fields.get("profile_image_url"):
        url = fields["profile_image_url"]
        if not (IMAGE_DATA_URL.match(url) or url.startswith("https://")):
            raise api_error(422, "invalid_input", "Profile picture must be a JPG/PNG/WEBP image.")
    if "preferences" in fields:
        fields["preferences"] = normalize_preferences(fields["preferences"])

    return _profile_response(db.update_profile(user.user_id, fields))


# ---- scanning ---------------------------------------------------------------

def _match_summary(ev: dict) -> dict:
    return {
        "name": ev["name"], "brand": ev["brand"], "barcode": ev["barcode"], "package_size": ev["package_size"],
        "image_url": ev["image_url"], "source_url": ev["source_url"],
    }


@app.post("/api/scans/identify")
async def identify(request: Request, file: UploadFile = File(...), user: CurrentUser = Depends(current_user)):
    rate_limit(request, user, "identify")
    data = await file.read(settings.max_upload_bytes + 1)
    try:
        image_url = openrouter_client.normalize_image(data, file.content_type, settings.max_upload_bytes)
    except openrouter_client.InvalidImage as exc:
        raise api_error(422, "invalid_image", str(exc))
    try:
        ident = await openrouter_client.identify(image_url, settings)
    except openrouter_client.VisionUnavailable as exc:
        raise api_error(503, "vision_unavailable",
                        f"Photo identification isn't configured: {exc} (add it to .env and restart the backend). "
                        "Meanwhile, enter a barcode or product name, or try a demo product.")
    except openrouter_client.VisionError as exc:
        log.warning("OpenRouter identify failed: %s", exc)  # already redacted
        raise api_error(502, "vision_failed", f"{exc} You can enter a barcode or product name instead.")
    # The photo is only held in memory for this request; it is never written to disk or the database.

    matches: list[dict] = []
    if ident["candidates"]:
        top = ident["candidates"][0]
        async with httpx.AsyncClient(timeout=12) as client:
            try:
                if top.get("barcode"):
                    found = await off_client.get_product(top["barcode"], client)
                    matches = [found] if found else []
                if not matches:
                    query = " ".join(x for x in (top.get("brand"), top.get("name"), top.get("variant")) if x)
                    matches = await off_client.search_products(query, client, limit=4)
            except off_client.OFFError:
                matches = []
    return {"identification": ident, "matches": [_match_summary(m) for m in matches]}


@app.get("/api/products/lookup")
async def lookup(request: Request, barcode: str | None = None, q: str | None = Query(default=None, max_length=120),
                 user: CurrentUser = Depends(current_user)):
    rate_limit(request, user, "lookup", limit=30)
    async with httpx.AsyncClient(timeout=12) as client:
        try:
            if barcode:
                code = off_client.clean_barcode(barcode)
                if not code:
                    raise api_error(422, "invalid_input", "A barcode should be 8–14 digits.")
                found = await off_client.get_product(code, client)
                return {"matches": [_match_summary(found)] if found else []}
            if q:
                return {"matches": [_match_summary(m) for m in await off_client.search_products(q, client)]}
        except off_client.OFFError as exc:
            raise api_error(502, "lookup_failed", f"{exc}. Please try again.")
    raise api_error(422, "invalid_input", "Provide a barcode or search text.")


@app.get("/api/demo/products")
def demo_products(_: CurrentUser = Depends(current_user)):
    return {"products": demo_fixtures.list_fixtures()}


class AnalyzeRequest(BaseModel):
    name: str = Field(default="", max_length=120)
    brand: str = Field(default="", max_length=80)
    barcode: str | None = Field(default=None, max_length=20)
    package_size: str | None = Field(default=None, max_length=40)
    variant: str | None = Field(default=None, max_length=80)
    visible_ingredients: str | None = Field(default=None, max_length=2000)
    demo_fixture_id: str | None = None


@app.post("/api/scans/analyze")
async def analyze(request: Request, body: AnalyzeRequest, user: CurrentUser = Depends(current_user)):
    rate_limit(request, user, "analyze")
    profile = db.get_profile(user.user_id)
    prefs = normalize_preferences(profile["preferences"])
    is_demo = bool(body.demo_fixture_id)

    if is_demo:
        ev = demo_fixtures.get_fixture(body.demo_fixture_id or "")
        if not ev:
            raise api_error(404, "not_found", "Unknown demo product.")
        recall = {**demo_fixtures.DEMO_RECALL, "checked_at": db.now_iso()}
    else:
        if not (body.name.strip() or body.brand.strip() or body.barcode):
            raise api_error(422, "invalid_input", "Confirm a product name, brand or barcode first.")
        barcode = off_client.clean_barcode(body.barcode)
        ev = None
        async with httpx.AsyncClient(timeout=15) as client:
            if barcode:
                try:
                    ev = await off_client.get_product(barcode, client)
                except off_client.OFFError:
                    ev = None
            if ev is None:
                # No product record: evaluate only what the user confirmed and the photo showed.
                ev = {
                    "source": "photo_label" if body.visible_ingredients else "none",
                    "source_title": "Your confirmed product details",
                    "publisher": "root'd",
                    "source_url": None,
                    "checked_at": db.now_iso(),
                    "name": body.name.strip(), "brand": body.brand.strip(), "barcode": barcode,
                    "package_size": body.package_size, "image_url": None, "ingredients_text": None,
                    "allergens_tags": [], "traces_tags": [], "analysis_tags": [], "labels_tags": [],
                    "categories_tags": [], "nutriments": {}, "nutriscore_grade": None, "nova_group": None,
                    "environmental_grade": None, "packagings": [], "origins": None,
                }
            if body.visible_ingredients and not ev.get("ingredients_text"):
                ev["ingredients_from_photo"] = body.visible_ingredients
            recall = await recall_client.check_recalls(
                client, name=ev.get("name") or body.name, brand=ev.get("brand") or body.brand,
                barcode=ev.get("barcode"), api_key=settings.openfda_api_key,
            )

    result = evaluate(ev, prefs, recall)
    scan = {
        "scan_id": f"scan_{uuid.uuid4().hex[:12]}",
        "product": {
            "name": ev.get("name") or body.name,
            "brand": ev.get("brand") or body.brand,
            "barcode": ev.get("barcode"),
            "package_size": ev.get("package_size") or body.package_size,
            "variant": body.variant,
            "image_url": ev.get("image_url"),
            "identity_confirmed": True,
            "data_source": ev.get("source"),
            "source_url": ev.get("source_url"),
        },
        **result,
        "recall_check": recall,
        "is_demo": is_demo,
        "created_at": db.now_iso(),
    }
    db.save_scan(user.user_id, scan)
    return scan


@app.get("/api/scans")
def list_scans(user: CurrentUser = Depends(current_user)):
    return {"scans": db.list_scans(user.user_id)}


@app.get("/api/scans/{scan_id}")
def get_scan(scan_id: str, user: CurrentUser = Depends(current_user)):
    scan = db.get_scan(user.user_id, scan_id)
    if not scan:
        raise api_error(404, "not_found", "Scan not found.")
    return scan


@app.delete("/api/scans")
def clear_scans(user: CurrentUser = Depends(current_user)):
    return {"deleted": db.delete_scans(user.user_id)}


# ---- home & insights ----------------------------------------------------------

@app.get("/api/daily-branch")
def get_daily_branch(user: CurrentUser = Depends(current_user)):
    profile = db.get_profile(user.user_id)
    prefs = normalize_preferences(profile["preferences"] if profile else {})
    return daily_branch.pick(db.list_scans(user.user_id), prefs)


@app.get("/api/insights")
def get_insights(days: int = Query(default=30, ge=1, le=365), user: CurrentUser = Depends(current_user)):
    profile = db.get_profile(user.user_id)
    prefs = normalize_preferences(profile["preferences"] if profile else {})
    return insights.compute(db.list_scans(user.user_id), prefs, days)
