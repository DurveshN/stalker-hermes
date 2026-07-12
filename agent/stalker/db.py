"""Postgres engine + session. No-op safe when Postgres isn't configured."""
from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from .config import settings
from .models import Base

_engine = None
_Session: sessionmaker | None = None


def _init_engine() -> None:
    global _engine, _Session
    if _engine is None and settings.pg_enabled:
        _engine = create_engine(settings.pg_url, pool_size=4, max_overflow=4, pool_pre_ping=True)
        _Session = sessionmaker(bind=_engine, expire_on_commit=False)


def init_db(retries: int = 3) -> None:
    """Create tables directly (dev/bootstrap). Prod uses Alembic migrations.
    Retries on transient connect blips (Azure Burstable can drop the first TLS)."""
    import time as _t
    _init_engine()
    if _engine is None:
        return
    for attempt in range(retries):
        try:
            Base.metadata.create_all(_engine)
            return
        except Exception as e:  # noqa: BLE001
            if attempt == retries - 1:
                raise
            print(f"[db] init retry {attempt + 1}/{retries} after: {str(e)[:80]}")
            _t.sleep(2)


@contextmanager
def session_scope() -> Iterator[Session | None]:
    """Yield a session, or None if Postgres is disabled (writes become no-ops)."""
    _init_engine()
    if _Session is None:
        yield None
        return
    s = _Session()
    try:
        yield s
        s.commit()
    except Exception:
        s.rollback()
        raise
    finally:
        s.close()
