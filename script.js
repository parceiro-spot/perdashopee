(function(){
const s=x=>x==null?'':String(x).trim();
const num=x=>{if(typeof x==='number')return x;const t=s(x).replace(/[^\d,.-]/g,'');if(!t)return 0;const n=t.includes(',')?parseFloat(t.replace(/\./g,'').replace(',','.')):parseFloat(t);return isNaN(n)?0:n};
const wk=x=>{const m=/W\s*(\d+)/i.exec(s(x));return m?'W'+m[1]:s(x).toUpperCase()};
const wn=w=>parseInt(String(w).replace(/\D/g,''),10)||0;
const esc=t=>s(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const brl=v=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v||0);

/* ---- LEITURA DA ABA DASH (d) + aba PERDAS SHOPEE (p) para a tabela de causa ---- */
function parseDash(d,p){
  let week=wk((d[0]||[])[0]),count=0;
  for(let i=0;i<Math.min(d.length,12);i++){const m=/(\d+)\s+PERDAS\s+NA\s+(W\d+)/i.exec(s((d[i]||[])[0]));if(m){count=+m[1];if(!/^W\d+$/.test(week))week=m[2].toUpperCase()}}
  const h=d.findIndex(r=>r&&s(r[0]).toUpperCase()==='SVC');
  if(h<0)throw new Error('Não encontrei as tabelas de SVC na aba DASH.');
  const svc=[],drv=[];let svcT=null,drvT=null,L=true,R=true,cur='';
  for(let i=h+1;i<d.length&&(L||R)&&i<h+400;i++){const r=d[i]||[];
    if(L){const a=s(r[0]);
      if(/^total/i.test(a)){svcT={q:num(r[1]),v:num(r[2])};L=false}
      else if(a)svc.push({n:a,q:num(r[1]),v:num(r[2])});
      else if(svc.length)L=false}
    if(R){const e=s(r[4]),f=s(r[5]);
      if(/^total/i.test(e)){drvT={q:num(r[6]),v:num(r[7])};R=false}
      else if(e||f){if(e)cur=e.replace(/\s+total$/i,'');drv.push({svc:cur,driver:f,q:num(r[6]),v:num(r[7])})}
      else if(drv.length)R=false}}
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
if(typeof module!=='undefined')module.exports={parseDash};
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
$('btnGo').addEventListener('click',()=>{
  const f=$('file').files[0];if(!f){msg('ERRO: Selecione um arquivo primeiro.',1);return}
  if(typeof XLSX==='undefined'){msg('ERRO: Biblioteca de leitura não carregada (verifique a internet).',1);return}
  msg('Lendo arquivo...');const fr=new FileReader();
  fr.onerror=()=>msg('ERRO: Não foi possível ler o arquivo.',1);
  fr.onload=()=>{try{
    const buf=new Uint8Array(fr.result),names=XLSX.read(buf,{type:'array',bookSheets:true}).SheetNames;
    const dn=names.find(n=>/^dash$/i.test(n.trim()));if(!dn){msg('ERRO: Não encontrei uma aba chamada DASH nesse arquivo.',1);return}
    const pn=names.find(n=>/^perdas\s*shopee$/i.test(n.trim())),wb=XLSX.read(buf,{type:'array',sheets:pn?[dn,pn]:[dn]});
    const rec=parseDash(aoa(wb.Sheets[dn]),pn?aoa(wb.Sheets[pn]):null),w=wk($('weekIn').value)||rec.week;
    if(!/^W\d+$/.test(w)){msg('ERRO: Não identifiquei a semana. Preencha o campo "Salvar para a semana".',1);return}
    rec.week=w;rec.file=f.name;rec.savedAt=Date.now();store[w]=rec;persist();cur=w;render();
    msg(`✔ Semana ${w} salva: ${rec.total.q} perdas · ${brl(rec.total.v)}`);$('weekIn').value='';
  }catch(e){msg('ERRO: '+e.message,1)}};
  fr.readAsArrayBuffer(f);
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
