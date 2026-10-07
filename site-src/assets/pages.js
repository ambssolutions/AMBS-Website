/* AMBS sub-pages: theme, menu, table of contents, reading progress, motion */
(function(){
  var calm=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root=document.documentElement;
  /* theme toggle: same sessionStorage key as the home page, so the choice carries across pages */
  var tb=document.getElementById("themeBtn");
  function icon(){if(tb)tb.innerHTML=root.dataset.theme==="dark"
    ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';}
  var pair=[].slice.call(document.querySelectorAll(".sh-pair [data-settheme]"));
  function setTheme(t){root.dataset.theme=t;try{sessionStorage.setItem("ambs:theme",t)}catch(e){}icon();}
  var _icon=icon;icon=function(){_icon();pair.forEach(function(b){b.setAttribute("aria-pressed",String(b.dataset.settheme===(root.dataset.theme==="dark"?"dark":"light")));});};
  icon();
  if(tb)tb.addEventListener("click",function(){setTheme(root.dataset.theme==="dark"?"light":"dark");});
  /* phones and tablets: the light / dark switch lives in the menu, like the home page */
  pair.forEach(function(b){b.addEventListener("click",function(){setTheme(b.dataset.settheme);});});
  /* mobile menu */
  var mt=document.getElementById("menuBtn"),nav=document.getElementById("siteNav");
  if(mt&&nav){
    var dim=document.createElement("div");dim.className="sh-dim";document.body.appendChild(dim);
    var setOpen=function(o){nav.classList.toggle("open",o);dim.classList.toggle("on",o);mt.setAttribute("aria-expanded",String(o));};
    mt.addEventListener("click",function(){setOpen(!nav.classList.contains("open"));});
    dim.addEventListener("click",function(){setOpen(false);});
    document.addEventListener("keydown",function(e){if(e.key==="Escape"&&nav.classList.contains("open")){setOpen(false);mt.focus();}});
    nav.addEventListener("click",function(e){if(e.target.closest("a"))setOpen(false);});
  }
  /* table of contents from the article's h2s */
  var prose=document.querySelector(".prose"),toc=document.getElementById("tocList");
  if(prose&&toc){
    var hs=[].slice.call(prose.querySelectorAll("h2"));
    hs.forEach(function(h){
      if(!h.id)h.id=h.textContent.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
      var li=document.createElement("li"),a=document.createElement("a");a.href="#"+h.id;a.textContent=h.textContent.replace(/^\d+\.\s*/,"");li.appendChild(a);toc.appendChild(li);
    });
    if(!hs.length){var box=document.querySelector(".toc");if(box)box.remove();}
    if("IntersectionObserver" in window){
      var links=[].slice.call(toc.querySelectorAll("a"));
      var spy=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){links.forEach(function(l){l.classList.toggle("on",l.getAttribute("href")==="#"+e.target.id);});}});},{rootMargin:"-20% 0px -70% 0px"});
      hs.forEach(function(h){spy.observe(h);});
    }
  }
  /* reading progress */
  var bar=document.querySelector(".progress");
  if(bar){var tick=false;function upd(){tick=false;var h=document.documentElement.scrollHeight-innerHeight;bar.style.width=(h>0?scrollY/h*100:0)+"%";}
    addEventListener("scroll",function(){if(!tick){tick=true;requestAnimationFrame(upd);}},{passive:true});upd();}
  /* hub filters and search (guides / news): a card shows when it is in the chosen category and has every word searched for */
  (function(){
    var grid=document.getElementById("hubGrid");if(!grid)return;
    var f=document.querySelector('.filters[data-for="hubGrid"]'),q=document.querySelector('.hub-search input'),none=document.getElementById("hubNone");
    var cat="all";
    function norm(t){return String(t||"").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"");}
    function apply(){var words=norm(q&&q.value).split(/\s+/).filter(Boolean),shown=0;
      grid.querySelectorAll(".card").forEach(function(c){var txt=norm(c.textContent+" "+c.dataset.cat);
        var ok=(cat==="all"||c.dataset.cat===cat)&&words.every(function(w){return txt.indexOf(w)>=0;});c.hidden=!ok;if(ok)shown++;});
      if(none)none.hidden=shown>0;}
    function pick(v){cat=v;if(f)f.querySelectorAll("button").forEach(function(x){x.setAttribute("aria-pressed",String(x.dataset.f===v));});apply();}
    if(f)f.addEventListener("click",function(e){var b=e.target.closest("button");if(b)pick(b.dataset.f);});
    if(q)q.addEventListener("input",apply);
    /* /news?c=Category opens with that category chosen */
    try{var want=new URLSearchParams(location.search).get("c");
      if(want&&f&&f.querySelector('button[data-f="'+want.replace(/["\\]/g,"")+'"]'))pick(want);}catch(e){}
  })();
  if(calm)return;
  /* headline rises in word by word */
  var h1=document.querySelector(".phero h1");
  if(h1){var n=0;h1.innerHTML=h1.textContent.split(/(\s+)/).map(function(w){return /^\s+$/.test(w)?" ":w?'<span class="tx-w" style="--wi:'+(n++)+'">'+w.replace(/&/g,"&amp;").replace(/</g,"&lt;")+'</span>':"";}).join("");
    requestAnimationFrame(function(){requestAnimationFrame(function(){h1.classList.add("tx-in");});});}
  /* everything else eases up as it scrolls into view */
  if("IntersectionObserver" in window){
    var els=document.querySelectorAll(".plead,.pmeta,.prose>*,.toc-box,.card,.svc-card,.svc-steps li,.cta,.section-h,.ftr-grid>div");
    var io=new IntersectionObserver(function(es){var v=es.filter(function(e){return e.isIntersecting;});
      v.forEach(function(e,i){e.target.style.setProperty("--rd",Math.min(i,6)*70+"ms");e.target.classList.add("in");io.unobserve(e.target);});},{threshold:.08,rootMargin:"0px 0px -4% 0px"});
    els.forEach(function(el){el.classList.add("reveal");io.observe(el);});
  }
})();

/* answers: words rise in one after another each time a question is opened */
(function(){
  function animate(el){
    if(!el||!el.textContent.trim())return;
    if(el.childElementCount===0&&!el.querySelector(".ow")){
      var n=0;el.innerHTML=el.textContent.split(/(\s+)/).map(function(w){return !w?"":/^\s+$/.test(w)?" ":'<span class="ow" style="--wi:'+(n++)+'">'+w.replace(/&/g,"&amp;").replace(/</g,"&lt;")+"</span>";}).join("");
    }
    var cls=el.querySelector(".ow")?"ow-go":"ow-fade";
    el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);
  }
  document.querySelectorAll("details").forEach(function(d){
    d.addEventListener("toggle",function(){if(d.open)[].forEach.call(d.querySelectorAll(":scope > :not(summary)"),function(x){animate(x);});});
  });
})();

