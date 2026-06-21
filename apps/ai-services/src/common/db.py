# apps/ai-services/src/common/db.py · the async Postgres boundary. Defines a tiny Protocol the rest of the code
# depends on (so pure unit tests inject a fake and never need asyncpg), plus the real asyncpg-backed pool built
# at startup. ai-services writes ai_inferences ACROSS tenants (it's the producer of every AI decision), so it
# sets app.tenant_id per write — RLS then holds (defense-in-depth) and the row is correctly tenant-stamped. It
# performs NO cross-tenant READ of business data. asyncpg is imported lazily so importing this module (and the
# pure tests that touch the Protocol) never requires the driver to be installed.
from __future__ import annotations

from typing import Any, Protocol, Sequence


class Db(Protocol):
    async def execute(self, sql: str, params: Sequence[Any]) -> None: ...
    async def fetchrow(self, sql: str, params: Sequence[Any]) -> dict[str, Any] | None: ...
    async def with_tenant(self, tenant_id: str | None, sql: str, params: Sequence[Any]) -> None: ...


class AsyncpgDb:
    """Real pool. Lazy-imports asyncpg so this file is importable without the driver (tests use a fake Db)."""

    def __init__(self, dsn: str) -> None:
        self._dsn = dsn
        self._pool: Any = None

    async def connect(self) -> None:
        import asyncpg  # lazy: only the running service needs the driver

        self._pool = await asyncpg.create_pool(self._dsn, min_size=1, max_size=8, command_timeout=10)

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()

    async def execute(self, sql: str, params: Sequence[Any]) -> None:
        async with self._pool.acquire() as con:
            await con.execute(sql, *params)

    async def fetchrow(self, sql: str, params: Sequence[Any]) -> dict[str, Any] | None:
        async with self._pool.acquire() as con:
            row = await con.fetchrow(sql, *params)
            return dict(row) if row is not None else None

    async def with_tenant(self, tenant_id: str | None, sql: str, params: Sequence[Any]) -> None:
        async with self._pool.acquire() as con:
            async with con.transaction():
                await con.execute("SELECT set_config('app.tenant_id', $1, true)", tenant_id or "")
                await con.execute(sql, *params)
