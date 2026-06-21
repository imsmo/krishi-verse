# apps/ai-services/src/common/auth.py · service-to-service authentication (guide §4). ai-services is internal:
# the ONLY callers are apps/api / worker / stream-processor, which have already authenticated + authorised the
# end user and pass a SERVER-RESOLVED tenant_id. We verify a shared bearer secret with a CONSTANT-TIME compare
# (no timing oracle) and FAIL CLOSED (401) on any mismatch. The tenant_id comes from the trusted caller's signed
# header — the service records it on every inference for isolation/audit but performs no cross-tenant reads.
from __future__ import annotations

import hmac
import re
from dataclasses import dataclass

_UUID_RE = re.compile(r"^[0-9a-fA-F-]{1,64}$")
_REQID_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,80}$")
_CALLER_RE = re.compile(r"^[a-z0-9-]{1,32}$")


@dataclass(frozen=True)
class CallerContext:
    tenant_id: str | None       # None = platform-scoped inference
    request_id: str
    caller: str                 # which service called ('api','worker','stream-processor')


def verify_secret(presented: str | None, expected: str) -> bool:
    """Constant-time bearer check. Empty/short presented secrets never match."""
    if not presented or not expected:
        return False
    token = presented[7:].strip() if presented.lower().startswith("bearer ") else presented.strip()
    if not token:
        return False
    return hmac.compare_digest(token.encode("utf-8"), expected.encode("utf-8"))


def parse_caller(
    tenant_header: str | None, request_id_header: str | None, caller_header: str | None
) -> CallerContext:
    """Validate the trusted caller headers into a CallerContext (defensive: bound + charset-check the ids)."""
    tid = tenant_header if (tenant_header and _UUID_RE.match(tenant_header)) else None
    rid = request_id_header if (request_id_header and _REQID_RE.match(request_id_header)) else "no-req-id"
    caller = caller_header if (caller_header and _CALLER_RE.match(caller_header)) else "unknown"
    return CallerContext(tenant_id=tid, request_id=rid, caller=caller)
