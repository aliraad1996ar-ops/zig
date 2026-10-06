import {env} from 'cloudflare:workers';
export function db(){if(!env.DB)throw Error('Database unavailable');return env.DB}
export async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
export async function player(req:Request){const token=req.headers.get('cookie')?.match(/(?:^|;\s*)zeeg_session=([^;]+)/)?.[1];return token?db().prepare('SELECT id,name,best,last_attempt FROM players WHERE session_hash=?').bind(await hash(token)).first<{id:string,name:string,best:number,last_attempt:number}>():null}
export function originOK(req:Request){return req.headers.get('origin')===new URL(req.url).origin}
export function failure(e:unknown){console.error(e);return Response.json({error:'صار خلل بالحفظ. جرّب مرة ثانية.'},{status:503})}

export function bucket(){if(!env.BUCKET)throw Error('Audio storage unavailable');return env.BUCKET}
