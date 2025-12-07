# File with hardcoded secrets for testing detect-secrets
# NOTE: These are FAKE test values that resemble real secrets but are not valid
import requests

# Hardcoded API keys (detect-secrets should find these patterns)
# These are obviously fake placeholder values for testing only
API_KEY = "FAKE_API_KEY_abcdef1234567890abcdef"
AWS_SECRET_KEY = "FAKE_AWS_KEY_abcdefghijklmnopqrstuv"
DATABASE_PASSWORD = "FAKE_DB_PASSWORD_super_secret_123!"
GITHUB_TOKEN = "FAKE_GH_TOKEN_xxxxxxxxxxxxxxxxxxxx"

def connect_to_api():
    """Connect using hardcoded credentials."""
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "X-AWS-Secret": AWS_SECRET_KEY,
    }
    return requests.get("https://api.example.com/data", headers=headers)

def connect_to_database():
    """Connect to database with hardcoded password."""
    connection_string = f"postgresql://admin:{DATABASE_PASSWORD}@localhost:5432/mydb"
    return connection_string

# More secret-like patterns for testing
FAKE_STRIPE_KEY = "FAKE_STRIPE_abcdefghijklmnopqrst"
FAKE_SLACK_URL = "https://example.com/fake-webhook/XXXXXX/YYYYYY/ZZZZZZZZZZ"