/* services: a soft glow follows the pointer across each service card */
(function(){if(!matchMedia("(hover:hover) and (pointer:fine)").matches)return;
  document.querySelectorAll(".svc-card").forEach(function(c){var raf=0,x=0,y=0;
    c.addEventListener("pointermove",function(e){var r=c.getBoundingClientRect();x=e.clientX-r.left;y=e.clientY-r.top;
      if(!raf)raf=requestAnimationFrame(function(){raf=0;c.style.setProperty("--gx",x+"px");c.style.setProperty("--gy",y+"px");});});});
})();

/* guides: hours-back calculator and a minutes-left pill */
(function(){
  var f=function(id){return document.getElementById(id);};
  if(f("rTimes")){
    var last="";
    function calc(){var t=+f("rTimes").value,m=+f("rMins").value,s=+f("rShare").value/100;
      f("cTimes").textContent=t;f("cMins").textContent=m;f("cShare").textContent=Math.round(s*100)+"%";
      var wk=t*m/60,yr=Math.round(wk*s*48);
      f("cNow").textContent=wk<10?wk.toFixed(1):Math.round(wk);
      var y=f("cYear");if(String(yr)!==last){y.textContent=yr.toLocaleString("en-NZ");y.classList.remove("g-pop");void y.offsetWidth;y.classList.add("g-pop");last=String(yr);}}
    ["rTimes","rMins","rShare"].forEach(function(id){f(id).addEventListener("input",calc);});calc();
  }
  var prose=document.querySelector(".prose");if(!prose||(prose.textContent||"").split(/\s+/).length<250)return;
  var pill=document.createElement("div");pill.className="g-left";pill.setAttribute("aria-hidden","true");pill.innerHTML='<svg class="g-edge" aria-hidden="true"><path class="g-edge-bg" pathLength="100"/><path class="g-edge-on" pathLength="100"/></svg><span></span>';
  /* sits in the header bar, beside the light/dark button */
  var tb=document.getElementById("themeBtn");
  if(tb&&tb.parentNode){pill.classList.add("in-hdr");tb.parentNode.insertBefore(pill,tb.nextSibling);}else document.body.appendChild(pill);
  var words=(prose.textContent||"").split(/\s+/).length,txt=pill.querySelector("span"),ring=pill.querySelector("i"),tick=false;
  /* the progress runs around the pill's own border, starting at the top centre */
  var lastW=0;
  function edge(){var w=pill.offsetWidth,h=pill.offsetHeight;if(!w||w===lastW)return;lastW=w;var s=1.25,r=h/2-s,t=s,b=h-s;
    var d="M"+(w/2)+" "+t+"H"+(w-h/2)+"A"+r+" "+r+" 0 0 1 "+(w-h/2)+" "+b+"H"+(h/2)+"A"+r+" "+r+" 0 0 1 "+(h/2)+" "+t+"Z";
    var svg=pill.querySelector("svg");svg.setAttribute("viewBox","0 0 "+w+" "+h);svg.querySelectorAll("path").forEach(function(pt){pt.setAttribute("d",d);});}
  function upd(){tick=false;var r=prose.getBoundingClientRect(),total=r.height-innerHeight*.5,done=Math.min(1,Math.max(0,(innerHeight*.5-r.top)/Math.max(1,total)));
    var left=Math.ceil(words*(1-done)/220);
    pill.style.setProperty("--pc",Math.round(done*100));
    txt.textContent=left<=0?"Finished":left+" min left";edge();
    pill.classList.toggle("on",r.top<innerHeight*.3&&done<.985);}
  addEventListener("scroll",function(){if(!tick){tick=true;requestAnimationFrame(upd);}},{passive:true});upd();
})();

