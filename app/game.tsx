"use client";
import {useState,useEffect,useRef} from 'react';
import {Mic,Square,ShieldCheck,RotateCcw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {prepareAudio, RECORDING_SECONDS} from '@/lib/recording';
type Player={id:string,name:string,best:number};
async function api(url:string,options?:RequestInit){const r=await fetch(url,options);const data=await r.json() as {error?:string;player:Player|null;players:Player[];score:number;best:number};if(!r.ok)throw Error(data.error||'تعذّر الاتصال. جرّب مرة ثانية.');return data}
export function Game(){const [player,setPlayer]=useState<Player|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[recording,setRecording]=useState(false),[seconds,setSeconds]=useState(3),[level,setLevel]=useState(0),[score,setScore]=useState<number|null>(null),[playback,setPlayback]=useState(''),[pending,setPending]=useState<ArrayBuffer|null>(null);const finish=useRef<()=>void>(()=>{}),cleanup=useRef<()=>void>(()=>{}),mounted=useRef(true);
useEffect(()=>{mounted.current=true;api('/api/register').then(d=>{if(mounted.current)setPlayer(d.player)}).catch(()=>{});return()=>{mounted.current=false;cleanup.current()}},[]);
useEffect(()=>()=>{if(playback)URL.revokeObjectURL(playback)},[playback]);
async function register(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setError('');setBusy(true);const f=new FormData(e.currentTarget);try{const d=await api('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(f))});setPlayer(d.player)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
async function save(buffer:ArrayBuffer){setBusy(true);setError('');try{const d=await api('/api/score',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:buffer});setScore(d.score);setPlayer(p=>p?{...p,best:d.best}:p);setPending(null);window.dispatchEvent(new Event('zeeg-score'))}catch(e){setError((e as Error).message);setPending(buffer)}finally{setBusy(false)}}
async function start() {
  setError(''); setScore(null); setPending(null); setPlayback(''); setBusy(true);
  let stream: MediaStream | undefined, ctx: AudioContext | undefined;
  let release = () => { stream?.getTracks().forEach(t => t.stop()); void ctx?.close(); };
  try {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw Error('المتصفح ما يدعم التسجيل. افتح الرابط بسفاري أو كروم.');
    ctx = new AudioContext();
    // Resume directly from the tap, before waiting for microphone permission.
    await ctx.resume();
    stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    if (!mounted.current) { release(); return; }
    const source = ctx.createMediaStreamSource(stream), analyser = ctx.createAnalyser();
    analyser.fftSize = 2048; source.connect(analyser);
    const mimeType = ['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? {mimeType} : undefined);
    const chunks: Blob[] = []; let done = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now(), meter = new Float32Array(analyser.fftSize);
    const timer = setInterval(() => {
      setSeconds(Math.max(0, RECORDING_SECONDS - Math.floor((Date.now()-started)/1000)));
      analyser.getFloatTimeDomainData(meter);
      setLevel(Math.min(1, Math.sqrt(meter.reduce((sum,v)=>sum+v*v,0)/meter.length)*7));
    }, 100);
    const stopInput = () => { clearInterval(timer); clearTimeout(timeout); source.disconnect(); analyser.disconnect(); stream?.getTracks().forEach(t=>t.stop()); };
    release = () => { stopInput(); if(ctx?.state !== 'closed') void ctx?.close(); };
    cleanup.current = () => { done = true; recorder.onstop = null; recorder.ondataavailable = null; recorder.onerror = null; if(recorder.state !== 'inactive') recorder.stop(); release(); };
    recorder.ondataavailable = event => { if(event.data.size) chunks.push(event.data); };
    recorder.onerror = () => { cleanup.current(); if(mounted.current){setRecording(false);setBusy(false);setError('تعذّر تسجيل الصوت. أعد المحاولة.');} };
    recorder.onstop = async () => {
      stopInput();
      if(!mounted.current) { release(); return; }
      setRecording(false); setBusy(true); setLevel(0);
      try {
        const blob = new Blob(chunks, {type:recorder.mimeType});
        if(!blob.size) throw Error('التسجيل فارغ. تأكد من المايك وأعد المحاولة.');
        const decoded = await ctx!.decodeAudioData(await blob.arrayBuffer());
        const {pcm,wav} = prepareAudio(Array.from({length:decoded.numberOfChannels},(_,i)=>decoded.getChannelData(i)),decoded.sampleRate);
        release();
        if(!mounted.current) return;
        setPlayback(URL.createObjectURL(new Blob([wav],{type:'audio/wav'})));
        await save(pcm.buffer);
      } catch(e) { release(); if(mounted.current){setError((e as Error).message);setBusy(false);} }
    };
    finish.current = () => { if(done) return; done=true; clearInterval(timer); clearTimeout(timeout); setRecording(false); setBusy(true); if(recorder.state!=='inactive') recorder.stop(); };
    recorder.start();
    timeout = setTimeout(()=>finish.current(), RECORDING_SECONDS * 1000);
    setSeconds(RECORDING_SECONDS); setRecording(true); setBusy(false);
  } catch(e) {
    release(); const err=e as Error;
    setError(err.name==='NotAllowedError'?'اسمح باستخدام المايك من إعدادات المتصفح، وبعدين جرّب.':err.name==='NotFoundError'?'ما لكينا مايك. وصّل مايك وجرّب.':err.message);
    setBusy(false);
  }
}

return <><div className="paneltop"><span>{player?'02 / وقت الزيج':'01 / دخول الحلبة'}</span><Mic/></div><h2>{player?`هلا ${player.name.split(' ')[0]}، سمعنا!`:'منو صاحب التحدّي؟'}</h2>{!player?<form onSubmit={register}><label>الاسم الثلاثي<Input name="name" required maxLength={100} placeholder="اكتب اسمك الثلاثي" autoComplete="name"/></label><label>الإيميل<Input name="email" required maxLength={254} type="email" placeholder="you@example.com" dir="ltr" autoComplete="email"/></label><label>رقم الهاتف <small>اختياري</small><Input name="phone" maxLength={25} type="tel" placeholder="07XX XXX XXXX" dir="ltr" autoComplete="tel"/></label><Button disabled={busy} className="primary" type="submit">{busy?'لحظة…':'ادخل التحدّي'} <Mic/></Button><p className="privacy"><ShieldCheck size={17}/> اسمك الثلاثي وسكورك يظهرن للناس.</p><p className="fineprint">نحفظ بيانات المشاركة. الإيميل والرقم ما ينعرضن للزوّار. هذا تسجيل مشاركة بدون تحقق من الإيميل.</p></form>:<div className="record"><p>{recording?`سجّل هسه… باقي ${seconds} ثواني`:score!==null?'هذا سكور زيجك!':'اضغط المايك وسجّل لمدة ٣ ثواني'}</p>{score!==null?<><div className="score">{score}<small>/100</small></div><p className="success">{score>=80?'زلزال بالحلبة!':score>=50?'زيج يستحق المنافسة!':score===0?'ما التقطنا صوت واضح.':'بداية حلوة… عندك أقوى؟'}</p><p>أعلى سكور إلك: {player.best}</p></>:<button aria-label={recording?'إيقاف التسجيل':'بدء تسجيل الزيج'} className={`recordbutton ${recording?'active':''}`} disabled={busy} onClick={()=>recording?finish.current():start()}>{recording?<Square/>:<Mic/>}</button>}{recording&&<div className="meter" aria-label="مستوى الصوت">{Array.from({length:25},(_,i)=><span key={i} style={{height:8+level*(15+Math.sin(i*2)*12+20)}}/>)}</div>}{busy&&<p role="status">جاري تجهيز أو تحليل التسجيل…</p>}{playback&&!recording&&<audio key={playback} controls preload="auto" src={playback} onPlay={e=>{e.currentTarget.muted=false;e.currentTarget.volume=1}} onError={()=>setError("تعذّر تشغيل التسجيل. أعد التسجيل أو افتح الرابط بسفاري أو كروم.")}/>}{score!==null&&<Button className="primary" onClick={start} disabled={busy}>جرّب زيج ثاني <RotateCcw/></Button>}{pending&&<Button className="primary" onClick={()=>save(pending)} disabled={busy}>إعادة محاولة حفظ السكور</Button>}<p className="fineprint">يُرسل الصوت للتحليل بدون حفظه. نقيس شدة الصوت؛ ما نميّز العفطة عن بقية الأصوات. اختلاف المايك والمسافة يأثر على السكور.</p></div>}{error&&<p className="error" role="alert">{error}</p>}</>}
export function Leaderboard(){const [rows,setRows]=useState<Player[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);async function refresh(){try{const d=await api('/api/leaderboard');setRows(d.players);setError('');return {players:d.players}}catch(e){setError((e as Error).message);throw e}finally{setLoading(false)}}useEffect(()=>{const update=()=>{void refresh().catch(()=>{})};update();window.addEventListener('zeeg-score',update);const interval=setInterval(update,30000);const controller=new AbortController();const context=(document as Document&{modelContext?:{registerTool:(tool:unknown,options:unknown)=>Promise<void>}}).modelContext;if(context)try{Promise.resolve(context.registerTool({name:'get_zeeg_leaderboard',description:'Read and refresh the public Zeeg leaderboard.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:(input:unknown)=>{if(!input||typeof input!=='object'||Object.keys(input).length)throw Error('Expected an empty object');return refresh()}},{signal:controller.signal})).catch(()=>{})}catch{}return()=>{clearInterval(interval);window.removeEventListener('zeeg-score',update);controller.abort()}},[]);return <div aria-live="polite">{error?<div className="error">{error} <button onClick={()=>void refresh().catch(()=>{})}>حاول مرة ثانية</button></div>:loading?<div className="empty">جاري تحميل النتائج…</div>:!rows.length?<div className="empty">الصدارة تنتظر أول بطل. يمكن تكون إنت!</div>:<ol className="boardlist">{rows.map((p,i)=><li className="leaderrow" key={p.id}><span className="rank">{String(i+1).padStart(2,'0')}</span><span>{p.name}</span><strong>{p.best}<small>/100</small></strong></li>)}</ol>}</div>}
