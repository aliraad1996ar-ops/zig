import {db,failure} from '@/lib/server';
export async function GET(){try{const {results}=await db().prepare('SELECT id,name,best FROM players WHERE attempts>0 ORDER BY best DESC,created_at ASC LIMIT 50').all();return Response.json({players:results},{headers:{'Cache-Control':'no-store'}})}catch(e){return failure(e)}}
