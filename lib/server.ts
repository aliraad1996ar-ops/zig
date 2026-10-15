import {env} from 'cloudflare:workers';
export const CURRENT_SEASON = 2;
export function db(){if(!env.DB)throw Error('Database unavailable');return env.DB}
export async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('')}
export async function player(req:Request){const token=req.headers.get('cookie')?.match(/(?:^|;\s*)zeeg_session=([^;]+)/)?.[1];return token?db().prepare('SELECT id,name,best,last_attempt,score_season FROM players WHERE session_hash=?').bind(await hash(token)).first<{id:string,name:string,best:number,last_attempt:number,score_season:number}>():null}
export function originOK(req:Request){return req.headers.get('origin')===new URL(req.url).origin}
function adminPassword(){return (env as unknown as {ADMIN_PASSWORD?:string}).ADMIN_PASSWORD}
export async function adminOK(req:Request){const password=adminPassword();const token=req.headers.get('cookie')?.match(/(?:^|;\s*)zeeg_admin=([^;]+)/)?.[1];return Boolean(password&&token&&token===await hash(`admin:${password}`))}
export async function adminCookie(){const password=adminPassword();if(!password)throw Error('Admin password is not configured');return `zeeg_admin=${await hash(`admin:${password}`)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800; Secure`}
export function failure(e:unknown){console.error(e);return Response.json({error:'صار خلل بالحفظ. جرّب مرة ثانية.'},{status:503})}
