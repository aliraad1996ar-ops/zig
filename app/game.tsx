"use client";
import {useState,useEffect,useRef} from 'react';
import {Mic,Square,ShieldCheck,RotateCcw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {prepareAudio, RECORDING_SECONDS} from '@/lib/recording';
type Player={id:string,name:string,best:number;hasAudio?:number;audioVersion?:number;score_season?:number};
async function api(url:string,options?:RequestInit){const r=await fetch(url,options);const data=await r.json() as {error?:string;player:Player|null;players:Player[];score:number;best:number};if(!r.ok)throw Error(data.error||'تعذّر الاتصال. جرّب مرة ثانية.');return data}
export function Game(){const [player,setPlayer]=useState<Player|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[recording,setRecording]=useState(false),[seconds,setSeconds]=useState(3),[level,setLevel]=useState(0),[score,setScore]=useState<number|null>(null),[playback,setPlayback]=useState(''),[pending,setPending]=useState<ArrayBuffer|null>(null);const finish=useRef<()=>void>(()=>{}),cleanup=useRef<()=>void>(()=>{}),mounted=useRef(true);
useEffect(()=>{mounted.current=true;api('/api/register').then(d=>{if(mounted.current)setPlayer(d.player)}).catch(()=>{});return()=>{mounted.current=false;cleanup.current()}},[]);
useEffect(()=>()=>{if(playback)URL.revokeObjectURL(playback)},[playback]);
async function register(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setError('');setBusy(true);const f=new FormData(e.currentTarget);try{const d=await api('/api/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(f))});setPlayer(d.player)}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
async function save(buffer:ArrayBuffer){setBusy(true);setError('');try{const d=await api('/api/score',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:buffer});setScore(d.score);setPlayer(p=>p?{...p,best:d.best}:p);setPending(null);window.dispatchEvent(new Event('zeeg-score'))}catch(e){setError((e as Error).message);setPending(buffer)}finally{setBusy(false)}}
async function start() {
  setError(''); setScore(null); setPending(null); setPlayback(''); setBusy(true);
  let stream: MediaStream | undefined, ctx: AudioContext | undefined;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Error('المتصفح ما يدعم التسجيل. افتح الرابط بسفاري أو كروم.');
    ctx = new AudioContext();
    await ctx.resume();
    stream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    if (!mounted.current) { stream.getTracks().forEach(track => track.stop()); await ctx.close(); return; }
    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    const silentOutput = ctx.createGain(); silentOutput.gain.value = 0;
    source.connect(processor); processor.connect(silentOutput); silentOutput.connect(ctx.destination);
    const frames: Float32Array[] = []; let complete = false;
    const stopInput = () => { processor.onaudioprocess = null; processor.disconnect(); source.disconnect(); silentOutput.disconnect(); stream?.getTracks().forEach(track => track.stop()); void ctx?.close(); };
    processor.onaudioprocess = event => {
      if (complete) return;
      const frame = event.inputBuffer.getChannelData(0).slice();
      frames.push(frame);
      setLevel(Math.min(1, Math.sqrt(frame.reduce((sum, value) => sum + value * value, 0) / frame.length) * 7));
    };
    const started = Date.now();
    const timer = setInterval(() => setSeconds(Math.max(0, RECORDING_SECONDS - Math.floor((Date.now() - started) / 1000))), 100);
    const finish = async () => {
      if (complete) return;
      complete = true; clearInterval(timer); setRecording(false); setBusy(true); setLevel(0);
      const sampleRate = ctx!.sampleRate;
      stopInput();
      try {
        const length = frames.reduce((total, frame) => total + frame.length, 0);
        if (!length) throw Error('ما وصل صوت من المايك. تأكد من صلاحية المايك وأعد المحاولة.');
        const captured = new Float32Array(length); let offset = 0;
        for (const frame of frames) { captured.set(frame, offset); offset += frame.length; }
        const {pcm, wav} = prepareAudio([captured], sampleRate);
        if (!mounted.current) return;
        setPlayback(URL.createObjectURL(new Blob([wav], {type:'audio/wav'})));
        await save(pcm.buffer);
      } catch (error) { if (mounted.current) { setError((error as Error).message); setBusy(false); } }
    };
    cleanup.current = () => { complete = true; clearInterval(timer); stopInput(); };
    finish.current = () => { void finish(); };
    setSeconds(RECORDING_SECONDS); setRecording(true); setBusy(false);
    window.setTimeout(() => { void finish(); }, RECORDING_SECONDS * 1000);
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop()); void ctx?.close();
    const err = error as Error;
    setError(err.name === 'NotAllowedError' ? 'اسمح باستخدام المايك من إعدادات المتصفح، وبعدين جرّب.' : err.name === 'NotFoundError' ? 'ما لكينا مايك. وصّل مايك وجرّب.' : err.message);
    setBusy(false);
  }
}

return <><div className="paneltop"><span>{player?'02 / وقت الزيج':'01 / دخول الحلبة'}</span><Mic/></div><h2>{player?`هلا ${player.name.split(' ')[0]}، سمعنا!`:'منو صاحب التحدّي؟'}</h2>{!player?<form onSubmit={register}><label>الاسم الثلاثي<Input name="name" required maxLength={100} placeholder="اكتب اسمك الثلاثي" autoComplete="name"/></label><label>الإيميل<Input name="email" required maxLength={254} type="email" placeholder="you@example.com" dir="ltr" autoComplete="email"/></label><label>رقم الهاتف <small>اختياري</small><Input name="phone" maxLength={25} type="tel" placeholder="07XX XXX XXXX" dir="ltr" autoComplete="tel"/></label><Button disabled={busy} className="primary" type="submit">{busy?'لحظة…':'ادخل التحدّي'} <Mic/></Button><p className="privacy"><ShieldCheck size={17}/> اسمك وسكورك وتسجيلك يصيرن متاحين للكل.</p><p className="fineprint">نحفظ بيانات المشاركة. الإيميل والرقم ما ينعرضن للزوّار. هذا تسجيل مشاركة بدون تحقق من الإيميل.</p></form>:<div className="record"><p>{recording?`سجّل هسه… باقي ${seconds} ثواني`:score!==null?'هذا سكور زيجك!':'اضغط المايك وسجّل لمدة ٣ ثواني'}</p>{score!==null?<><div className="score">{score.toLocaleString('en-US')}<small>/1,000,000</small></div><p className="success">{score>=700000?'زلزال بالحلبة!':score>=300000?'زيج يستحق المنافسة!':score===0?'ما التقطنا صوت واضح.':'بداية حلوة… عندك أقوى؟'}</p><p>أعلى سكور إلك: {player.best.toLocaleString('en-US')}</p></>:<button aria-label={recording?'إيقاف التسجيل':'بدء تسجيل الزيج'} className={`recordbutton ${recording?'active':''}`} disabled={busy} onClick={()=>recording?finish.current():start()}>{recording?<Square/>:<Mic/>}</button>}{recording&&<div className="meter" aria-label="مستوى الصوت">{Array.from({length:25},(_,i)=><span key={i} style={{height:8+level*(15+Math.sin(i*2)*12+20)}}/>)}</div>}{busy&&<p role="status">جاري تجهيز أو تحليل التسجيل…</p>}{playback&&!recording&&<audio key={playback} controls preload="auto" src={playback} onPlay={e=>{e.currentTarget.muted=false;e.currentTarget.volume=1}} onError={()=>setError("تعذّر تشغيل التسجيل. أعد التسجيل أو افتح الرابط بسفاري أو كروم.")}/>}{score!==null&&<Button className="primary" onClick={start} disabled={busy}>جرّب زيج ثاني <RotateCcw/></Button>}{pending&&<Button className="primary" onClick={()=>save(pending)} disabled={busy}>إعادة محاولة حفظ السكور</Button>}<p className="fineprint">ينحفظ تسجيل أعلى سكور إلك، والكل يكدر يسمعه بالسكور بورد. هذا موسم جديد، والسكور يوصل لمليون حسب قوة الزيج. نقيس شدة الصوت؛ ما نميّز العفطة عن بقية الأصوات حالياً. اختلاف المايك والمسافة يأثر على السكور.</p></div>}{error&&<p className="error" role="alert">{error}</p>}</>}
export function Leaderboard(){const [rows,setRows]=useState<Player[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);async function refresh(){try{const d=await api('/api/leaderboard');setRows(d.players);setError('');return {players:d.players}}catch(e){setError((e as Error).message);throw e}finally{setLoading(false)}}useEffect(()=>{const update=()=>{void refresh().catch(()=>{})};update();window.addEventListener('zeeg-score',update);const interval=setInterval(update,30000);const controller=new AbortController();const context=(document as Document&{modelContext?:{registerTool:(tool:unknown,options:unknown)=>Promise<void>}}).modelContext;if(context)try{Promise.resolve(context.registerTool({name:'get_zeeg_leaderboard',description:'Read and refresh the public Zeeg leaderboard.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:(input:unknown)=>{if(!input||typeof input!=='object'||Object.keys(input).length)throw Error('Expected an empty object');return refresh()}},{signal:controller.signal})).catch(()=>{})}catch{}return()=>{clearInterval(interval);window.removeEventListener('zeeg-score',update);controller.abort()}},[]);return <div aria-live="polite">{error?<div className="error">{error} <button onClick={()=>void refresh().catch(()=>{})}>حاول مرة ثانية</button></div>:loading?<div className="empty">جاري تحميل النتائج…</div>:!rows.length?<div className="empty">الصدارة انمسحت وتنتظر أول بطل بالموسم الجديد.</div>:<ol className="boardlist">{rows.map((p,i)=><li className="leaderrow" key={p.id}><span className="rank">{String(i+1).padStart(2,'0')}</span><span>{p.name}</span><strong>{p.best.toLocaleString('en-US')}<small>/1M</small></strong><div className="leaderaudio">{p.hasAudio?<BoardAudio id={p.id} name={p.name} version={p.audioVersion}/>:<span className="fineprint">التسجيل مو متوفر</span>}</div></li>)}</ol>}</div>}

function BoardAudio({id,name,version}:{id:string;name:string;version?:number}){const [failed,setFailed]=useState(false);return <>{failed?<span className="fineprint" role="status">تعذّر تحميل الصوت. <button className="secondarybutton" onClick={()=>setFailed(false)}>حاول مرة ثانية</button></span>:<audio controls preload="none" aria-label={`اسمع زيج ${name}`} src={`/api/audio/${encodeURIComponent(id)}?v=${version??0}`} onPlay={e=>{document.querySelectorAll('audio').forEach(a=>{if(a!==e.currentTarget)a.pause()});e.currentTarget.muted=false;e.currentTarget.volume=1}} onError={()=>setFailed(true)}/>}</>}
