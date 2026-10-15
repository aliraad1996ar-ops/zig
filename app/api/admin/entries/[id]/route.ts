import {adminOK, CURRENT_SEASON, db, failure, originOK} from '@/lib/server';

export async function DELETE(req: Request, context: {params: Promise<{id: string}>}) {
  try {
    if (!originOK(req) || !await adminOK(req)) return new Response(null, {status: 403});
    const {id} = await context.params;
    await db().prepare('UPDATE players SET best=0,attempts=0,audio_data=NULL WHERE id=? AND score_season=?').bind(id, CURRENT_SEASON).run();
    return Response.json({ok: true});
  } catch (error) { return failure(error); }
}
