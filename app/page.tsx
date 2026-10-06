"use client";
import { Game, Leaderboard } from "./game";
import { Mic, Trophy, AudioLines, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
export default function Home(){

 return <main><header><a className="brand" href="/"><AudioLines/> ملك الزيج<span>ZE EG / ARENA</span></a><span className="badge">تحدّي الصوت العراقي</span></header><div className="arena"><section className="intro"><span className="eyebrow">المايك إلك</span><h1>عفطة وحدة.<br/><em>مجد للأبد.</em></h1><p>سجّل زيجك، شوف قوّته، ونافس على الصدارة.</p><div className="steps"><span>١ · عرّف بنفسك</span><span>٢ · سجّل الزيج</span><span>٣ · خذ السكور</span></div><div className="note"><AudioLines size={28}/><p>نفس المسافة. نفس الفرصة.<small>خلّي المايك بعيد تقريباً ٢٠ سم، وسجّل بمكان هادئ.</small></p></div></section><section className="panel"><Game/></section></div><section className="board"><div className="boardhead"><div><span className="eyebrow">لوحة الشرف</span><h2><Trophy/> أقوى زيج</h2></div><span>أفضل نتيجة لكل مشارك</span></div><Leaderboard/></section><footer>ملك الزيج © ٢٠٢٦<span>تقييم للتسلية يعتمد على شدة التسجيل ونوع المايك.</span></footer></main>
}
