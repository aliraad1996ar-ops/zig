import {db, failure, CURRENT_SEASON} from '@/lib/server';

export async function GET() {
  try {
    const {results} = await db().prepare('SELECT id,name,best, CASE WHEN audio_data IS NOT NULL THEN 1 ELSE 0 END AS hasAudio,last_attempt AS audioVersion FROM players WHERE attempts>0 AND score_season=? ORDER BY best DESC,created_at ASC LIMIT 50').bind(CURRENT_SEASON).all();
    return Response.json({players: results}, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) { return failure(error); }
}
