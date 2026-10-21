(function(){
const s=x=>x==null?'':String(x).trim();
const num=x=>{if(typeof x==='number')return x;const t=s(x).replace(/[^\d,.-]/g,'');if(!t)return 0;const n=t.includes(',')?parseFloat(t.replace(/\./g,'').replace(',','.')):parseFloat(t);return isNaN(n)?0:n};
const wk=x=>{const m=/W\s*(\d+)/i.exec(s(x));return m?'W'+m[1]:s(x).toUpperCase()};
const wn=w=>parseInt(String(w).replace(/\D/g,''),10)||0;
const esc=t=>s(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);


/* ---- Quando a DASH vem sem as tabelas (pivôs vazios), monta tudo pela aba PERDAS SHOPEE ---- */
function fromRaw(p,week,cfg){
  const hr=p.findIndex((r,i)=>i<30&&r&&r.some(c=>/^PERIODO$/i.test(s(c))));
  if(hr<0)throw new Error('Não encontrei a aba PERDAS SHOPEE com a coluna PERIODO.');
  const H=p[hr].map(c=>s(c).toUpperCase()),ip=H.indexOf('PERIODO'),is=H.indexOf('SVC'),id=H.indexOf('DRIVER'),iv=H.indexOf('VALOR'),ic=H.indexOf('DRIVE CHECK');
  const rows=p.slice(hr+1).filter(r=>r&&wk(r[ip])===week);
  const hide=n=>cfg&&cfg.hide?cfg.hide.has(n):/^(XPT-SOC|SOC)-/i.test(n);
  const sm=new Map();rows.forEach(r=>{const n=s(r[is]);if(!n||hide(n))return;const o=sm.get(n)||{n,q:0,v:0};o.q++;o.v+=num(r[iv]);sm.set(n,o)});
  const svc=[...sm.values()].sort((a,b)=>b.q-a.q);
  const dm=new Map();rows.forEach(r=>{if(!(num(r[ic])))return;const n=s(r[is])||'Total',dn=!s(r[is])||(cfg&&cfg.collapse&&cfg.collapse.has(n))?'':s(r[id]),k=n+'|'+dn,o=dm.get(k)||{svc:n,driver:dn,q:0,v:0};o.q++;o.v+=num(r[iv]);dm.set(k,o)});
  const tot={};dm.forEach(o=>tot[o.svc]=(tot[o.svc]||0)+o.q);
  const drv=[...dm.values()].sort((a,b)=>tot[b.svc]-tot[a.svc]||(a.svc<b.svc?-1:a.svc>b.svc?1:0)||b.q-a.q||b.v-a.v);
  return{svc,drv};
}
/* ---- Lê os filtros dos pivôs (SVCs ocultos e SVCs recolhidos) direto do .xlsx ---- */
async function inflate(u8){const st=new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));return new Uint8Array(await new Response(st).arrayBuffer())}
async function zipFiles(u8,want){
  const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength),td=new TextDecoder(),out={};let e=u8.length-22;
  while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;if(e<0)return out;
  const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);
  for(let i=0;i<n;i++){const m=dv.getUint16(p+10,true),cs=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),el=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),off=dv.getUint32(p+42,true),name=td.decode(u8.subarray(p+46,p+46+nl));p+=46+nl+el+cl;
    if(!want(name))continue;const st=off+30+dv.getUint16(off+26,true)+dv.getUint16(off+28,true),d=u8.subarray(st,st+cs);out[name]=td.decode(m===0?d:await inflate(d))}
  return out;
}
const unx=t=>t.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
function pivotCfg(F){
  const cfg={hide:null,collapse:null};
  for(const n in F){if(!/pivotTables\/pivotTable\d+\.xml$/.test(n))continue;
    const x=F[n],loc=/<location ref="([A-Z]+)(\d+)/.exec(x),rel=F[n.replace('pivotTables/','pivotTables/_rels/')+'.rels']||'',cn=/pivotCacheDefinition\d+\.xml/.exec(rel),cd=cn&&F['xl/pivotCache/'+cn[0]];
    if(!loc||!cd)continue;
    const fl=[...cd.matchAll(/<cacheField name="([^"]*)"[^>]*?(?:\/>|>([\s\S]*?)<\/cacheField>)/g)],fi=fl.findIndex(m=>unx(m[1])==='SVC');if(fi<0)continue;
    const names=[...(fl[fi][2]||'').matchAll(/<(s|n|m|d|e|b)\b([^>]*?)\/>/g)].map(m=>{const v=/\bv="([^"]*)"/.exec(m[2]);return v?unx(v[1]):''});
    const pf=[...x.matchAll(/<pivotField\b([^>]*?)(?:\/>|>([\s\S]*?)<\/pivotField>)/g)].find(m=>unx(/\bname="([^"]*)"/.exec(m[1])[1])==='SVC');if(!pf)continue;
    const its=[...(pf[2]||'').matchAll(/<item\b([^>]*?)\/>/g)].map(m=>m[1]).filter(a=>/\bx="/.test(a));
    const pick=re=>new Set(its.filter(a=>re.test(a)).map(a=>names[+/\bx="(\d+)"/.exec(a)[1]]));
    if(loc[1]==='A'&&loc[2]==='9')cfg.hide=pick(/\bh="1"/);
    if(loc[1]==='E'&&loc[2]==='9')cfg.collapse=pick(/\bsd="0"/);
  }
  return cfg;
}

/* ---- LEITURA DA ABA DASH (d) + aba PERDAS SHOPEE (p) para a tabela de causa ---- */
function parseDash(d,p,cfg){
  let week=wk((d[0]||[])[0]),count=0;
  for(let i=0;i<Math.min(d.length,12);i++){const m=/(\d+)\s+PERDAS\s+NA\s+(W\d+)/i.exec(s((d[i]||[])[0]));if(m){count=+m[1];if(!/^W\d+$/.test(week))week=m[2].toUpperCase()}}
  const h=d.findIndex(r=>r&&s(r[0]).toUpperCase()==='SVC');
  const svc=[],drv=[];let svcT=null,drvT=null,L=true,R=true,cur='';
  if(h<0){
    if(!p)throw new Error('Não encontrei as tabelas de SVC na aba DASH.');
    const X=fromRaw(p,week,cfg);svc.push(...X.svc);drv.push(...X.drv);
  }else{
  for(let i=h+1;i<d.length&&(L||R)&&i<h+400;i++){const r=d[i]||[];
    if(L){const a=s(r[0]);
      if(/^total/i.test(a)){svcT={q:num(r[1]),v:num(r[2])};L=false}
      else if(a)svc.push({n:a,q:num(r[1]),v:num(r[2])});
      else if(svc.length)L=false}
    if(R){const e=s(r[4]),f=s(r[5]);
      if(/^total/i.test(e)){drvT={q:num(r[6]),v:num(r[7])};R=false}
      else if(e||f){if(e)cur=e.replace(/\s+total$/i,'');drv.push({svc:cur,driver:f,q:num(r[6]),v:num(r[7])})}
      else if(drv.length)R=false}}
  }
  const sum=(a,k)=>a.reduce((t,x)=>t+x[k],0);
  svcT=svcT||{q:sum(svc,'q'),v:sum(svc,'v')};drvT=drvT||{q:sum(drv,'q'),v:sum(drv,'v')};
  /* causa: usa a tabela da DASH se vier preenchida; senão calcula pela aba PERDAS SHOPEE */
  let causa=[];const ch=d.findIndex((r,i)=>i>h&&r&&/^causa$/i.test(s(r[0])));
  if(ch>=0)for(let i=ch+1;i<d.length;i++){const r=d[i]||[],a=s(r[0]);if(!a||/^total/i.test(a))break;causa.push({n:a,q:num(r[1]),v:num(r[2])})}
  if(!causa.length&&p){
    const hr=p.findIndex((r,i)=>i<30&&r&&r.some(c=>/^PERIODO$/i.test(s(c))));
    if(hr>=0){const H=p[hr].map(c=>s(c).toUpperCase()),ip=H.indexOf('PERIODO'),iv=H.indexOf('VALOR'),ir=H.indexOf('RESPONSAVEL'),m={};
      for(let i=hr+1;i<p.length;i++){const r=p[i];if(!r||wk(r[ip])!==week)continue;const k=s(r[ir])||'Sem responsável';(m[k]=m[k]||{n:k,q:0,v:0});m[k].q++;m[k].v+=num(r[iv])}
      causa=Object.values(m).sort((a,b)=>a.n.localeCompare(b.n,'pt-BR'))}}
  const causaT=causa.length?{q:sum(causa,'q'),v:sum(causa,'v')}:null;
  const total=causaT||{q:count||svcT.q,v:svcT.v};
  if(count)total.q=count;
  if(!svc.length&&!drv.length)throw new Error('A aba DASH está vazia.');
  return{week,svc,svcT,drv,drvT,causa,causaT,total};
}
if(typeof module!=='undefined')module.exports={parseDash,zipFiles,pivotCfg};
if(typeof document==='undefined')return;

/* ---- ARMAZENAMENTO (arquivos salvos) ---- */
const KEY='perdasShopee.v1';let store={},cur='';
try{store=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){store={}}
const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(store))}catch(e){}};
const $=id=>document.getElementById(id);
const sorted=()=>Object.values(store).sort((a,b)=>wn(a.week)-wn(b.week));

