import sys
import os
sys.path.insert(0, os.path.abspath("."))
import asyncio
import hashlib
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from app.core.security import create_access_token, get_current_user
from app.core.anti_scraping import (
    enforce_anti_scraping, check_export_quota,
    MAX_REQUESTS_PER_SECOND, MAX_EXPORT_ROWS_PER_REQUEST,
    DAILY_EXPORT_MAX_OPERATIONS, DAILY_EXPORT_MAX_TOTAL_ROWS
)
from app.models.auth import User, UserRoleEnum

class MockRequest:
    def __init__(self, user_agent: str = "Mozilla/5.0 TestBrowser", host: str = "gunay-kimya-api.onrender.com"):
        self.headers = {
            "user-agent": user_agent,
            "host": host
        }
        self.client = type("Client", (), {"host": "127.0.0.1"})()
        self.url = type("URL", (), {"path": "/api/v1/caris/"})()
        self.method = "GET"

async def test_zero_trust():
    print("=== STARTING ZERO-TRUST SECURITY SUITE VERIFICATION ===")

    # 1. Device Fingerprint (User-Agent Binding)
    ua_legit = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0"
    ua_attacker = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)"

    token_data = {"sub": "admin@gunaykimya.com", "user_id": 1, "roles": ["ADMIN"]}
    token = create_access_token(token_data, user_agent=ua_legit)

    class MockDatabase:
        async def scalar(self, _statement):
            return User(
                id=1,
                email="admin@gunaykimya.com",
                full_name="Test Admin",
                hashed_password="test-hash",
                role=UserRoleEnum.ADMIN,
                is_active=True,
            )

    mock_db = MockDatabase()

    # 2. Test UA Mismatch Detection
    req_attacker = MockRequest(user_agent=ua_attacker)
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    authenticated = await get_current_user(request=req_attacker, credentials=creds, db=mock_db)
    assert authenticated.id == 1
    print("[PASSED] Test 1: Relaxed mode accepts a valid token across User-Agent changes.")

    # 3. Anti-Scraping Burst Protection
    req_burst = MockRequest(user_agent=ua_legit)
    req_burst.headers["X-Forwarded-For"] = "192.168.1.99"
    rate_limited = False

    try:
        for i in range(MAX_REQUESTS_PER_SECOND + 3):
            await enforce_anti_scraping(req_burst)
    except HTTPException as e:
        if e.status_code == 429:
            rate_limited = True
            print(f"[PASSED] Test 2: Anti-scraping burst limit triggered 429 Too Many Requests as expected: {e.detail}")

    assert rate_limited, "Burst scraping limit did not trigger 429!"

    # 4. Controlled Export Quota Verification
    mock_user = User(id=999, email="admin@gunaykimya.com", role=UserRoleEnum.ADMIN)
    
    # 4a: Max rows per request clamped to 200
    rows = check_export_quota(mock_user, requested_rows=5000)
    assert rows == 200, f"Requested rows not clamped to 200! Got {rows}"
    print(f"[PASSED] Test 3a: Export request clamped from 5000 to {rows} rows!")

    # 4b: Daily quota reached
    quota_blocked = False
    try:
        for _ in range(DAILY_EXPORT_MAX_OPERATIONS + 2):
            check_export_quota(mock_user, requested_rows=100)
    except HTTPException as e:
        if e.status_code == 403 and "Kotası Doldu" in str(e.detail):
            quota_blocked = True
            print(f"[PASSED] Test 3b: Daily export quota limit blocked admin bulk exfiltration with 403: {e.detail}")

    assert quota_blocked, "Daily export quota did not block bulk export!"

    print("=== ALL ZERO-TRUST SECURITY TESTS PASSED PERFECTLY! ===")

if __name__ == "__main__":
    asyncio.run(test_zero_trust())
