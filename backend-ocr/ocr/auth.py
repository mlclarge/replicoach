"""Supabase authentication and Premium authorization for the OCR API."""

from __future__ import annotations

import asyncio
import json
import os
from typing import Any, Dict, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import Depends, Header, HTTPException


def _supabase_settings() -> tuple[str, str]:
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    anon_key = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get(
        "VITE_SUPABASE_ANON_KEY"
    )
    if not supabase_url or not anon_key:
        raise HTTPException(
            status_code=503,
            detail="L'authentification Supabase n'est pas configurée sur le serveur OCR.",
        )
    return supabase_url.rstrip("/"), anon_key


def _supabase_get(path: str, access_token: str, anon_key: str) -> Any:
    request = Request(
        path,
        headers={
            "apikey": anon_key,
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
        },
        method="GET",
    )
    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read())
    except HTTPError as exc:
        if exc.code in (401, 403):
            raise HTTPException(
                status_code=401, detail="Session absente, invalide ou expirée."
            ) from exc
        raise HTTPException(
            status_code=503, detail="Vérification Supabase momentanément indisponible."
        ) from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise HTTPException(
            status_code=503, detail="Vérification Supabase momentanément indisponible."
        ) from exc


def _verify_access_token(access_token: str) -> Dict[str, Any]:
    supabase_url, anon_key = _supabase_settings()
    user = _supabase_get(
        f"{supabase_url}/auth/v1/user", access_token, anon_key
    )
    if not isinstance(user, dict) or not user.get("id"):
        raise HTTPException(status_code=401, detail="Session Supabase invalide.")
    return user


async def get_authenticated_user(
    authorization: Optional[str] = Header(default=None),
) -> Dict[str, Any]:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentification requise.")

    scheme, separator, access_token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not separator or not access_token.strip():
        raise HTTPException(
            status_code=401, detail="Un jeton Bearer Supabase est requis."
        )

    user = await asyncio.to_thread(_verify_access_token, access_token.strip())
    user["_access_token"] = access_token.strip()
    return user


def _is_premium_user(user: Dict[str, Any]) -> bool:
    supabase_url, anon_key = _supabase_settings()
    query = urlencode(
        {
            "id": f"eq.{user['id']}",
            "select": "is_premium",
        }
    )
    profiles = _supabase_get(
        f"{supabase_url}/rest/v1/profiles?{query}",
        user["_access_token"],
        anon_key,
    )
    if not isinstance(profiles, list):
        raise HTTPException(
            status_code=503, detail="Le profil Premium n'a pas pu être vérifié."
        )
    return any(
        isinstance(profile, dict) and profile.get("is_premium") is True
        for profile in profiles
    )


async def get_premium_user(
    user: Dict[str, Any] = Depends(get_authenticated_user),
) -> Dict[str, Any]:
    if not await asyncio.to_thread(_is_premium_user, user):
        raise HTTPException(
            status_code=403,
            detail="Cette fonctionnalité est réservée aux comptes Premium.",
        )
    return user
