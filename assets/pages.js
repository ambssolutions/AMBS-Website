/* AMBS sub-pages: theme, menu, table of contents, reading progress, motion */
(function(){
  var calm=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches;
  var root=document.documentElement;
  /* theme toggle: same sessionStorage key as the home page, so the choice carries across pages */
  var tb=document.getElementById("themeBtn");
  function icon(){if(tb)tb.innerHTML=root.dataset.theme==="dark"
    ?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    :'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';}
  icon();
  if(tb)tb.addEventListener("click",function(){var t=root.dataset.theme==="dark"?"light":"dark";root.dataset.theme=t;try{sessionStorage.setItem("ambs:theme",t)}catch(e){}icon();});
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
  /* hub filters (guides / industries) */
  document.querySelectorAll(".filters").forEach(function(f){
    var grid=document.getElementById(f.dataset.for);if(!grid)return;
    f.addEventListener("click",function(e){var b=e.target.closest("button");if(!b)return;
      f.querySelectorAll("button").forEach(function(x){x.setAttribute("aria-pressed",String(x===b));});
      grid.querySelectorAll(".card").forEach(function(c){c.hidden=b.dataset.f!=="all"&&c.dataset.cat!==b.dataset.f;});});
  });
  if(calm)return;
  /* headline rises in word by word */
  var h1=document.querySelector(".phero h1");
  if(h1){var n=0;h1.innerHTML=h1.textContent.split(/(\s+)/).map(function(w){return /^\s+$/.test(w)?" ":w?'<span class="tx-w" style="--wi:'+(n++)+'">'+w.replace(/&/g,"&amp;").replace(/</g,"&lt;")+'</span>':"";}).join("");
    requestAnimationFrame(function(){requestAnimationFrame(function(){h1.classList.add("tx-in");});});}
  /* everything else eases up as it scrolls into view */
  if("IntersectionObserver" in window){
    var els=document.querySelectorAll(".plead,.pmeta,.prose>*,.toc-box,.card,.cta,.section-h,.ftr-grid>div");
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
