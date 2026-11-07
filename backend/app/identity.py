"""Demo-grade anonymous identity. NOT authentication.

The browser generates a random UUID once, keeps it in localStorage and sends it as `X-User-Id`. Every profile
and scan query filters on that ID, so one browser only sees its own data. Anyone who learns an ID can act as that
user, so this must never protect real personal data.
"""

import re
from dataclasses import dataclass

from fastapi import Header, HTTPException

from . import db

USER_ID_HEADER = "X-User-Id"
UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")


@dataclass(frozen=True)
class CurrentUser:
    user_id: str


def _bad_request(code: str, message: str) -> HTTPException:
    return HTTPException(status_code=400, detail={"code": code, "message": message})


def current_user(x_user_id: str | None = Header(default=None, alias=USER_ID_HEADER)) -> CurrentUser:
    if not x_user_id or not x_user_id.strip():
        raise _bad_request("missing_user_id", f"The {USER_ID_HEADER} header is required.")
    user_id = x_user_id.strip().lower()
    if not UUID_RE.fullmatch(user_id):
        raise _bad_request("invalid_user_id", f"The {USER_ID_HEADER} header must be a UUID.")
    db.ensure_profile(user_id)  # the profile row is created on a user's first request
    return CurrentUser(user_id=user_id)
