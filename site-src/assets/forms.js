/* Contact forms made in the website editor (the "Contact form" block).
   Each form is checked in the browser, then sent the same way as the homepage booking form:
   an email through Web3Forms, and a lead in the AMBS portal (portal.ambs.co.nz → Leads). */
(function(){
  var FORM_KEY="b26ce370-6383-473e-926e-ceb49a91e7fd";
  var PORTAL_LEAD_URL="https://portal.ambs.co.nz/api/app?action=lead";
  var MSG={
    en:{req:"Please fill this in",email:"That email address does not look right",phone:"Please check the phone number",choose:"Please choose one",tick:"Please tick this box",sending:"Sending…",err:"Sorry, that didn’t send. Please try again, or email hello@ambs.co.nz."},
    zh:{req:"请填写此项",email:"这个邮箱地址看起来不正确",phone:"请检查电话号码",choose:"请选择一项",tick:"请勾选此项",sending:"正在发送…",err:"抱歉，发送失败。请重试，或发邮件至 hello@ambs.co.nz。"},
    hi:{req:"कृपया इसे भरें",email:"यह ईमेल पता सही नहीं लगता",phone:"कृपया फ़ोन नंबर जाँचें",choose:"कृपया एक विकल्प चुनें",tick:"कृपया इस बॉक्स पर टिक करें",sending:"भेजा जा रहा है…",err:"क्षमा करें, संदेश नहीं भेजा जा सका। कृपया फिर से कोशिश करें, या hello@ambs.co.nz पर ईमेल करें।"},
    pa:{req:"ਕਿਰਪਾ ਕਰਕੇ ਇਹ ਭਰੋ",email:"ਇਹ ਈਮੇਲ ਪਤਾ ਠੀਕ ਨਹੀਂ ਲੱਗਦਾ",phone:"ਕਿਰਪਾ ਕਰਕੇ ਫ਼ੋਨ ਨੰਬਰ ਜਾਂਚੋ",choose:"ਕਿਰਪਾ ਕਰਕੇ ਇੱਕ ਚੁਣੋ",tick:"ਕਿਰਪਾ ਕਰਕੇ ਇਸ ਡੱਬੇ 'ਤੇ ਟਿੱਕ ਕਰੋ",sending:"ਭੇਜਿਆ ਜਾ ਰਿਹਾ ਹੈ…",err:"ਮਾਫ਼ ਕਰਨਾ, ਸੁਨੇਹਾ ਨਹੀਂ ਭੇਜਿਆ ਗਿਆ। ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ, ਜਾਂ hello@ambs.co.nz 'ਤੇ ਈਮੇਲ ਕਰੋ।"},
    mi:{req:"Tēnā, whakakīia tēnei",email:"Kāore e tika ana te āhua o tēnei īmēra",phone:"Tēnā, tirohia anō te nama waea",choose:"Tēnā, kōwhiria tētahi",tick:"Tēnā, tohua tēnei pouaka",sending:"E tukuna ana…",err:"Aroha mai, kāore i tukuna. Tēnā, ngana anō, ka īmēra rānei ki hello@ambs.co.nz."}
  };
  function m(k){var l=(document.documentElement.lang||"en").slice(0,2).toLowerCase();return (MSG[l]||MSG.en)[k];}
  function fields(f){return Array.prototype.filter.call(f.querySelectorAll("input,select,textarea"),function(x){return x.name&&x.name!=="botcheck";});}
  function clear(x){var w=x.closest(".blk-fld");if(!w)return;w.classList.remove("bad");x.removeAttribute("aria-invalid");var e=w.querySelector(".blk-err");if(e)e.remove();}
  function bad(x,msg){var w=x.closest(".blk-fld");if(!w)return;clear(x);w.classList.add("bad");x.setAttribute("aria-invalid","true");
    var e=document.createElement("p");e.className="blk-err";e.id=x.id+"-err";e.textContent=msg;w.appendChild(e);x.setAttribute("aria-describedby",e.id);}
  function check(x){
    var v=x.type==="checkbox"?x.checked:String(x.value||"").trim(),k=x.dataset.kind;
    if(x.required&&!v){bad(x,m(x.type==="checkbox"?"tick":x.tagName==="SELECT"?"choose":"req"));return false;}
    if(v&&k==="email"&&!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(v)){bad(x,m("email"));return false;}
    if(v&&k==="phone"){var d=v.replace(/\D/g,"");if(d.length<7||d.length>15){bad(x,m("phone"));return false;}}
    clear(x);return true;
  }
  function val(x){return x.type==="checkbox"?(x.checked?"Yes":"No"):String(x.value||"").trim();}
  function first(list,kind){var x=list.filter(function(y){return y.dataset.kind===kind&&val(y);})[0];return x?val(x):"";}
  function wire(f){
    if(f.dataset.wired)return;f.dataset.wired="1";
    fields(f).forEach(function(x){x.addEventListener(x.type==="checkbox"||x.tagName==="SELECT"?"change":"input",function(){if(x.closest(".bad"))check(x);});
      x.addEventListener("blur",function(){if(val(x)&&x.type!=="checkbox")check(x);});});
    f.addEventListener("submit",function(ev){
      ev.preventDefault();
      var list=fields(f),ok=true,firstBad=null;
      list.forEach(function(x){if(!check(x)){ok=false;firstBad=firstBad||x;}});
      if(!ok){firstBad.focus();return;}
      var btn=f.querySelector("button[type=submit]"),label=btn.innerHTML,name=f.dataset.formName||"Contact form";
      var hp=f.querySelector("[name=botcheck]");
      var done=function(){var okEl=f.querySelector(".blk-form-ok");f.classList.add("sent");if(okEl){okEl.hidden=false;okEl.focus();}f.reset();};
      if(hp&&hp.value){done();return;}           /* filled in by a bot: pretend it went */
      var lines=list.map(function(x){return x.name+": "+val(x);});
      var lang=document.documentElement.lang||"en";
      /* the lead in the portal */
      try{
        var lead=JSON.stringify({name:first(list,"name"),company:"",email:first(list,"email"),phone:first(list,"phone"),service:"Website form: "+name,
          message:lines.join("\n"),page:location.href.split("#")[0],extra:{language:lang,form:name},hp:""});
        if(!(navigator.sendBeacon&&navigator.sendBeacon(PORTAL_LEAD_URL,new Blob([lead],{type:"text/plain"}))))
          fetch(PORTAL_LEAD_URL,{method:"POST",mode:"no-cors",keepalive:true,headers:{"Content-Type":"text/plain"},body:lead});
      }catch(e){}
      /* the email */
      var data={access_key:FORM_KEY,subject:name+" — "+(first(list,"name")||"website")+" ("+location.pathname+")",from_name:"ambs.co.nz website",
        form:name,page:location.href,language:lang};
      list.forEach(function(x){data[x.name]=val(x);});
      var em=first(list,"email");if(em)data.email=em;
      btn.disabled=true;btn.textContent=m("sending");
      fetch("https://api.web3forms.com/submit",{method:"POST",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify(data)})
        .then(function(r){return r.json();}).then(function(d){if(!d||!d.success)throw new Error("send failed");btn.disabled=false;btn.innerHTML=label;done();})
        .catch(function(){btn.disabled=false;btn.innerHTML=label;alert(m("err"));});
    });
  }
  function init(){Array.prototype.forEach.call(document.querySelectorAll("form[data-blk-form]"),wire);}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init);else init();
  window.AMBS_FORMS=init;
})();
