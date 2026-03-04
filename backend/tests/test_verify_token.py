"""
Tests for _verify_entra_token in function_app.py.

These tests use locally generated RSA keys to create JWTs, then mock the
JWKS endpoint so that the function verifies signatures without hitting
the real Microsoft login endpoint.
"""
import json
import time
import pytest
from unittest.mock import patch, MagicMock

import jwt as pyjwt
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

# ---------------------------------------------------------------------------
# Fixtures: RSA key pair for signing test JWTs
# ---------------------------------------------------------------------------

TENANT_ID = "test-tenant-id"
CLIENT_ID = "00000000-1111-2222-3333-444444444444"
MS_GRAPH_AUD = "00000003-0000-0000-c000-000000000000"

_private_key = rsa.generate_private_key(
    public_exponent=65537, key_size=2048, backend=default_backend()
)
_public_key = _private_key.public_key()


def _make_token(payload: dict, headers: dict | None = None) -> str:
    """Create a signed JWT with the test RSA key."""
    return pyjwt.encode(payload, _private_key, algorithm="RS256", headers=headers)


def _base_payload(**overrides) -> dict:
    now = int(time.time())
    base = {
        "aud": CLIENT_ID,
        "iss": f"https://login.microsoftonline.com/{TENANT_ID}/v2.0",
        "tid": TENANT_ID,
        "sub": "user-oid-123",
        "oid": "user-oid-123",
        "name": "Test User",
        "preferred_username": "test@example.com",
        "iat": now - 60,
        "exp": now + 3600,
        "nbf": now - 60,
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Helper: import _verify_entra_token from function_app.py
# We need to mock the PyJWKClient so it returns our test signing key.
# ---------------------------------------------------------------------------

def _mock_jwks_client():
    """Return a mock PyJWKClient that returns the test public key."""
    mock_signing_key = MagicMock()
    mock_signing_key.key = _public_key
    mock_client = MagicMock()
    mock_client.get_signing_key_from_jwt.return_value = mock_signing_key
    return mock_client


def _call_verify(token: str, client_id: str = CLIENT_ID):
    """Call _verify_entra_token with mocked JWKS client."""
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

    # Mock all Azure SDK modules (not installed in test env)
    azure_mock = MagicMock()
    for mod_name in [
        "azure", "azure.functions", "azure.storage", "azure.storage.blob",
        "azure.core", "azure.core.exceptions", "azure.identity",
        "azure.identity.aio",
        "agents", "agents.flow_agent",
    ]:
        if mod_name not in sys.modules:
            sys.modules[mod_name] = azure_mock

    # Ensure ResourceNotFoundError is an actual exception class
    sys.modules["azure.core.exceptions"] = MagicMock(
        ResourceNotFoundError=type("ResourceNotFoundError", (Exception,), {})
    )

    # Invalidate cached module so mocks take effect on re-import
    sys.modules.pop("function_app", None)

    # We need to patch PyJWKClient inside the function (it's imported locally)
    with patch("jwt.PyJWKClient", return_value=_mock_jwks_client()):
        from function_app import _verify_entra_token
        return _verify_entra_token(token, client_id)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestVerifyEntraToken:
    """Tests for _verify_entra_token."""

    def test_valid_id_token_v2(self):
        """V2 ID token with aud=client_id should be accepted."""
        token = _make_token(_base_payload())
        payload = _call_verify(token)
        assert payload["aud"] == CLIENT_ID
        assert payload["preferred_username"] == "test@example.com"

    def test_valid_access_token_api_prefix(self):
        """Access token with aud=api://client_id should be accepted."""
        token = _make_token(_base_payload(aud=f"api://{CLIENT_ID}"))
        payload = _call_verify(token)
        assert payload["aud"] == f"api://{CLIENT_ID}"

    def test_valid_v1_issuer(self):
        """V1 token with sts.windows.net issuer should be accepted."""
        token = _make_token(_base_payload(
            iss=f"https://sts.windows.net/{TENANT_ID}/",
        ))
        payload = _call_verify(token)
        assert payload["aud"] == CLIENT_ID

    def test_graph_access_token_rejected(self):
        """Microsoft Graph access token should be rejected with clear message."""
        token = _make_token(_base_payload(aud=MS_GRAPH_AUD))
        with pytest.raises(ValueError, match="Microsoft Graph token"):
            _call_verify(token)

    def test_graph_url_audience_rejected(self):
        """Microsoft Graph URL audience should be rejected with clear message."""
        token = _make_token(_base_payload(aud="https://graph.microsoft.com"))
        with pytest.raises(ValueError, match="Microsoft Graph token"):
            _call_verify(token)

    def test_wrong_audience_shows_actual(self):
        """Wrong audience should include actual aud in error message."""
        wrong_aud = "99999999-0000-0000-0000-000000000000"
        token = _make_token(_base_payload(aud=wrong_aud))
        with pytest.raises(ValueError, match=wrong_aud):
            _call_verify(token)

    def test_invalid_token_format(self):
        """Malformed token should raise ValueError."""
        with pytest.raises(ValueError, match="Invalid token format"):
            _call_verify("not-a-jwt")

    def test_expired_token_rejected(self):
        """Expired token should be rejected."""
        now = int(time.time())
        token = _make_token(_base_payload(exp=now - 100))
        with pytest.raises(Exception):
            _call_verify(token)
