import asyncio
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from ocr import auth


class TestSupabaseAuthorization(unittest.TestCase):
    def test_missing_bearer_token_is_rejected(self):
        with self.assertRaises(HTTPException) as context:
            asyncio.run(auth.get_authenticated_user(None))

        self.assertEqual(context.exception.status_code, 401)

    def test_verified_user_keeps_token_for_rls_profile_lookup(self):
        with patch.object(auth, "_verify_access_token", return_value={"id": "user-id"}):
            user = asyncio.run(auth.get_authenticated_user("Bearer valid-token"))

        self.assertEqual(user["id"], "user-id")
        self.assertEqual(user["_access_token"], "valid-token")

    def test_profile_premium_status_is_read_with_user_token(self):
        with (
            patch.dict(
                os.environ,
                {
                    "SUPABASE_URL": "https://example.supabase.co",
                    "SUPABASE_ANON_KEY": "public-key",
                },
            ),
            patch.object(auth, "_supabase_get", return_value=[{"is_premium": True}]) as get,
        ):
            self.assertTrue(
                auth._is_premium_user(
                    {"id": "user-id", "_access_token": "user-access-token"}
                )
            )

        self.assertEqual(
            get.call_args.args,
            (
                "https://example.supabase.co/rest/v1/profiles?id=eq.user-id&select=is_premium",
                "user-access-token",
                "public-key",
            ),
        )

    def test_premium_dependency_rejects_non_premium_profile(self):
        with patch.object(auth, "_is_premium_user", return_value=False):
            with self.assertRaises(HTTPException) as context:
                asyncio.run(auth.get_premium_user({"id": "user-id"}))

        self.assertEqual(context.exception.status_code, 403)

    def test_missing_supabase_configuration_fails_closed(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(HTTPException) as context:
                auth._supabase_settings()

        self.assertEqual(context.exception.status_code, 503)


if __name__ == "__main__":
    unittest.main()
