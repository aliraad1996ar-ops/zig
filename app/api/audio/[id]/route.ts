import {db,failure,CURRENT_SEASON} from '@/lib/server';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;
  if(!/^[a-f0-9-]{36}$/.test(id))return new Response(null,{status:404});
  const row=await db().prepare('SELECT audio_data FROM players WHERE id=? AND attempts>0 AND score_season=?').bind(id,CURRENT_SEASON).first<{audio_data:string|null}>();
  if(!row?.audio_data)return new Response(null,{status:404});
  const data=base64ToBytes(row.audio_data).buffer;
  const headers=new Headers({'Content-Type':'audio/wav','Cache-Control':'public, max-age=0, must-revalidate','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Content-Disposition':'inline'});
  const range=req.headers.get('range');
  if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);if(!match||(!match[1]&&!match[2]))return new Response(null,{status:416,headers:{'Content-Range':`bytes */${data.byteLength}`}});const start=match[1]?Number(match[1]):Math.max(0,data.byteLength-Number(match[2]));const end=match[1]?(match[2]?Math.min(Number(match[2]),data.byteLength-1):data.byteLength-1):data.byteLength-1;if(start>end||start>=data.byteLength)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${data.byteLength}`}});headers.set('Content-Range',`bytes ${start}-${end}/${data.byteLength}`);headers.set('Content-Length',String(end-start+1));return new Response(data.slice(start,end+1),{status:206,headers})}
  headers.set('Content-Length',String(data.byteLength));return new Response(data,{headers});
 }catch(e){return failure(e)}
}
function base64ToBytes(value:string){const raw=atob(value),bytes=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);return bytes}
