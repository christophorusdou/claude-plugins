---
name: bedrock-auth
version: "0.3.0"
description: >-
  This skill should be used when the user needs to authenticate to AWS Bedrock
  using OIDC SSO, get Bedrock credentials via Cognito Identity Pool, call the
  Claude API through Bedrock, or integrate the bedrock-oidc-auth library into
  a Python project. Relevant for questions about bedrock auth, bedrock
  credentials, calling Claude via Bedrock, OIDC authentication, SSO
  credentials, Tyler Tech SSO, Cognito identity pool configuration, setting up
  a bedrock client, or using the Bedrock Converse API.
---

# Bedrock OIDC Auth — Integration Guide

Add OIDC SSO authentication for AWS Bedrock to any Python project using the `bedrock-oidc-auth` library.

## Auth Flow

```
OIDC Provider (OAuth 2.0 + PKCE) → id_token
  → AWS Cognito Identity Pool → temporary AWS credentials
  → boto3 Bedrock Runtime client
```

First run opens a browser for SSO login. Subsequent runs use cached credentials at `~/.bedrock-oidc-auth/cache/` (no browser needed until they expire).

## Step 1: Install the Library

Using uv (preferred):
```bash
uv add bedrock-oidc-auth --git https://github.com/chris-at-tyler/bedrock-oidc-auth.git
```

Using pip:
```bash
pip install git+https://github.com/chris-at-tyler/bedrock-oidc-auth.git
```

## Step 2: Create Config File

Create a `config.json` in the project root (or wherever appropriate):

```json
{
    "default": {
        "provider_domain": "sso.tylertech.com",
        "client_id": "0oasp7754vT0iuL4F4x7",
        "identity_pool_id": "us-west-2:7e22160a-5ea9-4b30-97a9-8822f4e3283c",
        "aws_region": "us-west-2"
    }
}
```

These are the Tyler Tech defaults. Override any field if needed (e.g., different OIDC provider or Cognito pool).

Multiple profiles are supported — add more top-level keys and select with `profile=`:
```python
config = AuthConfig.from_json("config.json", profile="staging")
```

**Note:** The JSON config supports `provider_domain`, `client_id`, `identity_pool_id`, and `aws_region` fields only. To customize `redirect_port` or `auth_timeout`, use inline `AuthConfig()` construction (see below).

**Important:** Add `config.json` to `.gitignore` if the project uses a different config path or has custom overrides. The values above are public OAuth config, not secrets.

## Step 3: Get a Bedrock Client and Call Claude

### Simple usage (one-shot):

```python
from bedrock_oidc_auth import AuthConfig, get_bedrock_client

config = AuthConfig.from_json("config.json")
client = get_bedrock_client(config)

response = client.converse(
    modelId="us.anthropic.claude-sonnet-4-6",
    messages=[{"role": "user", "content": [{"text": "Hello"}]}],
)
print(response["output"]["message"]["content"][0]["text"])
```

### Long-running apps (auto-refresh):

```python
from bedrock_oidc_auth import AuthConfig, BedrockAuth

config = AuthConfig.from_json("config.json")
auth = BedrockAuth(config)

# Call repeatedly — credentials auto-refresh when expired
client = auth.get_client()
response = client.converse(
    modelId="us.anthropic.claude-sonnet-4-6",
    messages=[{"role": "user", "content": [{"text": "Hello"}]}],
)

# Also available:
creds = auth.get_credentials()   # AWSCredentials dataclass
session = auth.get_session()     # boto3.Session

# Troubleshooting: force re-authentication
auth.clear_cache()
```

### Just get credentials (for custom boto3 usage):

```python
from bedrock_oidc_auth import AuthConfig, get_aws_credentials, get_boto3_session

config = AuthConfig.from_json("config.json")

# Option A: raw credentials
creds = get_aws_credentials(config)
print(creds.access_key_id, creds.secret_access_key, creds.session_token)
print(creds.is_expired)  # True if within 30s of expiry

# Option B: boto3 session (use for any AWS service)
session = get_boto3_session(config)
bedrock = session.client("bedrock-runtime", region_name="us-west-2")
```

### Inline config (no JSON file, full control):

```python
from bedrock_oidc_auth import AuthConfig, get_bedrock_client

config = AuthConfig(
    provider_domain="sso.tylertech.com",
    client_id="0oasp7754vT0iuL4F4x7",
    identity_pool_id="us-west-2:7e22160a-5ea9-4b30-97a9-8822f4e3283c",
    # Optional overrides (not available via JSON config):
    # redirect_port=8400,   # OAuth callback port
    # auth_timeout=300,     # SSO login timeout in seconds
)
client = get_bedrock_client(config)
```

## Available Models

Use these model IDs with `client.converse()` (prefix with `us.` for cross-region inference):

- `us.anthropic.claude-sonnet-4-6` — Claude Sonnet 4.6 (recommended default)
- `us.anthropic.claude-haiku-4-5-20251001-v1:0` — Claude Haiku 4.5 (faster, cheaper)
- `us.anthropic.claude-opus-4-6-v1` — Claude Opus 4.6 (most capable)
- `us.anthropic.claude-sonnet-4-5-20250929-v1:0` — Claude Sonnet 4.5
- `us.anthropic.claude-opus-4-5-20251101-v1:0` — Claude Opus 4.5

## Error Handling

```python
from bedrock_oidc_auth import (
    BedrockOidcAuthError,   # Base class — catch all library errors
    AuthenticationError,    # SSO login failed or timed out
    TokenExchangeError,     # Cognito credential exchange failed
    CredentialExpiredError,  # Credentials expired, need re-auth
    ConfigurationError,     # Invalid or missing config
)
```

## Notes

- Requires Python >= 3.10
- Dependencies: boto3, requests, PyJWT (installed automatically)
- Credentials are cached with a 30-second expiry buffer
- Thread-safe — `CredentialManager` uses locking for concurrent access
- OAuth callback server uses port 8400 by default (configurable via `redirect_port` in inline `AuthConfig()` only)