/* ---- TELA ---- */
function body(rows,tot,cols){return rows.map(r=>'<tr>'+cols.map((c,i)=>`<td${c.r?' class="r"':''}>${c.f?c.f(r[c.k]):esc(r[c.k]||'—')}</td>`).join('')+'</tr>').join('')+
  (tot?`<tr class="tot"><td colspan="${cols.length-2}">Total geral</td><td class="r">${tot.q}</td><td class="r">${brl(tot.v)}</td></tr>`:'')}
function render(){
  const r=store[cur],ws=sorted();
  $('weekSel').innerHTML=ws.length?ws.map(x=>`<option${x.week===cur?' selected':''}>${x.week}</option>`).join(''):'<option>—</option>';
  const dl=$('delta');dl.hidden=true;
  if(!r){$('title').textContent='SHOPEE PERDAS';$('total').textContent='Importe a planilha para começar.';['tSvc','tCausa','tDrv'].forEach(i=>$(i).innerHTML='');chart();return}
  $('title').textContent=`SHOPEE ${r.total.q} PERDAS NA ${r.week}`;
  $('total').textContent=`TOTAL GERAL DA SEMANA: ${r.total.q} perdas - ${brl(r.total.v)}`;
  const pv=ws.filter(x=>wn(x.week)<wn(r.week)).pop();
  if(pv){const dv=r.total.v-pv.total.v,dq=r.total.q-pv.total.q,pc=pv.total.v?Math.abs(dv/pv.total.v*100):0;
    dl.className='delta'+(dv<0?' down':'');
    dl.textContent=`${dv<0?'▼ Valor caiu':'▲ Valor subiu'} ${brl(Math.abs(dv))} (${pc.toFixed(1).replace('.',',')}%) vs ${pv.week} · ${Math.abs(dq)} perdas ${dq<0?'a menos':'a mais'} que ${pv.week}`;dl.hidden=false}
  $('tSvc').innerHTML=body(r.svc,r.svcT,[{k:'n'},{k:'q',r:1},{k:'v',r:1,f:brl}]);
  $('tCausa').innerHTML=body(r.causa,r.causaT,[{k:'n'},{k:'q',r:1},{k:'v',r:1,f:brl}]);
  $('tDrv').innerHTML=body(r.drv,r.drvT,[{k:'svc'},{k:'driver'},{k:'q',r:1},{k:'v',r:1,f:brl}]);
  chart();
}
function step(v){const p=10**Math.floor(Math.log10(v)),f=v/p;return(f<=1?1:f<=2?2:f<=5?5:10)*p}
function chart(){
  const ws=sorted(),el=$('chart');
  if(!ws.length){el.innerHTML='<p class="mut">Nenhuma semana salva ainda.</p>';return}
  const W=900,H=300,L=88,B=28,T=10,max=Math.max(...ws.map(x=>x.total.v),1),st=step(max/5),top=Math.ceil(max/st)*st,bw=(W-L)/ws.length;let g='';
  for(let y=0;y<=top+1e-6;y+=st){const py=T+(H-T-B)*(1-y/top);g+=`<line x1="${L}" x2="${W}" y1="${py}" y2="${py}" class="gl"/><text x="${L-8}" y="${py+4}" text-anchor="end" class="ax">${brl(y)}</text>`}
  ws.forEach((x,i)=>{const bh=(H-T-B)*x.total.v/top,bx=L+i*bw+bw*.2;
    g+=`<rect class="bar${x.week===cur?' cur':''}" data-w="${x.week}" x="${bx}" y="${H-B-bh}" width="${bw*.6}" height="${bh}"/><text x="${bx+bw*.3}" y="${H-10}" text-anchor="middle" class="ax">${x.week}</text>`});
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}">${g}</svg>`;
}
const tip=$('tip');
$('chart').addEventListener('mousemove',e=>{const w=e.target.dataset&&e.target.dataset.w;if(!w){tip.hidden=true;return}
  const x=store[w],b=$('chart').parentNode.getBoundingClientRect();tip.textContent=`${w} · ${x.total.q} perdas · ${brl(x.total.v)}`;tip.hidden=false;
  tip.style.left=Math.min(e.clientX-b.left+12,b.width-170)+'px';tip.style.top=(e.clientY-b.top-34)+'px'});
