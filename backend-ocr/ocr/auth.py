import os
import logging
from typing import Any, Dict
from fastapi import Header, HTTPException, status
import httpx

try:
    from dotenv import load_dotenv
except ImportError:
    def load_dotenv():
        pass

logger = logging.getLogger("replicoach.ocr_auth")

async def get_premium_user(authorization: str = Header(None)) -> Dict[str, Any]:
    """
    Vérifie le jeton JWT Bearer auprès de Supabase Auth.
    Lit dynamiquement l'environnement à chaque requête pour éviter les dépendances
    d'ordre d'importation avec load_dotenv().
    Permet un mode développement local si DISABLE_AUTH=true.
    """
    load_dotenv()

    supabase_url = os.environ.get("SUPABASE_URL", "")
    supabase_anon_key = os.environ.get("SUPABASE_ANON_KEY", "")
    disable_auth = os.environ.get("DISABLE_AUTH", "false").lower() in ("true", "1", "yes")

    if disable_auth:
        logger.info("Auth désactivée pour le développement local.")
        return {"id": "dev-user-local", "email": "dev@replicoach.local", "role": "authenticated"}

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Jeton d'authentification manquant ou invalide. Veuillez vous reconnecter."
        )

    token = authorization.split(" ")[1]

    if not supabase_url or not supabase_anon_key:
        logger.error("SUPABASE_URL ou SUPABASE_ANON_KEY absente dans backend-ocr/.env")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Erreur de configuration du serveur OCR (variables Supabase manquantes dans .env)."
        )

    url = f"{supabase_url.rstrip('/')}/auth/v1/user"
    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": supabase_anon_key
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=headers)

        if response.status_code == 200:
            return response.json()

        if response.status_code == 401:
            logger.warning(f"Jeton Supabase expiré ou invalide: {response.text}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Votre session a expiré. Veuillez vous déconnecter et vous reconnecter sur l'application."
            )

        logger.error(f"Supabase Auth error {response.status_code}: {response.text}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Vérification Supabase momentanément indisponible."
        )

    except httpx.RequestError as exc:
        logger.exception("Erreur de connexion lors de la vérification du jeton Supabase")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Impossible de joindre le serveur d'authentification Supabase. Vérifiez votre connexion internet."
        )
