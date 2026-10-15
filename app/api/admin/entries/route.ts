import {adminOK, CURRENT_SEASON, db, failure} from '@/lib/server';

export async function GET(req: Request) {
  try {
    if (!await adminOK(req)) return Response.json({error: 'سجّل دخول الأدمن.'}, {status: 401});
    const {results} = await db().prepare('SELECT id,name,best,last_attempt,CASE WHEN audio_data IS NOT NULL THEN 1 ELSE 0 END AS hasAudio FROM players WHERE attempts>0 AND score_season=? ORDER BY last_attempt DESC LIMIT 100').bind(CURRENT_SEASON).all();
    return Response.json({entries: results}, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) { return failure(error); }
}