$('chart').addEventListener('mouseleave',()=>tip.hidden=true);
$('chart').addEventListener('click',e=>{const w=e.target.dataset&&e.target.dataset.w;if(w){cur=w;render()}});
$('weekSel').addEventListener('change',e=>{if(store[e.target.value]){cur=e.target.value;render()}});

/* ---- IMPORTAÇÃO ---- */
function msg(t,err){const m=$('msg');m.textContent=t;m.className='msg'+(err?' err':'')}
function aoa(ws){return XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:null})}
function readBuf(f){return new Promise((ok,no)=>{const fr=new FileReader();fr.onerror=()=>no(new Error('não foi possível ler o arquivo'));fr.onload=()=>ok(new Uint8Array(fr.result));fr.readAsArrayBuffer(f)})}
async function importOne(f,forced){
  const buf=await readBuf(f),names=XLSX.read(buf,{type:'array',bookSheets:true}).SheetNames;
  const dn=names.find(n=>/^dash$/i.test(n.trim()));if(!dn)throw new Error('não encontrei uma aba chamada DASH');
  const pn=names.find(n=>/^perdas\s*shopee$/i.test(n.trim())),wb=XLSX.read(buf,{type:'array',sheets:pn?[dn,pn]:[dn]});
  let cfg=null;try{if(typeof DecompressionStream!=='undefined')cfg=pivotCfg(await zipFiles(buf,n=>/pivotTables\/[^/]+\.xml$|pivotTables\/_rels\/|pivotCacheDefinition\d+\.xml$/.test(n)))}catch(e){}
  const rec=parseDash(aoa(wb.Sheets[dn]),pn?aoa(wb.Sheets[pn]):null,cfg),w=forced||rec.week;
  if(!/^W\d+$/.test(w))throw new Error('não identifiquei a semana');
  rec.week=w;rec.file=f.name;rec.savedAt=Date.now();store[w]=rec;persist();return rec;
}
$('btnGo').addEventListener('click',async()=>{
  const fs=[...$('file').files];if(!fs.length){msg('ERRO: Selecione pelo menos um arquivo.',1);return}
  if(typeof XLSX==='undefined'){msg('ERRO: Biblioteca de leitura não carregada (verifique a internet).',1);return}
  const forced=fs.length===1?wk($('weekIn').value):'',out=[];let bad=0,last='';
  for(const f of fs){msg(`Lendo ${out.length+1} de ${fs.length}: ${f.name}...`);
    try{const r=await importOne(f,forced);last=r.week;out.push(`✔ ${f.name} → ${r.week} · ${r.total.q} perdas · ${brl(r.total.v)}`)}
    catch(e){bad++;out.push(`✖ ${f.name}: ${e.message}`)}}
  if(last){cur=last;render()}
  msg(out.join('\n'),bad&&!last);$('weekIn').value='';$('file').value='';
});

