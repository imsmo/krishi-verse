// apps/web-admin/src/app/reports/regulator-export/route.ts · downloads the PII-free regulator/board snapshot
// (GET /v1/reports/regulator-export) as a JSON attachment. Runs server-side: requireAdmin gates, admin-client
// attaches the bearer server-side only, the window/currency query is normalised by the pure buildReportQuery
// (mirrors the admin-api schema). admin-api re-enforces owner perm; a 403 → 403 JSON (needsElevation), never a
// token leak. The snapshot is aggregate-only (no PII/per-row data) — admin-api guarantees `piiFree`.
import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuthenticated } from '../../../lib/admin-auth';
import { adminGet, AdminApiError } from '../../../lib/admin-client';
import { buildReportQuery } from '../../../features/reports/report';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isAdminAuthenticated()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const q = buildReportQuery({ from: sp.get('from') ?? undefined, to: sp.get('to') ?? undefined, currency: sp.get('currency') ?? undefined });

  try {
    const res = await adminGet<Record<string, unknown>>('reports/regulator-export', q);
    const body = JSON.stringify(res.data, null, 2);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'content-disposition': `attachment; filename="regulator-export-${stamp}.json"`,
        'cache-control': 'no-store',
      },
    });
  } catch (e) {
    const status = e instanceof AdminApiError ? e.status : 502;
    const error = e instanceof AdminApiError && e.needsElevation ? 'needsElevation' : 'unavailable';
    return NextResponse.json({ error }, { status });
  }
}
