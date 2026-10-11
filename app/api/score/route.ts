import {db,player,originOK,failure,CURRENT_SEASON} from '@/lib/server';
import {calculateScore} from '@/lib/score';
import {prepareAudio} from '@/lib/recording';

export async function POST(req: Request) {
  try {
    if (!originOK(req)) return new Response(null, {status: 403});
    const participant = await player(req);
    if (!participant) return Response.json({error: 'سجّل معلوماتك أولاً.'}, {status: 401});
    if (req.headers.get('content-type') !== 'application/octet-stream') return new Response(null, {status: 415});
    if (Number(req.headers.get('content-length')) > 96000) return new Response(null, {status: 413});
    const reader = req.body?.getReader();
    if (!reader) return new Response(null, {status: 400});
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 96000) { await reader.cancel(); return new Response(null, {status: 413}); }
      chunks.push(value);
    }
    if (size < 32000 || size % 2) return Response.json({error: 'التسجيل قصير. جرّب تسجّل مرة ثانية.'}, {status: 400});
    const bytes = new Uint8Array(size); let position = 0;
    for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.length; }
    const pcm = new Int16Array(bytes.buffer), score = calculateScore(pcm), now = Date.now();
    if (participant.last_attempt >= now - 5000) return Response.json({error: 'انتظر شوية قبل المحاولة الجاية.'}, {status: 429});
    const previousBest = participant.score_season === CURRENT_SEASON ? participant.best : 0;
    const shouldReplaceAudio = score >= previousBest;
    const saved = await db().prepare('UPDATE players SET score_season=?,best=CASE WHEN ?>? THEN ? ELSE ? END,attempts=attempts+1,last_attempt=? WHERE id=? AND last_attempt<? RETURNING best').bind(CURRENT_SEASON, score, previousBest, score, previousBest, now, participant.id, now - 5000).first<{best: number}>();
    if (!saved) return Response.json({error: 'انتظر شوية قبل المحاولة الجاية.'}, {status: 429});
    if (shouldReplaceAudio) {
      try {
        const wav = prepareAudio([Float32Array.from(pcm, value => value / 32768)], 16000).wav;
        const data = bytesToBase64(new Uint8Array(wav));
        await db().prepare('UPDATE players SET audio_data=? WHERE id=? AND score_season=? AND best=?').bind(data, participant.id, CURRENT_SEASON, saved.best).run();
      } catch (error) {
        console.error('Audio storage failed; score remains saved', error);
      }
    }
    return Response.json({score, best: saved.best});
  } catch (error) { return failure(error); }
}

function bytesToBase64(bytes: Uint8Array) {
  let value = '';
  for (let index = 0; index < bytes.length; index += 8192) value += String.fromCharCode(...bytes.subarray(index, index + 8192));
  return btoa(value);
}
