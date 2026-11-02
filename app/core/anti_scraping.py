import time
import datetime
import logging
from typing import Dict, List, Tuple, Optional
from fastapi import Request, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.auth import User

logger = logging.getLogger("security.anti_scraping")

# -------------------------------------------------------------
# 1. Anti-Scraping Rate Limiter (Zero-Trust Thresholds)
# -------------------------------------------------------------
# Max 5 requests / second (burst protection)
# Max 60 requests / minute (sustained scraper protection)
MAX_REQUESTS_PER_SECOND = 5
MAX_REQUESTS_PER_MINUTE = 60

# In-memory sliding window caches (key -> list of timestamps)
_sec_windows: Dict[str, List[float]] = {}
_min_windows: Dict[str, List[float]] = {}
_locked_identifiers: Dict[str, float] = {}  # identifier -> lock_expiration_timestamp

# -------------------------------------------------------------
# 2. Controlled Export Quotas (Data Loss Prevention - DLP)
# -------------------------------------------------------------
MAX_EXPORT_ROWS_PER_REQUEST = 200
DAILY_EXPORT_MAX_OPERATIONS = 10
DAILY_EXPORT_MAX_TOTAL_ROWS = 1000

# Tracks (user_id, date_str) -> (operations_count, total_rows_exported)
_daily_export_tracker: Dict[Tuple[int, str], Tuple[int, int]] = {}

def get_client_identifier(request: Request, user_id: Optional[int] = None) -> str:
    """Derives a strict identifier: Authenticated user ID takes priority, otherwise client IP."""
    if user_id:
        return f"usr:{user_id}"

    # Try extracting user_id from Bearer token if present
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ", 1)[1]
        try:
            import jwt
            payload = jwt.decode(token, options={"verify_signature": False})
            uid = payload.get("user_id")
            if uid:
                return f"usr:{uid}"
        except Exception:
            pass

    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return f"ip:{forwarded.split(',')[0].strip()}"
    client_host = request.client.host if request.client else "unknown"
    return f"ip:{client_host}"

async def enforce_anti_scraping(
    request: Request,
    user: Optional[User] = None,
    db: Optional[AsyncSession] = None
) -> None:
    """
    CRITICAL SECURITY GUARD:
    Enforces strict rate limits on critical query/listing endpoints regardless of role (ADMIN included).
    If threshold is breached:
    1. Returns HTTP 429 Too Many Requests immediately.
    2. Puts the identifier in a temporary security lock.
    3. If user is authenticated, deactivates user account to halt automated scraping tools.
    """
    now = time.time()
    user_id = user.id if user else None
    ident = get_client_identifier(request, user_id)

    # 1. Check if identifier is currently in active security lockdown
    if ident in _locked_identifiers:
        lock_expires = _locked_identifiers[ident]
        if now < lock_expires:
            remaining = int(lock_expires - now)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Güvenlik Kilidi (Anti-Scraping): Olağandışı yoğun istek trafiği nedeniyle hesabınız geçici olarak kilitlendi. Kalan kilit süresi: {remaining} saniye."
            )
        else:
            del _locked_identifiers[ident]

    # 2. Clean up second sliding window
    sec_times = _sec_windows.setdefault(ident, [])
    sec_times = [t for t in sec_times if now - t < 1.0]
    _sec_windows[ident] = sec_times

    # 3. Clean up minute sliding window
    min_times = _min_windows.setdefault(ident, [])
    min_times = [t for t in min_times if now - t < 60.0]
    _min_windows[ident] = min_times

    # Check 1-second burst limit
    if len(sec_times) >= MAX_REQUESTS_PER_SECOND:
        _locked_identifiers[ident] = now + 300.0  # 5 minutes lockout
        logger.warning(f"[ANTI-SCRAPING BREACH] Burst limit exceeded by {ident}: {len(sec_times)} req/sec")
        if user and db:
            try:
                user.is_active = False
                await db.commit()
                logger.error(f"[SECURITY LOCKDOWN] Account '{user.email}' (ID: {user.id}) deactivated due to scraping burst.")
            except Exception as e:
                logger.error(f"Failed to lock user in DB: {e}")

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Güvenlik Kilidi: Saniyede izin verilen insan hızının üzerinde istek (Anti-Scraping) algılandı. Oturum sonlandırıldı ve hesap güvenlik korumasına alındı."
        )

    # Check 1-minute sustained limit
    if len(min_times) >= MAX_REQUESTS_PER_MINUTE:
        _locked_identifiers[ident] = now + 600.0  # 10 minutes lockout
        logger.warning(f"[ANTI-SCRAPING BREACH] Sustained limit exceeded by {ident}: {len(min_times)} req/min")
        if user and db:
            try:
                user.is_active = False
                await db.commit()
                logger.error(f"[SECURITY LOCKDOWN] Account '{user.email}' (ID: {user.id}) deactivated due to scraping frequency.")
            except Exception as e:
                logger.error(f"Failed to lock user in DB: {e}")

        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Güvenlik Kilidi: Dakikada izin verilen istek kotası aşıldı (Anti-Scraping). Hesabınız güvenlik korumasına alındı."
        )

    # Record current request timestamp
    sec_times.append(now)
    min_times.append(now)

def check_export_quota(user: User, requested_rows: int) -> int:
    """
    DLP CONTROLLED EXPORT:
    Clamps requested rows to MAX_EXPORT_ROWS_PER_REQUEST and verifies daily export quotas.
    Admins are strictly bound to this quota to prevent bulk exfiltration of the entire database.
    """
    effective_rows = min(requested_rows, MAX_EXPORT_ROWS_PER_REQUEST)
    today_str = datetime.date.today().isoformat()
    key = (user.id, today_str)

    current_ops, current_rows = _daily_export_tracker.get(key, (0, 0))

    if current_ops >= DAILY_EXPORT_MAX_OPERATIONS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Günlük Dışa Aktarım Kotası Doldu: Bugün için izin verilen maksimum {DAILY_EXPORT_MAX_OPERATIONS} adet export işlemine ulaştınız. Admin dahil kota aşılamaz."
        )

    if current_rows + effective_rows > DAILY_EXPORT_MAX_TOTAL_ROWS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Günlük Veri İndirme Kotası Doldu: Bugün için izin verilen maksimum {DAILY_EXPORT_MAX_TOTAL_ROWS} satır indirme sınırına ulaştınız. (Kullanılan: {current_rows} satır)."
        )

    # Update tracker
    _daily_export_tracker[key] = (current_ops + 1, current_rows + effective_rows)
    return effective_rows
