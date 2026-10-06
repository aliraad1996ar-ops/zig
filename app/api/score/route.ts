import {db,player,originOK,failure,bucket} from '@/lib/server';
import {calculateScore} from '@/lib/score';
import {prepareAudio} from '@/lib/recording';
export async function POST(req:Request){
 try {
  if(!originOK(req))return new Response(null,{status:403});
  const p=await player(req);if(!p)return Response.json({error:'سجّل معلوماتك أولاً.'},{status:401});
  if(req.headers.get('content-type')!=='application/octet-stream')return new Response(null,{status:415});
  if(Number(req.headers.get('content-length'))>96000)return new Response(null,{status:413});
  const reader=req.body?.getReader();if(!reader)return new Response(null,{status:400});
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>96000){await reader.cancel();return new Response(null,{status:413})}chunks.push(value)}
  if(size<32000||size%2)return Response.json({error:'التسجيل قصير. جرّب تسجّل مرة ثانية.'},{status:400});
  const bytes=new Uint8Array(size);let pos=0;for(const c of chunks){bytes.set(c,pos);pos+=c.length}
  const pcm=new Int16Array(bytes.buffer),score=calculateScore(pcm),now=Date.now();
  if(p.last_attempt>=now-5000)return Response.json({error:'انتظر شوية قبل المحاولة الجاية.'},{status:429});
  const previous=await db().prepare('SELECT audio_key FROM players WHERE id=?').bind(p.id).first<{audio_key:string|null}>();
  let key:string|null=null;
  if(score>=p.best){
   let wav:ArrayBuffer;try{wav=prepareAudio([Float32Array.from(pcm,x=>x/32768)],16000).wav}catch{return Response.json({error:'ما وصل صوت واضح. أعد التسجيل.'},{status:400})}
   key=`recordings/${p.id}/${crypto.randomUUID()}.wav`;
   await bucket().put(key,wav,{httpMetadata:{contentType:'audio/wav'}});
  }
  const saved=await db().prepare('UPDATE players SET audio_key=CASE WHEN ?>=best AND ? IS NOT NULL THEN ? ELSE audio_key END,best=MAX(best,?),attempts=attempts+1,last_attempt=? WHERE id=? AND last_attempt<? RETURNING best,audio_key').bind(score,key,key,score,now,p.id,now-5000).first<{best:number;audio_key:string|null}>();
  if(!saved){if(key)await bucket().delete(key);return Response.json({error:'انتظر شوية قبل المحاولة الجاية.'},{status:429})}
  // Storage cleanup must not turn a successfully saved result into a failed attempt.
  try{if(key&&saved.audio_key!==key)await bucket().delete(key);if(key&&saved.audio_key===key&&previous?.audio_key&&previous.audio_key!==key)await bucket().delete(previous.audio_key)}catch(e){console.error('Audio cleanup failed',e)}
  return Response.json({score,best:saved.best});
 }catch(e){return failure(e)}
}
