/* The "Ask us" helper on every page of ambs.co.nz.
   Free and private: no AI service. The build (site-src/build.py) gathers the site's own wording into
   /assets/chat-index.json; this script finds the best answer in the visitor's browser. Questions it can't answer
   become a booking, a message to the team (Web3Forms email + portal Leads, like the contact forms) or a call.
   Wording, quick questions and extra answers are edited in the website editor (Chat helper tab). */
(function(){
  if(window.AMBS_CHAT)return;window.AMBS_CHAT=1;
  var me=document.currentScript||document.querySelector('script[src*="/assets/chat.js"]');
  var INDEX=me&&me.dataset.index||"/assets/chat-index.json",LAUNCH=me&&me.dataset.label||"Ask us",NUDGE=me&&me.dataset.nudge||"",NUDGE_AFTER=+(me&&me.dataset.nudgeAfter)||40;
  var FORM_KEY="b26ce370-6383-473e-926e-ceb49a91e7fd",PORTAL_LEAD_URL="https://portal.ambs.co.nz/api/app?action=lead";
  var DATA=null,LOADING=null,DOCS=[],DF={},AVG={t:1,q:1,x:1,a:1},N=0;

  /* built-in translations of the default wording; edited wording shows as written */
  var TR={
    zh:{nudge:"需要帮忙吗？关于我们能自动化什么、价格或预约免费咨询，都可以问我。",launcher:"咨询我们",title:"咨询 Ambs Solutions",subtitle:"随时从我们的网站获取答案",placeholder:"输入您的问题…",send:"发送",book:"预约免费咨询",message:"留言",contact:"电话或邮件",read:"了解更多",related:"这些页面可能有帮助：",name:"您的姓名",email:"您的邮箱",phone:"电话（选填）",question:"您的问题",send_msg:"发送留言",sent:"谢谢！您的留言已发送给团队，我们会尽快回复您。",error:"抱歉，发送失败。请重试，或给我们发邮件。",helpful:"还有什么可以帮您？",restart:"重新开始",close:"关闭",
      greeting:"您好！关于 Ambs Solutions 的任何问题都可以问我：我们能自动化什么、如何运作、价格，或预约免费咨询。",not_found:"抱歉，我在网站上没有找到答案。您可以预约免费通话、给团队留言，或直接联系我们。",en:"答案以英文显示。",thanks:"不客气！",typing:"正在查找…",where:"地点",callus:"致电",emailus:"发邮件"},
    hi:{nudge:"मदद चाहिए? हम क्या ऑटोमेट करते हैं, कीमत, या मुफ़्त सत्र बुक करने के बारे में मुझसे पूछें।",launcher:"हमसे पूछें",title:"Ambs Solutions से पूछें",subtitle:"हमारी वेबसाइट से जवाब, कभी भी",placeholder:"अपना सवाल लिखें…",send:"भेजें",book:"मुफ़्त सत्र बुक करें",message:"संदेश छोड़ें",contact:"कॉल या ईमेल",read:"और पढ़ें",related:"ये पेज मदद कर सकते हैं:",name:"आपका नाम",email:"आपका ईमेल",phone:"फ़ोन (वैकल्पिक)",question:"आपका सवाल",send_msg:"संदेश भेजें",sent:"धन्यवाद! आपका संदेश टीम तक पहुँच गया है। हम जल्द ही आपसे संपर्क करेंगे।",error:"क्षमा करें, संदेश नहीं भेजा जा सका। कृपया फिर से कोशिश करें या हमें ईमेल करें।",helpful:"क्या मैं और किसी चीज़ में मदद कर सकता हूँ?",restart:"फिर से शुरू करें",close:"बंद करें",
      greeting:"नमस्ते! Ambs Solutions के बारे में कुछ भी पूछें: हम क्या ऑटोमेट करते हैं, यह कैसे काम करता है, कीमत, या मुफ़्त सत्र बुक करना।",not_found:"क्षमा करें, मुझे हमारी वेबसाइट पर इसका जवाब नहीं मिला। आप मुफ़्त कॉल बुक कर सकते हैं, टीम के लिए सवाल छोड़ सकते हैं, या सीधे संपर्क कर सकते हैं।",en:"जवाब अंग्रेज़ी में दिखाए जाते हैं।",thanks:"आपका स्वागत है!",typing:"ढूँढ रहे हैं…",where:"स्थान",callus:"कॉल करें",emailus:"ईमेल करें"},
    pa:{nudge:"ਮਦਦ ਚਾਹੀਦੀ ਹੈ? ਅਸੀਂ ਕੀ ਆਟੋਮੇਟ ਕਰਦੇ ਹਾਂ, ਕੀਮਤ, ਜਾਂ ਮੁਫ਼ਤ ਸੈਸ਼ਨ ਬੁੱਕ ਕਰਨ ਬਾਰੇ ਮੈਨੂੰ ਪੁੱਛੋ।",launcher:"ਸਾਨੂੰ ਪੁੱਛੋ",title:"Ambs Solutions ਨੂੰ ਪੁੱਛੋ",subtitle:"ਸਾਡੀ ਵੈੱਬਸਾਈਟ ਤੋਂ ਜਵਾਬ, ਕਦੇ ਵੀ",placeholder:"ਆਪਣਾ ਸਵਾਲ ਲਿਖੋ…",send:"ਭੇਜੋ",book:"ਮੁਫ਼ਤ ਸੈਸ਼ਨ ਬੁੱਕ ਕਰੋ",message:"ਸੁਨੇਹਾ ਛੱਡੋ",contact:"ਕਾਲ ਜਾਂ ਈਮੇਲ",read:"ਹੋਰ ਪੜ੍ਹੋ",related:"ਇਹ ਪੰਨੇ ਮਦਦ ਕਰ ਸਕਦੇ ਹਨ:",name:"ਤੁਹਾਡਾ ਨਾਮ",email:"ਤੁਹਾਡੀ ਈਮੇਲ",phone:"ਫ਼ੋਨ (ਚੋਣਵਾਂ)",question:"ਤੁਹਾਡਾ ਸਵਾਲ",send_msg:"ਸੁਨੇਹਾ ਭੇਜੋ",sent:"ਧੰਨਵਾਦ! ਤੁਹਾਡਾ ਸੁਨੇਹਾ ਟੀਮ ਕੋਲ ਪਹੁੰਚ ਗਿਆ ਹੈ। ਅਸੀਂ ਜਲਦੀ ਤੁਹਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰਾਂਗੇ।",error:"ਮਾਫ਼ ਕਰਨਾ, ਸੁਨੇਹਾ ਨਹੀਂ ਭੇਜਿਆ ਗਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ ਜਾਂ ਸਾਨੂੰ ਈਮੇਲ ਕਰੋ।",helpful:"ਕੀ ਮੈਂ ਹੋਰ ਕਿਸੇ ਚੀਜ਼ ਵਿੱਚ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?",restart:"ਮੁੜ ਸ਼ੁਰੂ ਕਰੋ",close:"ਬੰਦ ਕਰੋ",
      greeting:"ਸਤ ਸ੍ਰੀ ਅਕਾਲ! Ambs Solutions ਬਾਰੇ ਕੁਝ ਵੀ ਪੁੱਛੋ: ਅਸੀਂ ਕੀ ਆਟੋਮੇਟ ਕਰਦੇ ਹਾਂ, ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ, ਕੀਮਤ, ਜਾਂ ਮੁਫ਼ਤ ਸੈਸ਼ਨ ਬੁੱਕ ਕਰਨਾ।",not_found:"ਮਾਫ਼ ਕਰਨਾ, ਮੈਨੂੰ ਸਾਡੀ ਵੈੱਬਸਾਈਟ 'ਤੇ ਇਸਦਾ ਜਵਾਬ ਨਹੀਂ ਮਿਲਿਆ। ਤੁਸੀਂ ਮੁਫ਼ਤ ਕਾਲ ਬੁੱਕ ਕਰ ਸਕਦੇ ਹੋ, ਟੀਮ ਲਈ ਸਵਾਲ ਛੱਡ ਸਕਦੇ ਹੋ, ਜਾਂ ਸਿੱਧਾ ਸੰਪਰਕ ਕਰ ਸਕਦੇ ਹੋ।",en:"ਜਵਾਬ ਅੰਗਰੇਜ਼ੀ ਵਿੱਚ ਦਿਖਾਏ ਜਾਂਦੇ ਹਨ।",thanks:"ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ!",typing:"ਲੱਭ ਰਹੇ ਹਾਂ…",where:"ਟਿਕਾਣਾ",callus:"ਕਾਲ ਕਰੋ",emailus:"ਈਮੇਲ ਕਰੋ"},
    mi:{nudge:"He āwhina māu? Pātai mai mō ngā mahi ka whakaaunoatia e mātou, ngā utu, te tono rānei i tētahi wā kore utu.",launcher:"Pātai mai",title:"Pātai ki Ambs Solutions",subtitle:"He whakautu mai i tō mātou paetukutuku",placeholder:"Tuhia tō pātai…",send:"Tukua",book:"Tonoa he wā kore utu",message:"Waiho he karere",contact:"Waea, īmēra rānei",read:"Pānui atu anō",related:"Ka āwhina pea ēnei whārangi:",name:"Tō ingoa",email:"Tō īmēra",phone:"Waea (kōwhiringa)",question:"Tō pātai",send_msg:"Tukua te karere",sent:"Ngā mihi! Kua tae tō karere ki te tīma. Ka whakapā mai mātou ā tōna wā.",error:"Aroha mai, kāore i tukuna. Tēnā, ngana anō, ka īmēra mai rānei.",helpful:"He aha atu anō e taea ana e au te āwhina?",restart:"Tīmata anō",close:"Kati",
      greeting:"Kia ora! Pātaihia mai he aha te aha mō Ambs Solutions: ngā mahi ka whakaaunoatia e mātou, te āhua o te mahi, ngā utu, te tono rānei i tētahi wā kore utu.",not_found:"Aroha mai, kāore au i kite i tētahi whakautu i tō mātou paetukutuku. Ka taea e koe te tono waea kore utu, te waiho pātai mā te tīma, te whakapā tōtika mai rānei.",en:"Kei te reo Pākehā ngā whakautu.",thanks:"Kei te pai!",typing:"E rapu ana…",where:"Wāhi",callus:"Waea mai",emailus:"Īmēra mai"}
  };
  var EN_EXTRA={en:"",thanks:"You're welcome! Anything else?",typing:"Looking…",where:"Where",callus:"Call",emailus:"Email"};
  var DEF={launcher:"Ask us",title:"Ask Ambs Solutions",subtitle:"Answers from our website, any time",placeholder:"Type your question…",send:"Send",book:"Book a free session",message:"Leave a message",contact:"Call or email",read:"Read more",related:"These pages might help:",name:"Your name",email:"Your email",phone:"Phone (optional)",question:"Your question",send_msg:"Send message",sent:"Thanks! Your message is with the team. We'll get back to you soon.",error:"Sorry, that didn't send. Please try again, or email us.",helpful:"Anything else I can help with?",restart:"Start again",close:"Close"};
  function lang(){return (document.documentElement.lang||"en").slice(0,2).toLowerCase()}
  function L(k){var b=DATA&&DATA.bot||{},lab=b.labels||{},v=k==="greeting"||k==="not_found"?b[k]:lab[k],tr=TR[lang()];
    if(k==="launcher"&&!DATA)v=LAUNCH;if(k==="nudge")v=NUDGE;
    if(k==="nudge"&&tr&&tr.nudge&&v===DEFNU)return tr.nudge;
    if(tr&&tr[k]&&(v==null||v===""||v===DEF[k]||(k==="greeting"&&v===DEFG)||(k==="not_found"&&v===DEFN)||(k==="launcher"&&v==="Ask us")))return tr[k];
    if(v!=null&&v!=="")return v;return DEF[k]!=null?DEF[k]:EN_EXTRA[k]!=null?EN_EXTRA[k]:""}
  var DEFNU="Need a hand? I can answer questions about what we automate, prices, or booking a free session.";
  var DEFG="Kia ora! Ask me anything about Ambs Solutions: what we automate, how it works, prices, or booking a free session.";
  var DEFN="Sorry, I couldn't find an answer to that on our website. You can book a free call, leave your question for the team, or contact us directly.";

  /* ---- finding answers ---- */
  var STOP={};("a an and are as at be been but by can could did do does doing for from had has have how i if in into is it its just me my of on or our please should so tell than that the their them then there these they this those to too us was we were what when where which who why will with would you your yours i'm im want need know about get got any some much many also more very really there's what's whats hi hey").split(" ").forEach(function(w){STOP[w]=1});
  var SYN=[["cost","price","pricing","fee","charge","budget","rate","expensive","cheap","afford","pay","quote"],["book","booking","appointment","meeting","schedule","consult","consultation","session","walkthrough"],
    ["staff","employee","team","people","worker","job"],["automate","automation","automatic","ai","bot","robot"],["website","site","web","webpage","seo","google"],["app","software","tool","system","program","platform"],
    ["invoice","bill","billing","payment","xero","myob","accounting"],["review","rating","feedback"],["remind","reminder","text","sms","noshow","no-show"],["privacy","data","secure","security","safe","gdpr","confidential"],
    ["where","location","based","office","address","auckland","nationwide","zealand","nz"],["contact","phone","email","call","reach","talk","speak","number"],["portal","dashboard","app"],["mobile","app","iphone","android","phone"],["build","make","create","develop","design","set"],["start","begin","process","step","work"],
    ["long","time","week","weeks","quick","fast","timeline"],["support","help","fix","broke","break","maintenance"],["own","ownership","login","contract","cancel"],["small","size","solo","sole"]];
  var SYNMAP={};SYN.forEach(function(g){g.forEach(function(w){var s=stem(w);(SYNMAP[s]=SYNMAP[s]||[]);g.forEach(function(o){var so=stem(o);if(so!==s&&SYNMAP[s].indexOf(so)<0)SYNMAP[s].push(so)})})});
  function norm(s){return String(s||"").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g,"").replace(/no[- ]shows?/g,"noshow").replace(/[^a-z0-9$]+/g," ")}
  function stem(w){if(w.length<=3)return w;if(/ies$/.test(w)&&w.length>4)return w.slice(0,-3)+"y";if(/(ss|us|is)$/.test(w))return w;if(/(ches|shes|xes|sses)$/.test(w))return w.slice(0,-2);if(/s$/.test(w))w=w.slice(0,-1);
    if(/ing$/.test(w)&&w.length>5)w=w.slice(0,-3);else if(/ed$/.test(w)&&w.length>4)w=w.slice(0,-2);if(/ion$/.test(w)&&w.length>6)w=w.slice(0,-3);if(/e$/.test(w)&&w.length>4)w=w.slice(0,-1);return w}
  function toks(s,keepStop){return norm(s).split(" ").filter(function(w){return w&&(keepStop||!STOP[w])}).map(stem)}
  function prep(){DOCS=(DATA.docs||[]).map(function(d){var f={t:toks(d.t),q:toks(d.q),x:toks(d.x),a:toks(d.a)},tf={};
      Object.keys(f).forEach(function(k){var m={};f[k].forEach(function(w){m[w]=(m[w]||0)+1});tf[k]=m;AVG[k]+=f[k].length});
      var seen={};Object.keys(f).forEach(function(k){f[k].forEach(function(w){if(!seen[w]){seen[w]=1;DF[w]=(DF[w]||0)+1}})});
      var qset=null,qn=0;if(f.q.length){qset={};f.q.forEach(function(w){if(!qset[w]){qset[w]=1;qn++}})}
      return{d:d,tf:tf,qset:qset,qn:qn,len:{t:f.t.length,q:f.q.length,x:f.x.length,a:f.a.length}}});
    N=DOCS.length||1;Object.keys(AVG).forEach(function(k){AVG[k]=Math.max(1,AVG[k]/N)})}
  var W={t:2.4,q:3,x:2,a:1},KIND={qa:1.35,faq:1.2,page:1.3,home:1.1,sec:.85};
  function search(text){var qs=toks(text),uniq=[];qs.forEach(function(w){if(uniq.indexOf(w)<0)uniq.push(w)});if(!uniq.length)return[];
    var terms=[];uniq.forEach(function(w){terms.push({w:w,wt:1,o:w});(SYNMAP[w]||[]).forEach(function(s){terms.push({w:s,wt:.55,o:w})})});
    /* each word of the question counts once: its best match, either itself or (for less) a word that means the same */
    var res=DOCS.map(function(D){var best={},hit={};terms.forEach(function(T){var idf=Math.log(1+(N-(DF[T.w]||0)+.5)/((DF[T.w]||0)+.5)),v=0;
        Object.keys(W).forEach(function(k){var f=D.tf[k][T.w];if(!f)return;v+=idf*(f*2.2/(f+1.2*(.25+.75*D.len[k]/AVG[k])))*W[k]});v*=T.wt;
        if(v>0){best[T.o]=Math.max(best[T.o]||0,v);hit[T.o]=Math.max(hit[T.o]||0,T.wt)}});
      var sc=0;Object.keys(best).forEach(function(k){sc+=best[k]});
      /* a stored question worded like the visitor's gets a lift */
      if(D.qset){var inter=0;uniq.forEach(function(w){if(D.qset[w])inter++});var uni=uniq.length+D.qn-inter;if(uni)sc+=12*inter/uni}
      var cov=0;uniq.forEach(function(w){cov+=hit[w]||0});cov/=uniq.length;return{D:D,s:sc*(KIND[D.d.k]||1)*(.4+cov),cov:cov}}).filter(function(r){return r.s>0});
    res.sort(function(a,b){return b.s-a.s});return res}
  function snippet(d,text,max){var qs=toks(text),sents=String(d.a||"").match(/[^.!?]+[.!?]*/g)||[d.a||""],best=[];
    sents.forEach(function(s,i){var t=toks(s),sc=0;qs.forEach(function(w){if(t.indexOf(w)>=0)sc+=1;else (SYNMAP[w]||[]).forEach(function(y){if(t.indexOf(y)>=0)sc+=.5})});best.push({i:i,s:sc})});
    best.sort(function(a,b){return b.s-a.s||a.i-b.i});var start=best.length&&best[0].s>0?best[0].i:0,out="";
    for(var i=start;i<sents.length&&(out+sents[i]).length<=(max||300);i++)out+=sents[i];if(!out)out=sents[start].slice(0,max||300)+"…";return out.trim()}

  /* ---- the window ---- */
  var root,log,input,openBtn,state={open:false,msgs:[]},lastQ="";
  function el(tag,cls,txt){var x=document.createElement(tag);if(cls)x.className=cls;if(txt!=null)x.textContent=txt;return x}
  function save(){try{sessionStorage.setItem("ambs:chat",JSON.stringify({open:state.open,msgs:state.msgs.slice(-40)}))}catch(e){}}
  function restore(){try{var s=JSON.parse(sessionStorage.getItem("ambs:chat")||"null");if(s&&s.msgs)state=s}catch(e){}}
  function css(){if(document.getElementById("ambs-chat-css"))return;var s=document.createElement("style");s.id="ambs-chat-css";s.textContent=[
    ".ac-panel,.ac-nudge{--ac-bg:#fff;--ac-ink:#14172b;--ac-muted:#5b6479;--ac-line:rgba(30,45,80,.11);--ac-line2:rgba(30,45,80,.18);--ac-soft:#f4f7fc;--ac-bot:#f4f7fc;color-scheme:light}",
    "html[data-theme=dark] .ac-panel,html[data-theme=dark] .ac-nudge{--ac-bg:#171e3a;--ac-ink:#edeff8;--ac-muted:#a9b2cc;--ac-line:rgba(233,237,249,.12);--ac-line2:rgba(233,237,249,.2);--ac-soft:#0f1428;--ac-bot:#222a4b;color-scheme:dark}",
    ".ac-panel,.ac-panel *,.ac-nudge,.ac-nudge *{box-sizing:border-box}.ac-panel{margin:0}.ac-panel section{padding:0}",
    ".ac-launch{position:fixed;right:calc(env(safe-area-inset-right,0px) + 20px);bottom:calc(env(safe-area-inset-bottom,0px) + 20px);z-index:96;display:flex;align-items:center;gap:8px;height:52px;padding:0 20px 0 16px;border:0;border-radius:999px;background:#14172b;color:#fff;font:700 15px/1 var(--body,'Instrument Sans',Arial,sans-serif);cursor:pointer;box-shadow:0 14px 32px -12px rgba(10,14,30,.55);transition:transform .3s cubic-bezier(.16,1,.3,1),opacity .3s}",
    ".ac-launch:hover{transform:translateY(-2px)}.ac-launch svg{width:22px;height:22px}.ac-launch .ac-dot{width:9px;height:9px;border-radius:50%;background:#24b328;box-shadow:0 0 0 3px rgba(36,179,40,.25)}",
    "html[data-theme=dark] .ac-launch{background:#eef2fb;color:#14172b}",
    "body.ac-on .ac-launch{opacity:0;pointer-events:none;transform:scale(.9)}body.ac-has .totop{bottom:calc(env(safe-area-inset-bottom,0px) + 84px)!important}",
    ".qbar a.qb-ask{background:linear-gradient(180deg,#d9e9ff,#b5d3ff);color:#0d2a55}html[data-theme=dark] .qbar a.qb-ask{color:#0d2a55}",
    "@media (max-width:1120px){body.ac-qbar-on .ac-launch{opacity:0;pointer-events:none;transform:translateY(12px)}.qbar a{min-width:92px!important;padding:0 .8rem!important}}",
    ".ac-panel{position:fixed;right:calc(env(safe-area-inset-right,0px) + 20px);bottom:calc(env(safe-area-inset-bottom,0px) + 20px);z-index:300;width:min(400px,calc(100vw - 32px));height:min(620px,calc(100dvh - 40px));display:flex;flex-direction:column;background:var(--ac-bg);color:var(--ac-ink);border:1px solid var(--ac-line);border-radius:22px;box-shadow:0 30px 70px -24px rgba(10,14,30,.55);overflow:hidden;font:15px/1.5 var(--body,'Instrument Sans',Arial,sans-serif);opacity:0;visibility:hidden;transform:translateY(16px) scale(.98);transform-origin:bottom right;transition:opacity .3s ease,transform .45s cubic-bezier(.16,1,.3,1),visibility 0s linear .45s}",
    ".ac-panel.on{opacity:1;visibility:visible;transform:none;transition:opacity .3s ease,transform .45s cubic-bezier(.16,1,.3,1),visibility 0s}",
    "@media (max-width:640px){.ac-panel{right:0;left:0;bottom:0;width:100%;height:min(88dvh,720px);border-radius:22px 22px 0 0;border-bottom:0}}",
    ".ac-head{display:flex;align-items:center;gap:12px;padding:14px 14px 12px 18px;border-bottom:1px solid var(--ac-line);position:relative}",
    ".ac-head::after{content:'';position:absolute;left:0;right:0;bottom:-1px;height:3px;background:linear-gradient(90deg,#E5352B,#F58220,#FFC21A,#24b328,#1877E0,#7B2FBE);opacity:.85}",
    ".ac-av{width:38px;height:38px;border-radius:12px;background:#14172b;display:grid;place-items:center;flex:none}.ac-av svg{width:21px;height:21px}html[data-theme=dark] .ac-av{background:#24305c}",
    ".ac-hd{flex:1;min-width:0}.ac-hd b{display:block;font:700 16px/1.2 var(--display,inherit);color:var(--ac-ink)}.ac-hd span{font-size:12.5px;color:var(--ac-muted)}",
    ".ac-x,.ac-re{border:0;background:transparent;color:var(--ac-muted);width:36px;height:36px;border-radius:10px;cursor:pointer;display:grid;place-items:center}.ac-x:hover,.ac-re:hover{background:rgba(120,130,160,.12);color:var(--ac-ink)}.ac-x svg,.ac-re svg{width:18px;height:18px}",
    ".ac-log{flex:1;overflow-y:auto;padding:16px 14px 8px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}",
    ".ac-m{max-width:88%;padding:10px 13px;border-radius:16px;white-space:pre-line;word-wrap:break-word;animation:ac-in .35s cubic-bezier(.16,1,.3,1) both}",
    "@keyframes ac-in{from{opacity:0;transform:translateY(6px)}}@media (prefers-reduced-motion:reduce){.ac-m{animation:none}.ac-panel,.ac-launch{transition:none}}",
    ".ac-bot{align-self:flex-start;background:var(--ac-bot);color:var(--ac-ink);border-bottom-left-radius:6px}",
    ".ac-me{align-self:flex-end;background:#1877e0;color:#fff;border-bottom-right-radius:6px}",
    ".ac-m b.ac-t{display:block;font-weight:700;margin-bottom:2px}",
    ".ac-m a{color:#1877e0;font-weight:600}html[data-theme=dark] .ac-m a{color:#7fbcff}",
    ".ac-links{display:flex;flex-direction:column;gap:6px;margin-top:8px}.ac-links a{display:block;padding:8px 11px;border-radius:12px;background:var(--ac-bg);border:1px solid var(--ac-line);text-decoration:none;color:var(--ac-ink)!important;font-weight:600;font-size:14px}",
    ".ac-links a small{display:block;font-weight:400;color:var(--ac-muted);font-size:12.5px;margin-top:2px;white-space:normal}.ac-links a:hover{border-color:#1877e0}",
    ".ac-chips{display:flex;flex-wrap:wrap;gap:7px;align-self:flex-start;max-width:100%;animation:ac-in .35s cubic-bezier(.16,1,.3,1) both}",
    ".ac-chip{border:1px solid var(--ac-line2);background:var(--ac-bg);color:var(--ac-ink);border-radius:999px;padding:7px 12px;font:600 13.5px/1.2 var(--body,'Instrument Sans',Arial,sans-serif);cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:6px}",
    ".ac-chip:hover{border-color:#1877e0;color:#1877e0}.ac-chip.go{background:linear-gradient(180deg,#b7f4b9,#7ee282);border-color:transparent;color:#14301a}.ac-chip.go:hover{color:#14301a;filter:brightness(1.03)}",
    ".ac-note{font-size:12px;color:var(--ac-muted);align-self:center}",
    ".ac-form{display:grid;gap:8px;margin-top:8px}.ac-form input,.ac-form textarea{width:100%;box-sizing:border-box;border:1px solid var(--ac-line2);background:var(--ac-bg);color:var(--ac-ink);border-radius:10px;padding:9px 11px;font:15px/1.4 var(--body,'Instrument Sans',Arial,sans-serif)}",
    ".ac-form textarea{min-height:70px;resize:vertical}.ac-form .bad{border-color:#e5352b}.ac-form button{justify-self:start}.ac-hp{position:absolute!important;left:-9999px!important;width:1px;height:1px;opacity:0}",
    ".ac-type{display:flex;gap:4px;padding:12px 14px}.ac-type i{width:7px;height:7px;border-radius:50%;background:var(--ac-muted);opacity:.5;animation:ac-b 1s infinite}.ac-type i:nth-child(2){animation-delay:.15s}.ac-type i:nth-child(3){animation-delay:.3s}@keyframes ac-b{50%{opacity:1;transform:translateY(-3px)}}",
    ".ac-in{display:flex;gap:8px;padding:10px 12px calc(10px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--ac-line)}",
    ".ac-in input{flex:1;min-width:0;border:1px solid var(--ac-line2);background:var(--ac-soft);color:var(--ac-ink);border-radius:999px;padding:11px 16px;font:16px/1.2 var(--body,'Instrument Sans',Arial,sans-serif);outline:none}.ac-in input:focus{border-color:#1877e0;box-shadow:0 0 0 3px rgba(24,119,224,.18)}",
    ".ac-in button{flex:none;width:46px;height:46px;border:0;border-radius:50%;background:#1877e0;color:#fff;cursor:pointer;display:grid;place-items:center}.ac-in button svg{width:20px;height:20px}.ac-in button:disabled{opacity:.45;cursor:default}",
    ".ac-nudge{position:fixed;right:calc(env(safe-area-inset-right,0px) + 20px);bottom:calc(env(safe-area-inset-bottom,0px) + 84px);z-index:97;max-width:min(300px,calc(100vw - 40px));display:flex;gap:10px;align-items:flex-start;padding:13px 12px 13px 15px;border-radius:18px 18px 6px 18px;background:var(--ac-bg);color:var(--ac-ink);border:1px solid var(--ac-line);box-shadow:0 18px 40px -16px rgba(10,14,30,.5);font:500 14.5px/1.45 var(--body,'Instrument Sans',Arial,sans-serif);cursor:pointer;opacity:0;transform:translateY(10px) scale(.97);transform-origin:bottom right;transition:opacity .4s ease,transform .5s cubic-bezier(.16,1,.3,1)}",
    ".ac-nudge.on{opacity:1;transform:none}.ac-nudge p{margin:0;flex:1}.ac-nudge .ac-nx{flex:none;border:0;background:transparent;color:var(--ac-muted);width:26px;height:26px;margin:-4px -4px 0 0;border-radius:8px;cursor:pointer;display:grid;place-items:center}.ac-nudge .ac-nx svg{width:14px;height:14px}.ac-nudge .ac-nx:hover{background:rgba(120,130,160,.14)}",
    "@media (max-width:1120px){body.ac-qbar-on .ac-nudge{bottom:calc(env(safe-area-inset-bottom,0px) + 86px)}}body.ac-on .ac-nudge{display:none}",
    ".ac-shade{position:fixed;inset:0;z-index:299;background:rgba(10,14,30,.32);opacity:0;visibility:hidden;transition:opacity .3s,visibility 0s .3s}@media (max-width:640px){.ac-shade.on{opacity:1;visibility:visible;transition:opacity .3s}}"
  ].join("\n");document.head.appendChild(s)}
  var ICO={chat:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5z"/><path d="M8.5 9.5h7M8.5 12.5h4"/></svg>',
    x:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    send:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h13M12 5l7 7-7 7"/></svg>',
    re:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5"/><path d="M4 4v4.5h4.5"/></svg>',
    bot:'<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5z"/><circle cx="9" cy="10" r=".6" fill="#fff"/><circle cx="12" cy="10" r=".6" fill="#fff"/><circle cx="15" cy="10" r=".6" fill="#fff"/></svg>'};
  function build(){css();
    var shade=el("div","ac-shade");root=el("div","ac-panel");root.setAttribute("role","dialog");root.setAttribute("aria-modal","false");root.setAttribute("aria-labelledby","acTitle");
    root.innerHTML='<div class="ac-head"><span class="ac-av">'+ICO.bot+'</span><div class="ac-hd"><b id="acTitle"></b><span class="ac-sub"></span></div><button type="button" class="ac-re">'+ICO.re+'</button><button type="button" class="ac-x">'+ICO.x+'</button></div><div class="ac-log" aria-live="polite"></div><form class="ac-in" autocomplete="off"><input type="text" enterkeyhint="send" maxlength="300"><button type="submit">'+ICO.send+'</button></form>';
    document.body.appendChild(shade);document.body.appendChild(root);log=root.querySelector(".ac-log");input=root.querySelector("input");
    root.querySelector(".ac-x").addEventListener("click",close);shade.addEventListener("click",close);
    root.querySelector(".ac-re").addEventListener("click",function(){state.msgs=[];save();log.innerHTML="";welcome();input.focus()});
    root.querySelector("form").addEventListener("submit",function(ev){ev.preventDefault();var v=input.value.trim();if(!v)return;input.value="";ask(v)});
    document.addEventListener("keydown",function(ev){if(ev.key==="Escape"&&state.open)close()});
    root._shade=shade;labels()}
  function labels(){if(!root)return;root.querySelector("#acTitle").textContent=L("title");root.querySelector(".ac-sub").textContent=L("subtitle");input.placeholder=L("placeholder");
    root.querySelector(".ac-in button").setAttribute("aria-label",L("send"));root.querySelector(".ac-x").setAttribute("aria-label",L("close"));root.querySelector(".ac-re").setAttribute("aria-label",L("restart"));root.querySelector(".ac-re").title=L("restart");
    if(openBtn)openBtn.querySelector("span:last-child").textContent=L("launcher");var qa=document.querySelector(".qbar .qb-ask span");if(qa)qa.textContent=L("launcher")}
  function load(){if(DATA)return Promise.resolve(DATA);if(LOADING)return LOADING;
    LOADING=fetch(INDEX).then(function(r){return r.json()}).then(function(d){DATA=d;prep();labels();return d});return LOADING}
  function open(){hideNudge();sset("ambs:nudged","1");if(!root)build();state.open=true;save();root.classList.add("on");root._shade.classList.add("on");document.body.classList.add("ac-on");
    if(window.gtag)gtag("event","chat_open");
    load().then(function(){if(!log.children.length){if(state.msgs.length)state.msgs.forEach(function(m){render(m,true)});else welcome()}scroll()}).catch(function(){if(!log.children.length)addBot({t:"text",x:L("not_found")}),addBot({t:"actions"})});
    setTimeout(function(){if(window.matchMedia("(min-width:641px)").matches)input.focus()},60)}
  function close(){if(!root)return;state.open=false;save();root.classList.remove("on");root._shade.classList.remove("on");document.body.classList.remove("ac-on");if(openBtn)openBtn.focus({preventScroll:true})}
  function scroll(){log.scrollTop=log.scrollHeight}
  /* only the newest row of buttons stays, so the conversation doesn't fill up with repeats */
  function push(m){if(m.t==="actions"||m.t==="chips"||m.who==="me"){state.msgs=state.msgs.filter(function(x){return x.t!=="actions"&&x.t!=="chips"});[].forEach.call(log.querySelectorAll(".ac-chips"),function(x){x.remove()})}
    state.msgs.push(m);save();render(m)}
  function addBot(m){m.who="bot";push(m)}
  function welcome(){addBot({t:"text",x:L("greeting")});if(lang()!=="en"&&L("en"))addBot({t:"note",x:L("en")});addBot({t:"chips",items:((DATA&&DATA.bot&&DATA.bot.suggestions)||[]).slice(0,6)})}
  function render(m,quiet){var b;
    if(m.who==="me"){b=el("div","ac-m ac-me",m.x);log.appendChild(b);scroll();return}
    if(m.t==="text"||m.t==="answer"){b=el("div","ac-m ac-bot");if(m.title){b.appendChild(el("b","ac-t",m.title))}b.appendChild(document.createTextNode(m.x||""));
      if(m.u){var a=el("a",null,(m.l||L("read"))+" →");a.href=m.u;a.addEventListener("click",nav);var p=el("div");p.style.marginTop="6px";p.appendChild(a);b.appendChild(p)}
      if(m.links&&m.links.length){b.appendChild(el("div","ac-note",L("related"))).style.marginTop="8px";var box=el("div","ac-links");m.links.forEach(function(k){var a=el("a",null,k.t);a.href=k.u;if(k.s)a.appendChild(el("small",null,k.s));a.addEventListener("click",nav);box.appendChild(a)});b.appendChild(box)}
      log.appendChild(b)}
    else if(m.t==="note"){log.appendChild(el("div","ac-note",m.x))}
    else if(m.t==="chips"){b=el("div","ac-chips");(m.items||[]).forEach(function(q){var c=el("button","ac-chip",q);c.type="button";c.addEventListener("click",function(){ask(q)});b.appendChild(c)});log.appendChild(b)}
    else if(m.t==="actions"){b=el("div","ac-chips");var bk=el("a","ac-chip go","📅 "+L("book"));bk.href=(DATA&&DATA.biz&&DATA.biz.book)||"/#book";bk.addEventListener("click",nav);b.appendChild(bk);
      var ms=el("button","ac-chip","✉️ "+L("message"));ms.type="button";ms.addEventListener("click",function(){addBot({t:"form",q:m.q||lastQ})});b.appendChild(ms);
      var ct=el("button","ac-chip","📞 "+L("contact"));ct.type="button";ct.addEventListener("click",function(){addBot({t:"contact"})});b.appendChild(ct);log.appendChild(b)}
    else if(m.t==="contact"){var z=(DATA&&DATA.biz)||{};b=el("div","ac-m ac-bot");var box=el("div","ac-links");box.style.marginTop="0";
      if(z.phone){var a=el("a",null,"📞 "+L("callus")+": "+z.phone);a.href="tel:"+z.phone.replace(/[^+\d]/g,"");box.appendChild(a)}
      if(z.email){var a2=el("a",null,"✉️ "+L("emailus")+": "+z.email);a2.href="mailto:"+z.email;box.appendChild(a2)}
      b.appendChild(box);if(z.location)b.appendChild(el("div","ac-note","📍 "+z.location)).style.marginTop="8px";log.appendChild(b)}
    else if(m.t==="form"){b=el("div","ac-m ac-bot");b.style.maxWidth="100%";b.style.width="100%";b.style.boxSizing="border-box";
      if(m.done){b.textContent=L("sent");log.appendChild(b);scroll();return}
      var f=el("form","ac-form");f.innerHTML='<input name="name" autocomplete="name" required><input name="email" type="email" autocomplete="email" required><input name="phone" type="tel" autocomplete="tel"><textarea name="question" required></textarea><input class="ac-hp" name="botcheck" tabindex="-1" autocomplete="off" aria-hidden="true"><button type="submit" class="ac-chip go"></button>';
      f.name.placeholder=L("name");f.email.placeholder=L("email");f.phone.placeholder=L("phone");f.question.placeholder=L("question");f.question.value=m.q||"";
      ["name","email","phone","question"].forEach(function(k){f[k].setAttribute("aria-label",f[k].placeholder)});f.querySelector("button").textContent=L("send_msg");
      f.addEventListener("submit",function(ev){ev.preventDefault();sendMsg(f,m,b)});b.appendChild(f);log.appendChild(b);if(!quiet)setTimeout(function(){f.name.focus()},50)}
    if(!quiet)scroll()}
  function nav(ev){var h=this.getAttribute("href")||"";if(h.charAt(0)==="/"&&h.indexOf("#")>0&&location.pathname===h.split("#")[0]){close()}
    else if(h.indexOf("/#")===0&&location.pathname==="/"){close()}else if(window.matchMedia("(max-width:640px)").matches){state.open=false;save()}}
  function sendMsg(f,m,box){var v=function(k){return String(f[k].value||"").trim()},ok=true;
    ["name","email","question"].forEach(function(k){var bad=!v(k)||(k==="email"&&!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v(k)));f[k].classList.toggle("bad",bad);if(bad&&ok){ok=false;f[k].focus()}});if(!ok)return;
    var btn=f.querySelector("button");if(f.botcheck.value){m.done=true;save();box.textContent=L("sent");return}
    var conv=state.msgs.filter(function(x){return x.who==="me"}).map(function(x){return"- "+x.x}).slice(-8).join("\n");
    var lead=JSON.stringify({name:v("name"),company:"",email:v("email"),phone:v("phone"),service:"Website chat",message:v("question")+(conv?"\n\nAsked in the chat:\n"+conv:""),page:location.href.split("#")[0],extra:{language:lang(),form:"Website chat"},hp:""});
    try{if(!(navigator.sendBeacon&&navigator.sendBeacon(PORTAL_LEAD_URL,new Blob([lead],{type:"text/plain"}))))fetch(PORTAL_LEAD_URL,{method:"POST",mode:"no-cors",keepalive:true,headers:{"Content-Type":"text/plain"},body:lead})}catch(e){}
    btn.disabled=true;btn.textContent="…";
    fetch("https://api.web3forms.com/submit",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({access_key:FORM_KEY,subject:"Website chat — "+v("name")+" ("+location.pathname+")",from_name:"ambs.co.nz website",form:"Website chat",page:location.href,language:lang(),name:v("name"),email:v("email"),phone:v("phone"),question:v("question"),chat:conv})})
      .then(function(r){return r.json()}).then(function(d){if(!d||!d.success)throw 0;if(window.gtag)gtag("event","generate_lead",{form:"Website chat"});m.done=true;save();box.textContent=L("sent");scroll()})
      .catch(function(){btn.disabled=false;btn.textContent=L("send_msg");var er=f.querySelector(".ac-err")||el("div","ac-note ac-err");er.textContent=L("error");f.appendChild(er)})}
  function typing(){var t=el("div","ac-m ac-bot ac-type");t.innerHTML="<i></i><i></i><i></i>";t.setAttribute("aria-label",L("typing"));log.appendChild(t);scroll();return t}
  /* everyday conversation: answered like a person would, before searching the website. The answers can be changed
     in the website editor (Chat helper → Everyday conversation); these are the defaults */
  var TALK_DEF={offtopic:"I can only answer questions about Ambs Solutions, and I couldn't find that on our website. If it's something about your business, our team is happy to help:",how_are_you:"I'm doing well, thanks for asking! How can I help you today?",
    who:"I'm the Ambs Solutions helper. I answer questions using our website, any time of day. For anything I can't answer, a real person from our team is happy to help.",
    human:"I'm an automated helper, not a person. If you'd like to talk to someone from our team, you can book a free session, leave a message or call us.",
    thanks:"You're welcome! Is there anything else I can help with?",ok:"Great! Anything else I can help with?",bye:"Thanks for stopping by. Have a great day!",
    good:"Glad to hear it! What can I help you with?",bad:"Sorry to hear that. If something's getting in the way, tell me about it and I'll see if we can help.",
    joke:"Why did the spreadsheet feel tired? It had been working in too many cells all week. That's the kind of job we like to automate! What can I help you with?",
    weather:"I can't check the weather, sorry. I can help with anything about Ambs Solutions though: what we automate, prices, or booking a free session.",
    time:"It's {time} in New Zealand right now.",help:"Ask me anything about Ambs Solutions, or tap one of these to get started.",
    sorry:"No problem at all. What would you like to know?",test:"I'm here and working! Ask me anything about Ambs Solutions."};
  var TALK=[["greet",/^(hi+|hello+|hey+|heya|hiya|yo|kia ora|gday|g day|good (morning|afternoon|evening|day)|namaste|ni hao|sat sri akal|tena koe|morena|greetings)( there| team| everyone| ambs)?$/],
    ["how_are_you",/\b(how are (you|u|ya)|how r u|hows it going|how is it going|how you doing|how are things|whats up|sup|how have you been)\b/],
    ["human",/\b(are (you|u) (a |an )?(human|real|person|robot|bot|ai|machine|chatbot|computer))\b|\b(am i (talking|chatting|speaking) (to|with) (a )?(human|person|bot|robot|real))/],
    ["who",/^(who are (you|u)|what are (you|u)|whats your name|what is your name|your name|introduce yourself|what can you do|what do you do here)$/],
    ["thanks",/^(thanks?|thank (you|u)|thanks (a lot|heaps|so much|mate)|thank you so much|thx|ty|cheers|ka pai|nga mihi|much appreciated|appreciate it)( mate| heaps)?$/],
    ["ok",/^(ok+|okay|k|cool|nice|great|awesome|perfect|sweet|sounds good|got it|alright|all good|good to know|noted|interesting|wow|amazing|fair enough|right|sure|yes|yep|yeah|no|nope|nah)$/],
    ["bye",/^(bye+|goodbye|good bye|see (you|ya)|later|catch you later|have a (good|great|nice) (day|one|night)|ka kite|ka kite ano|good night|gotta go|thats all|that is all|nothing else|im done)$/],
    ["good",/^(im |i am )?(so |really |very |pretty |all )?(good|great|fine|well|not bad|doing well|all good|pretty good|very good)( thanks| thank you| thx)?( and you| you| how about you)?$/],
    ["bad",/^(im |i am |feeling |im feeling )?(so |really |very |a bit |pretty |super |too )?(not (good|great|well)|bad|tired|stressed|busy|exhausted|sad|overwhelmed|swamped|flat out|run off my feet)( today| at the moment| right now)?$/],
    ["joke",/\b(tell me a joke|joke|make me laugh|something funny)\b/],
    ["weather",/\b(weather|rain(ing)?|sunny|temperature|forecast)\b/],
    ["time",/\b(what time is it|whats the time|what is the time|time now|todays date|what day is it|what is the date|whats the date)\b/],
    ["help",/^(help|help me|can you help( me)?|i need help|menu|options|start|what can i ask)$/],
    ["sorry",/^(sorry|my bad|oops|apologies)$/],["test",/^(test|testing|test test|hello world)$/]];
  var CONTACT=/\b(phone|email|e-mail|contact|call you|ring|number|reach you|talk to (a|someone|somebody|a person|human)|speak to|human|real person)\b/i;
  function talkKey(q){var t=norm(q).replace(/\s+/g," ").trim().replace(/\b(i|what|it|how|that|you|there|who|we|they) (m|s|re|ll|ve|d)\b/g,"$1$2").replace(/^(um+|so|well|oh|ok so|hey) /,"");if(!t)return"";
    /* a greeting with a question after it is a question, unless it's just "how are you" */
    var g=t.replace(/^(hi+|hello+|hey+|kia ora|gday|good (morning|afternoon|evening)) (there |team )?/,"");
    if(g!==t&&g&&!/^(how are|how r|hows|whats up|how you)/.test(g))t=g;
    for(var i=0;i<TALK.length;i++){var k=TALK[i];if(k[1].test(t)){
      /* long messages that also mention a real question go to the search, e.g. "thanks, and how much does it cost?" */
      if(t.split(" ").length>7&&k[0]!=="how_are_you")return"";if((k[0]==="who"||k[0]==="human")&&t.split(" ").length>6)return"";return k[0]}}return""}
  function talk(k){var b=(DATA&&DATA.bot&&DATA.bot.chat)||{},v=b[k]||TALK_DEF[k]||"";
    if(k==="thanks"&&lang()!=="en"&&!b.thanks&&TR[lang()])v=TR[lang()].thanks;
    if(k==="time"){try{v=v.replace("{time}",new Date().toLocaleString("en-NZ",{timeZone:"Pacific/Auckland",weekday:"long",day:"numeric",month:"long",hour:"numeric",minute:"2-digit"}))}catch(e){v=v.replace("{time}",new Date().toLocaleString())}}
    return v}
  function ask(q){lastQ=q;push({who:"me",x:q});if(window.gtag)gtag("event","chat_question");
    var t=typing();load().then(function(){setTimeout(function(){t.remove();answer(q)},280+Math.min(500,q.length*8))}).catch(function(){t.remove();addBot({t:"text",x:L("not_found")});addBot({t:"actions",q:q})})}
  function answer(q){var s=q.trim();
    var tk=talkKey(s);
    if(tk==="greet"){addBot({t:"text",x:L("greeting")});addBot({t:"chips",items:(DATA.bot.suggestions||[]).slice(0,6)});return}
    if(tk){addBot({t:"text",x:talk(tk)});if(tk==="help"||tk==="who"||tk==="good"||tk==="how_are_you"||tk==="test")addBot({t:"chips",items:(DATA.bot.suggestions||[]).slice(0,6)});
      else if(tk==="human")addBot({t:"actions",q:""});return}
    var res=search(s),top=res[0],wantsContact=CONTACT.test(s);
    var good=top&&(top.cov>=.6||(top.cov>=.5&&(top.D.d.k==="qa"||top.D.d.k==="faq"||top.s>8))),links=[],used={};
    if(wantsContact&&!(good&&top.D.d.k==="qa"&&top.cov>=.67)){addBot({t:"contact"});addBot({t:"actions",q:s});return}
    if(good){var d=top.D.d;used[d.u||"_"]=1;
      if(d.k==="qa"||d.k==="faq"){addBot({t:"answer",title:d.k==="faq"?d.q:"",x:d.a,u:d.u&&d.u!==location.pathname?d.u:"",l:d.l||""})}
      else addBot({t:"answer",title:d.t,x:snippet(d,s,320),u:d.u,l:""});
      res.slice(1,12).forEach(function(r){var x=r.D.d;if(links.length>=2||used[x.u]||!x.u||r.s<top.s*.45||r.cov<.34)return;used[x.u]=1;links.push({t:x.k==="sec"?x.t.split(": ").pop():x.t,u:x.u,s:x.k==="faq"||x.k==="qa"?"":snippet(x,s,110)})});
      if(links.length)addBot({t:"text",x:"",links:links});
      if(wantsContact)addBot({t:"contact"});addBot({t:"actions",q:s});return}
    if(wantsContact){addBot({t:"contact"});addBot({t:"actions",q:s});return}
    /* nothing about us in the question at all: a general question we can't answer, so say so and suggest topics */
    if(!top||top.cov<=.5){addBot({t:"text",x:talk("offtopic")});addBot({t:"actions",q:s});return}
    var some=res.filter(function(r){return r.cov>=.34&&r.D.d.u}).slice(0,6);some.forEach(function(r){var x=r.D.d;if(links.length>=3||used[x.u])return;used[x.u]=1;links.push({t:x.k==="sec"?x.t.split(": ").pop():x.t,u:x.u,s:snippet(x,s,110)})});
    addBot({t:"text",x:L("not_found"),links:links});addBot({t:"actions",q:s})}

  /* ---- offering help after a while: once per visit, counted across pages while the page is on screen ---- */
  var nudgeEl=null;
  function sget(k){try{return sessionStorage.getItem(k)}catch(e){return null}}function sset(k,v){try{sessionStorage.setItem(k,v)}catch(e){}}
  function nudgeTimer(){if(!NUDGE||sget("ambs:nudged")||state.msgs.length||/^\/booking-confirmed/.test(location.pathname))return;
    var spent=+(sget("ambs:time")||0),here=0,iv=setInterval(function(){if(document.hidden)return;spent++;here++;sset("ambs:time",spent);
      if(state.open||sget("ambs:nudged")){clearInterval(iv);return}
      if(spent>=NUDGE_AFTER&&here>=8){clearInterval(iv);showNudge()}},1000)}
  function showNudge(){sset("ambs:nudged","1");css();nudgeEl=el("div","ac-nudge");nudgeEl.setAttribute("role","status");
    nudgeEl.innerHTML='<p></p><button type="button" class="ac-nx">'+ICO.x+'</button>';nudgeEl.querySelector("p").textContent=L("nudge");nudgeEl.querySelector(".ac-nx").setAttribute("aria-label",L("close"));
    nudgeEl.addEventListener("click",function(ev){if(ev.target.closest(".ac-nx")){hideNudge();return}hideNudge();open();if(window.gtag)gtag("event","chat_nudge_open")});
    document.body.appendChild(nudgeEl);requestAnimationFrame(function(){requestAnimationFrame(function(){nudgeEl&&nudgeEl.classList.add("on")})});
    if(window.gtag)gtag("event","chat_nudge_shown");setTimeout(hideNudge,30000)}
  function hideNudge(){if(!nudgeEl)return;var n=nudgeEl;nudgeEl=null;n.classList.remove("on");setTimeout(function(){n.remove()},450)}

  /* ---- the button that opens it ---- */
  function start(){restore();css();
    openBtn=el("button","ac-launch");openBtn.type="button";openBtn.innerHTML='<span class="ac-dot" aria-hidden="true"></span>'+ICO.chat.replace("<svg",'<svg style="display:none"')+'<span></span>';openBtn.querySelector("span:last-child").textContent=L("launcher");
    openBtn.setAttribute("aria-haspopup","dialog");openBtn.addEventListener("click",open);document.body.appendChild(openBtn);document.body.classList.add("ac-has");
    var qb=document.querySelector(".qbar");if(qb&&!qb.querySelector(".qb-ask")){var a=el("a","qb-ask");a.href="#ask";a.innerHTML=ICO.chat+"<span></span>";a.querySelector("span").textContent=L("launcher");
      a.addEventListener("click",function(ev){ev.preventDefault();open()});qb.appendChild(a);document.body.classList.add("ac-qbar");
      /* on phones the bar holds the button; while the bar is tucked away the round button shows instead */
      var sync=function(){var on=getComputedStyle(qb).display!=="none"&&!qb.classList.contains("away");document.body.classList.toggle("ac-qbar-on",on)};
      new MutationObserver(sync).observe(qb,{attributes:true,attributeFilter:["class","style"]});addEventListener("resize",sync);sync()}
    if(location.hash==="#ask")open();else if(state.open)open();
    /* the homepage switches language without reloading: follow it */
    new MutationObserver(function(){labels();if(root&&DATA&&state.msgs.length===0&&log.children.length){log.innerHTML="";welcome()}}).observe(document.documentElement,{attributes:true,attributeFilter:["lang"]});
    nudgeTimer();
    window.AMBS_CHAT_OPEN=open;window.AMBS_CHAT_SEARCH=function(q,n){return load().then(function(){return search(q).slice(0,n||6).map(function(r){return[r.D.d.k,r.D.d.t,+r.s.toFixed(2),+r.cov.toFixed(2)]})})};
    document.addEventListener("click",function(ev){var a=ev.target.closest&&ev.target.closest('a[href="#ask"],a[href="/#ask"]');if(a&&!a.classList.contains("qb-ask")){ev.preventDefault();open()}})}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
