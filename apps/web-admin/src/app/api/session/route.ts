// apps/web-admin/src/app/api/session/route.ts · logout for the god-mode console (clears the httpOnly admin
// cookie). The IdP SSO callback that SETS the session lives separately; this only tears it down.
import { NextRequest, NextResponse } from 'next/server';
import { clearAdminSession } from '../../../lib/admin-auth';

export async function POST(req: NextRequest) {
  const form = await req.formData();
  if (form.get('_action') === 'logout') clearAdminSession();
  return NextResponse.redirect(new URL('/login', req.url), { status: 303 });
}
