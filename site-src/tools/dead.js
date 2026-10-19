const fs=require('fs'),path=require('path'),postcss=require('postcss'),sp=require('postcss-selector-parser');
const ROOT=require('path').resolve(__dirname,'..','..');
// corpus: every text source in the repo except style sheets and generated pages for other routes
let corpus='';const walk=d=>{for(const f of fs.readdirSync(d)){if(['node_modules','.git'].includes(f))continue;const p=path.join(d,f);const st=fs.statSync(p);if(st.isDirectory())walk(p);else if(/\.(html|js|mjs|py|json|md)$/.test(f)&&st.size<8e6&&!/chat-index\.json$/.test(f))corpus+=fs.readFileSync(p,'utf8')+'\n'}};walk(ROOT);
const alive=new Map();const isAlive=n=>{if(!alive.has(n))alive.set(n,corpus.includes(n));return alive.get(n)};
const src=fs.readFileSync(process.argv[2],'utf8');const root=postcss.parse(src);
let rulesRemoved=0,selRemoved=0,deadNames=new Set();
root.walkRules(rule=>{if(rule.parent&&rule.parent.type==='atrule'&&/keyframes/.test(rule.parent.name))return;
  let sels;try{sels=sp().astSync(rule.selector)}catch(e){return}
  const keep=[];sels.each(sel=>{let dead=false;sel.walk(n=>{if(n.type==='class'&&!isAlive(n.value)){dead=true;deadNames.add('.'+n.value)}if(n.type==='id'&&!isAlive(n.value)){dead=true;deadNames.add('#'+n.value)}});if(dead)selRemoved++;else keep.push(sel.toString().trim())});
  if(!keep.length){rule.remove();rulesRemoved++}else if(keep.length!==sels.nodes.length)rule.selector=keep.join(',')});
root.walkAtRules(a=>{if(a.name!=='keyframes'&&a.nodes&&a.nodes.length===0)a.remove()});
fs.writeFileSync(process.argv[3],root.toString());
console.log('rules removed',rulesRemoved,'selectors removed',selRemoved,'dead names',deadNames.size);console.log([...deadNames].slice(0,80).join(' '));
