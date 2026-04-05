from uuid import UUID

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt.exceptions import InvalidTokenError

from app.config import Settings, get_settings

_bearer = HTTPBearer(auto_error=False)


def get_user_id(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    settings: Settings = Depends(get_settings),
) -> UUID:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Missing bearer token")
    try:
        payload = jwt.decode(
            creds.credentials,
            settings.hnotebook_jwt_secret,
            algorithms=["HS256"],
        )
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=401, detail="Invalid token")
        return UUID(str(sub))
    except (InvalidTokenError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid token") from None
