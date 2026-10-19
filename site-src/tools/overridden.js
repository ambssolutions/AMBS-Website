const fs=require('fs'),postcss=require('postcss'),sp=require('postcss-selector-parser');
const root=postcss.parse(fs.readFileSync(process.argv[2],'utf8'));
const ctxOf=n=>{const c=[];let p=n.parent;while(p&&p.type!=='root'){if(p.type==='atrule')c.unshift('@'+p.name+' '+p.params.replace(/\s+/g,' ').trim());p=p.parent}return c};
const risky=v=>/-webkit-|-moz-|-ms-|dvh|svh|lvh|color-mix|oklch|lch\(|lab\(|@supports|-apple-|env\(/.test(v);
const norm=s=>{try{return sp().astSync(s).nodes.map(x=>x.toString().replace(/\s+/g,' ').trim())}catch(e){return null}};
// list all declarations in order
const decls=[];let i=0;
root.walkRules(rule=>{if(rule.parent&&rule.parent.type==='atrule'&&/keyframes/.test(rule.parent.name))return;const ctx=ctxOf(rule);if(ctx.some(c=>/^@(supports|layer|container|document)/.test(c)))return;
 const sels=norm(rule.selector);if(!sels)return;
 rule.each(d=>{if(d.type!=='decl')return;decls.push({i:i++,d,rule,ctx,sels,prop:d.prop.toLowerCase(),imp:!!d.important})})});
// index later declarations by selector+prop
const idx=new Map();for(const x of decls)for(const s of x.sels){const k=s+'\u0000'+x.prop;if(!idx.has(k))idx.set(k,[]);idx.get(k).push(x)}
const prefix=(a,b)=>a.length<=b.length&&a.every((c,j)=>c===b[j]); // later ctx a is prefix of earlier ctx b
let removed=0;
for(const x of decls){if(x.prop.startsWith('--'))continue;if(risky(x.d.value))continue;
 const ok=x.sels.every(s=>(idx.get(s+'\u0000'+x.prop)||[]).some(y=>y.i>x.i&&prefix(y.ctx,x.ctx)&&(y.imp||!x.imp)&&!risky(y.d.value)));
 if(ok){x.dead=true}}
// a later non-important declaration loses to an earlier !important one for the same selector whenever the later one could apply
for(const x of decls){if(x.dead||x.imp||x.prop.startsWith('--')||risky(x.d.value))continue;
 const ok=x.sels.every(s=>(idx.get(s+'\u0000'+x.prop)||[]).some(y=>y.i<x.i&&!y.dead&&y.imp&&prefix(y.ctx,x.ctx)&&!risky(y.d.value)));
 if(ok)x.dead=true}
for(const x of decls)if(x.dead){x.d.remove();removed++}
root.walkRules(r=>{if(r.nodes&&r.nodes.length===0)r.remove()});root.walkAtRules(a=>{if(a.nodes&&a.nodes.length===0)a.remove()});
fs.writeFileSync(process.argv[3],root.toString());console.log('declarations',decls.length,'removed',removed);