/* ---- ARQUIVOS SALVOS ---- */
function files(){const ws=sorted().reverse();
  $('fl').innerHTML=ws.length?ws.map(x=>`<div class="fr"><div><b>${x.week}</b> · ${esc(x.file)}<small>${new Date(x.savedAt).toLocaleString('pt-BR')} · ${x.total.q} perdas · ${brl(x.total.v)}</small></div><button data-o="${x.week}" class="ghost">Abrir</button><button data-d="${x.week}" class="del">Excluir</button></div>`).join(''):'<p class="mut">Nenhum arquivo salvo.</p>'}
$('btnFiles').addEventListener('click',()=>{files();$('dlg').showModal()});
$('dClose').addEventListener('click',()=>$('dlg').close());
$('fl').addEventListener('click',e=>{const b=e.target;
  if(b.dataset.o){cur=b.dataset.o;render();$('dlg').close()}
  if(b.dataset.d){if(!b.classList.contains('sure')){b.classList.add('sure');b.textContent='Confirmar?';return}
    delete store[b.dataset.d];persist();if(cur===b.dataset.d)cur=(sorted().pop()||{}).week||'';render();files()}});
let all=0;$('dAll').addEventListener('click',e=>{if(!all){all=1;e.target.textContent='Confirmar exclusão de todos?';return}
  all=0;e.target.textContent='Excluir todos';store={};persist();cur='';render();files()});

cur=(sorted().pop()||{}).week||'';render();
})();
