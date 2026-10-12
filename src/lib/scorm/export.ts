import "server-only";
import JSZip from "jszip";
import { createClient } from "@/lib/supabase/server";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type ScoCourse = {
  id: string;
  title: string;
  description: string | null;
  slides: Array<{ title: string; layout: string; bullets: string[]; notes: string | null; module: string }>;
  quiz: {
    title: string;
    passMark: number;
    questions: Array<{ id: string; type: string; stem: string; options: Array<{ id: string; text: string }>; correct: string[]; explanation: string | null }>;
  } | null;
};

/** Loads a course with its quiz answers (staff only via RLS) into the shape the SCO embeds. */
export async function loadScoCourse(courseId: string): Promise<ScoCourse | null> {
  const supabase = await createClient();
  type Raw = {
    id: string; title: string; description: string | null;
    modules: Array<{ position: number; title: string; slides: Array<{ position: number; layout: string; title: string; bullets: unknown; speaker_notes: string | null }> }> | null;
    quizzes: Array<{ title: string; pass_mark: number; questions: Array<{ id: string; position: number; type: string; stem: string; options: Array<{ id: string; text: string }>; correct: string[]; explanation: string | null }> }> | null;
  };
  const { data } = (await supabase
    .from("courses")
    .select("id, title, description, modules(position, title, slides(position, layout, title, bullets, speaker_notes)), quizzes(title, pass_mark, questions(id, position, type, stem, options, correct, explanation))")
    .eq("id", courseId)
    .maybeSingle()) as unknown as { data: Raw | null };
  if (!data) return null;

  const slides = (data.modules ?? [])
    .sort((a, b) => a.position - b.position)
    .flatMap((m) =>
      [...m.slides].sort((a, b) => a.position - b.position).map((s) => ({
        title: s.title, layout: s.layout, bullets: Array.isArray(s.bullets) ? (s.bullets as string[]) : [], notes: s.speaker_notes, module: m.title,
      })),
    );
  const q = data.quizzes?.[0];
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    slides,
    quiz: q
      ? { title: q.title, passMark: q.pass_mark, questions: [...q.questions].sort((a, b) => a.position - b.position).filter((x) => ["single", "multiple", "truefalse"].includes(x.type)) }
      : null,
  };
}

export function buildManifest12(course: ScoCourse) {
  const id = `ITV-${course.id}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${id}" version="1.0"
  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="ORG-1">
    <organization identifier="ORG-1">
      <title>${esc(course.title)}</title>
      <item identifier="ITEM-1" identifierref="RES-1" isvisible="true">
        <title>${esc(course.title)}</title>
        ${course.quiz ? `<adlcp:masteryscore>${course.quiz.passMark}</adlcp:masteryscore>` : ""}
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <file href="course.json"/>
    </resource>
  </resources>
</manifest>
`;
}