/* links to the home page fade this page out first, then the home page fades in on its section */
(function(){if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href]");if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||a.target==="_blank")return;
    var h=a.getAttribute("href");if(!/^\/(#[\w-]+)?$/.test(h))return;
    e.preventDefault();document.body.classList.add("leaving");setTimeout(function(){location.href=h;},260);});
  addEventListener("pageshow",function(e){if(e.persisted)document.body.classList.remove("leaving");});
})();

/* language picker: these pages are in English, so another language opens the home page in that language */
(function(){var s=document.getElementById("langselect");if(!s)return;s.value="en";
  s.addEventListener("change",function(){var v=s.value;if(v==="en")return;try{sessionStorage.setItem("ambs:lang",v);}catch(e){}
    document.body.classList.add("leaving");setTimeout(function(){location.href="/";},calmMs());});
  function calmMs(){return matchMedia("(prefers-reduced-motion: reduce)").matches?0:260;}
})();

/* quick bar: the green blob flows to the button you touch or hover, then back to Call */
(function(){document.querySelectorAll(".qbar").forEach(function(bar){
  var blob=document.createElement("span");blob.className="qb-blob";blob.setAttribute("aria-hidden","true");bar.insertBefore(blob,bar.firstChild);
  var links=[].slice.call(bar.querySelectorAll("a")),cur=-1;
  function go(i){var a=links[i];if(!a)return;bar.style.setProperty("--bx",a.offsetLeft+"px");bar.style.setProperty("--bw",a.offsetWidth+"px");
    links.forEach(function(l,k){l.classList.toggle("on",k===i);});
    if(cur!==-1&&cur!==i){blob.classList.remove("flow");void blob.offsetWidth;blob.classList.add("flow");}cur=i;}

  bar.style.setProperty("--bx",links[0].offsetLeft+"px");
});})();

/* quick bar v2: no resting highlight; the glass drop appears where you press, then fades */
(function(){document.querySelectorAll(".qbar").forEach(function(bar){
  var blob=bar.querySelector(".qb-blob");if(!blob)return;var links=[].slice.call(bar.querySelectorAll("a")),hideT;
  function show(i){var a=links[i];clearTimeout(hideT);blob.style.transition="none";bar.style.setProperty("--bx",a.offsetLeft+"px");bar.style.setProperty("--bw",a.offsetWidth+"px");
    void blob.offsetWidth;blob.style.transition="";links.forEach(function(l){l.classList.remove("on");});
    blob.classList.add("show");blob.classList.remove("press");void blob.offsetWidth;blob.classList.add("press");}
  function hide(){clearTimeout(hideT);hideT=setTimeout(function(){blob.classList.remove("show");},260);}
  links.forEach(function(a,i){a.addEventListener("pointerdown",function(){show(i);});});
  ["pointerup","pointercancel","pointerleave"].forEach(function(ev){bar.addEventListener(ev,hide);});
  addEventListener("pageshow",function(){blob.classList.remove("show");});
  blob.classList.remove("show");links.forEach(function(l){l.classList.remove("on");});
});})();

/* hide the Call | Book bar while the hero buttons or another Book/Call button is in view */
(function(){var bar=document.querySelector(".qbar");if(!bar||!("IntersectionObserver" in window))return;
  var on=new Set();bar.classList.add("away");
  var io=new IntersectionObserver(function(es){es.forEach(function(e){var t=e.target,hit=t.matches(".phero")?(e.isIntersecting&&e.intersectionRatio>0.25):e.isIntersecting;if(hit)on.add(t);else on.delete(t);});bar.classList.toggle("away",on.size>0);},{threshold:[0,0.25,0.5,1]});
  document.querySelectorAll('.hero-cta,.phero,#book,footer.f2,main .btns,main a[href*="#book"]:not(.kh-gc),main a[href^="tel:"]').forEach(function(el){io.observe(el);});
})();

