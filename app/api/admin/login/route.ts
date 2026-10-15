import {adminCookie, failure, originOK} from '@/lib/server';
import {env} from 'cloudflare:workers';

export async function POST(req: Request) {
  try {
    if (!originOK(req)) return new Response(null, {status: 403});
    const body = await req.json() as {password?: unknown};
    const password = typeof body?.password === 'string' ? body.password : '';
    const configured = (env as unknown as {ADMIN_PASSWORD?: string}).ADMIN_PASSWORD;
    if (!configured || password !== configured) return Response.json({error: 'كلمة المرور غير صحيحة.'}, {status: 401});
    return Response.json({ok: true}, {headers: {'Set-Cookie': await adminCookie()}});
  } catch (error) { return failure(error); }
}