/** Self-contained SCO: slide player + quiz + SCORM 1.2 API wrapper. No external assets. */
export function buildScoHtml(course: ScoCourse) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(course.title)}</title>
<style>
  :root{--violet:#4d53e0;--navy:#16365f;--bg:#f7f8fb;--muted:#6b859e;--green:#43bc13;--pink:#ff5668;--yellow:#ffc405}
  *{box-sizing:border-box}body{margin:0;font-family:Poppins,system-ui,Segoe UI,Roboto,sans-serif;background:var(--bg);color:var(--navy)}
  .wrap{max-width:1100px;margin:0 auto;padding:20px}
  .top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}
  .top h1{font-size:18px;margin:0}.muted{color:var(--muted);font-size:13px}
  .bar{height:6px;background:#e9ecef;border-radius:999px;overflow:hidden;width:200px}.bar i{display:block;height:100%;background:var(--violet);width:0}
  .stage{aspect-ratio:16/9;background:#fff;border-radius:10px;box-shadow:4px 4px 16px rgba(77,83,224,.2);padding:40px;display:flex;flex-direction:column;overflow:hidden}
  .stage.title{background:linear-gradient(135deg,var(--navy),#2f33a7,var(--violet));color:#fff;justify-content:flex-end}
  .stage.summary{background:#eef0ff}.stage h2{font-size:28px;margin:0 0 6px}.stage.title h2{font-size:40px}
  .line{height:4px;width:56px;background:var(--violet);border-radius:999px;margin-bottom:18px}
  .stage ul{margin:0;padding:0;list-style:none;font-size:18px;line-height:1.5}.stage li{display:flex;gap:10px;margin:6px 0}.stage li:before{content:"";width:8px;height:8px;border-radius:50%;background:var(--violet);margin-top:11px;flex:none}
  .stage.summary li:before{background:var(--green)}.stage.title li:before{display:none}.stage.title ul{opacity:.85;font-size:18px}
  .ctrl{display:flex;gap:8px;align-items:center;margin-top:12px;background:#fff;border-radius:10px;padding:10px 12px}
  button{font:inherit;border:0;border-radius:8px;padding:9px 16px;cursor:pointer;background:#eef0ff;color:var(--navy)}button.p{background:var(--violet);color:#fff}button:disabled{opacity:.4;cursor:default}
  .notes{background:#fff;border-radius:10px;padding:14px 16px;margin-top:12px;font-size:14px;line-height:1.6}
  .quiz{background:#fff;border-radius:10px;padding:24px;margin-top:12px}.q{margin:0 0 18px}.q p{font-weight:600;margin:0 0 8px}.q label{display:block;padding:6px 10px;border-radius:8px;cursor:pointer}.q label:hover{background:var(--bg)}
  .ok{color:var(--green)}.ko{color:var(--pink)}.res{font-size:22px;font-weight:700}
</style>
</head>
<body>
<div class="wrap">
  <div class="top"><div><h1 id="t"></h1><div class="muted" id="m"></div></div><div class="bar"><i id="pb"></i></div></div>
  <div id="view"></div>
</div>
<script id="course" type="application/json">${JSON.stringify({ title: course.title, slides: course.slides, quiz: course.quiz }).replace(/</g, "\\u003c")}</script>
<script>
(function(){
  var C = JSON.parse(document.getElementById('course').textContent);
  // ---- SCORM 1.2 API discovery (parent chain, then opener) ----
  function findAPI(win){var n=0;while(win&&!win.API&&win.parent&&win.parent!==win&&n<10){win=win.parent;n++;}return win&&win.API||null;}
  var API=findAPI(window)||(window.opener&&findAPI(window.opener))||null;
  var started=false, t0=Date.now();
  function set(k,v){ if(API) try{API.LMSSetValue(k,String(v));}catch(e){} }
  function get(k){ if(API) try{return API.LMSGetValue(k);}catch(e){} return ''; }
  function commit(){ if(API) try{API.LMSCommit('');}catch(e){} }
  function init(){ if(API&&!started){ try{API.LMSInitialize('');}catch(e){} started=true; var st=get('cmi.core.lesson_status'); if(!st||st==='not attempted') set('cmi.core.lesson_status','incomplete'); } }
  function sessionTime(){var s=Math.floor((Date.now()-t0)/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),x=s%60;function z(n){return (n<10?'0':'')+n}return z(h)+':'+z(m)+':'+z(x)+'.00';}
  function finish(){ if(API&&started){ set('cmi.core.session_time',sessionTime()); commit(); try{API.LMSFinish('');}catch(e){} started=false; } }
  window.addEventListener('beforeunload',finish); window.addEventListener('unload',finish);
  init();

  // ---- state ----
  var total=C.slides.length+(C.quiz?1:0), i=0, seen={}, view=document.getElementById('view');
  try{ var sd=get('cmi.suspend_data'); if(sd){ var o=JSON.parse(sd); i=Math.min(o.i||0,C.slides.length-1); seen=o.seen||{}; } }catch(e){}
  document.getElementById('t').textContent=C.title;

  function save(){ set('cmi.suspend_data',JSON.stringify({i:i,seen:seen})); set('cmi.core.lesson_location',String(i)); commit(); }
  function progress(){ var n=Object.keys(seen).length; document.getElementById('pb').style.width=Math.round(100*n/total)+'%'; }
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}

  function renderSlide(){
    var s=C.slides[i]; seen['s'+i]=1; progress(); save();
    document.getElementById('m').textContent=s.module+' · Slide '+(i+1)+' di '+C.slides.length;
    var cls='stage '+(s.layout==='title'?'title':s.layout==='summary'?'summary':'');
    var html='<div class="'+cls+'"><h2>'+esc(s.title)+'</h2>'+(s.layout==='title'?'':'<div class="line"></div>')+'<ul>'+s.bullets.map(function(b){return '<li>'+esc(b)+'</li>'}).join('')+'</ul></div>';
    html+='<div class="ctrl"><button id="prev"'+(i===0?' disabled':'')+'>‹ Precedente</button><button id="next" class="p">'+(i===C.slides.length-1?(C.quiz?'Vai al quiz ›':'Completa ✓'):'Successiva ›')+'</button><span class="muted" style="margin-left:auto">'+esc(C.title)+'</span></div>';
    if(s.notes) html+='<div class="notes">'+esc(s.notes)+'</div>';
    view.innerHTML=html;
    document.getElementById('prev').onclick=function(){ if(i>0){i--;renderSlide();} };
    document.getElementById('next').onclick=function(){ if(i<C.slides.length-1){i++;renderSlide();} else if(C.quiz){ renderQuiz(); } else { complete(100,true); } };
  }

  function renderQuiz(){
    document.getElementById('m').textContent=C.quiz.title;
    var html='<div class="quiz"><h2 style="margin-top:0">'+esc(C.quiz.title)+'</h2><p class="muted">Soglia di superamento: '+C.quiz.passMark+'%</p>';
    C.quiz.questions.forEach(function(q,qi){
      var multi=q.type==='multiple';
      html+='<div class="q" data-q="'+qi+'"><p>'+(qi+1)+'. '+esc(q.stem)+(multi?' <span class="muted">(più risposte)</span>':'')+'</p>'+q.options.map(function(o){return '<label><input type="'+(multi?'checkbox':'radio')+'" name="q'+qi+'" value="'+esc(o.id)+'"> '+esc(o.text)+'</label>'}).join('')+'</div>';
    });
    html+='<button id="send" class="p">Invia le risposte</button> <button id="back">‹ Torna alle slide</button></div>';
    view.innerHTML=html;
    document.getElementById('back').onclick=function(){ renderSlide(); };
    document.getElementById('send').onclick=function(){
      var correct=0;
      C.quiz.questions.forEach(function(q,qi){
        var chosen=[].slice.call(document.querySelectorAll('input[name=q'+qi+']:checked')).map(function(x){return x.value.toLowerCase()}).sort();
        var right=q.correct.map(function(c){return String(c).toLowerCase()}).sort();
        var ok=chosen.length===right.length&&chosen.every(function(v,k){return v===right[k]});
        if(ok) correct++;
        var p='cmi.interactions.'+qi+'.'; set(p+'id','q'+(qi+1)); set(p+'type',q.type==='truefalse'?'true-false':'choice'); set(p+'student_response',chosen.join(',')); set(p+'correct_responses.0.pattern',right.join(',')); set(p+'result',ok?'correct':'wrong');
        var el=document.querySelector('.q[data-q="'+qi+'"] p'); el.innerHTML+=ok?' <span class="ok">✓</span>':' <span class="ko">✗</span>'+(q.explanation?' <span class="muted">'+esc(q.explanation)+'</span>':'');
      });
      var score=Math.round(100*correct/C.quiz.questions.length), passed=score>=C.quiz.passMark;
      seen.quiz=1; progress();
      var r=document.createElement('div'); r.className='res '+(passed?'ok':'ko'); r.style.marginTop='16px';
      r.textContent=(passed?'Superato! ':'Non superato. ')+score+'% ('+correct+'/'+C.quiz.questions.length+')';
      document.getElementById('send').replaceWith(r);
      complete(score,passed);
    };
  }

  function complete(score,passed){
    set('cmi.core.score.min','0'); set('cmi.core.score.max','100'); set('cmi.core.score.raw',String(score));
    set('cmi.core.lesson_status',passed?'passed':'failed'); set('cmi.core.session_time',sessionTime()); commit();
  }

  renderSlide();
})();
</script>
</body>
</html>
`;
}

/** Builds the SCORM 1.2 zip (manifest + SCO + JSON copy of the content). */
export async function buildScormZip(course: ScoCourse): Promise<Buffer> {
  const zip = new JSZip();
  zip.file("imsmanifest.xml", buildManifest12(course));
  zip.file("index.html", buildScoHtml(course));
  zip.file("course.json", JSON.stringify({ title: course.title, slides: course.slides, quiz: course.quiz }, null, 2));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