/* Call | Book shimmer: a short burst every few seconds, skipped while scrolling */
(function(){var bar=document.querySelector(".qbar");if(!bar||matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  var lastScroll=0;addEventListener("scroll",function(){lastScroll=Date.now();},{passive:true});
  function shine(){if(document.hidden||bar.classList.contains("away")||Date.now()-lastScroll<500||getComputedStyle(bar).display==="none")return;
    bar.classList.remove("shine");void bar.offsetWidth;bar.classList.add("shine");setTimeout(function(){bar.classList.remove("shine");},2200);}
  setInterval(shine,6000);setTimeout(shine,1500);
})();

/* pause animations in sections that are off screen */
(function(){if(!("IntersectionObserver" in window))return;
  var secs=[].slice.call(document.querySelectorAll("main > section, main > div, .hero, #docket, .auto-strip, .wd-panel, .wd-stage, .kh-deck, .g-art, footer, body > section"));
  var io=new IntersectionObserver(function(es){es.forEach(function(e){e.target.classList.toggle("anim-off",!e.isIntersecting);});},{rootMargin:"120px 0px 120px 0px"});
  secs.forEach(function(s){io.observe(s);});
})();

/* keep the site up to date on every page, the same way as the home page:
   in the installed app, say "Updated" once when it opens on a newer version, and offer a one-tap refresh
   when a new version goes live while the app is open; in a browser tab, switch quietly */
(function(){
  var isApp=(window.matchMedia&&matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true;
  var loaded=null,reg=null,reloading=false;
  function read(){return fetch("/version.json?t="+Date.now(),{cache:"no-store"}).then(function(r){return r.json();}).then(function(d){return String(d.build||"");}).catch(function(){return "";});}
  function note(){var n=document.createElement("div");n.className="updatebar updatebar--done";n.setAttribute("role","status");
    n.innerHTML='<span>&#10003;&nbsp; Updated to the latest version.</span>';document.body.appendChild(n);
    requestAnimationFrame(function(){requestAnimationFrame(function(){n.classList.add("on");});});
    function hide(){n.classList.remove("on");setTimeout(function(){n.remove();},400);}n.addEventListener("click",hide);setTimeout(hide,8000);}
  function offer(){
    if(reloading)return;
    if(!isApp){var w=reg&&(reg.waiting||reg.installing);if(w)w.postMessage("SKIP_WAITING");return;}
    if(document.getElementById("updatebar"))return document.getElementById("updatebar").classList.add("on");
    var b=document.createElement("div");b.id="updatebar";b.className="updatebar";
    b.innerHTML='<span>New version ready</span><button type="button" id="updatego">Refresh</button><button type="button" id="updatelater" aria-label="Not now">&times;</button>';
    document.body.appendChild(b);
    b.querySelector("#updatego").addEventListener("click",function(){reloading=true;var w=reg&&(reg.waiting||reg.installing);if(w)w.postMessage("SKIP_WAITING");setTimeout(function(){location.reload();},600);});
    b.querySelector("#updatelater").addEventListener("click",function(){b.remove();});
    requestAnimationFrame(function(){b.classList.add("on");});
  }
  function check(){read().then(function(v){if(!v)return;if(loaded===null){loaded=v;return;}if(v!==loaded){if(reg)reg.update().catch(function(){});offer();}});}
  var hadWorker=!!(navigator.serviceWorker&&navigator.serviceWorker.controller);
  if("serviceWorker" in navigator){addEventListener("load",function(){navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"}).then(function(r){reg=r;}).catch(function(){});});}
  read().then(function(v){if(!v)return;loaded=v;
    var key=isApp?"ambs:appbuild":"ambs:build",seen=null;try{seen=localStorage.getItem(key);if(isApp&&!seen)seen=localStorage.getItem("ambs:build");localStorage.setItem(key,v);}catch(e){}
    if(isApp&&((seen&&seen!==v)||(!seen&&hadWorker)))note();});
  document.addEventListener("visibilitychange",function(){if(document.visibilityState==="visible"){if(reg)reg.update().catch(function(){});check();}});
  setInterval(check,30*60*1000);
})();

/* dark mode: the footer logo powers on (grey to full colour) the first time it scrolls into view */
try{(function(){
  var f=document.querySelector("footer .f2-logo img");
  if(!f||!("IntersectionObserver" in window)||(window.matchMedia&&matchMedia("(prefers-reduced-motion:reduce)").matches))return;
  f.classList.add("pre-light");
  new IntersectionObserver(function(es,o){es.forEach(function(e){if(e.isIntersecting){f.classList.remove("pre-light");f.classList.add("is-lit");o.disconnect();}});},{threshold:.5}).observe(f);
})();}catch(e){}
